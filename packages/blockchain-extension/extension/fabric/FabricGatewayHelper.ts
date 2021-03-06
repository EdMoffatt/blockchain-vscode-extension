/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { SettingConfigurations } from '../../configurations';
import { FabricNode, FileConfigurations } from 'ibm-blockchain-platform-common';
import { FileSystemUtil } from '../util/FileSystemUtil';
import { FabricGatewayRegistryEntry } from '../registries/FabricGatewayRegistryEntry';
import { FabricGatewayRegistry } from '../registries/FabricGatewayRegistry';

export class FabricGatewayHelper {

    public static async getConnectionProfilePath(gatewayName: string): Promise<string> {

        const extDir: string = vscode.workspace.getConfiguration().get(SettingConfigurations.EXTENSION_DIRECTORY);
        const homeExtDir: string = FileSystemUtil.getDirPath(extDir);
        const profileDirPath: string = path.join(homeExtDir, 'gateways', gatewayName);

        let files: string[] = await fs.readdir(profileDirPath);
        files = files.filter((fileName: string) => !fileName.startsWith('.'));

        if (files.length === 0) {
            throw new Error(`Failed to find a connection profile file in folder ${profileDirPath}`);
        }

        return path.join(profileDirPath, files[0]);
    }

    public static async generateConnectionProfile(gatewayName: string, peerNode: FabricNode, caNode: FabricNode): Promise<string> {
        const connectionProfile: any = {
            name: gatewayName,
            version: '1.0.0',
            wallet: peerNode.wallet,
            client: {
                organization: peerNode.msp_id,
                connection: {
                    timeout: {
                        peer: {
                            endorser: '300'
                        },
                        orderer: '300'
                    }
                }
            },
            organizations: {},
            peers: {},
        };

        connectionProfile.organizations[peerNode.msp_id] = {
            mspid: peerNode.msp_id,
            peers: [
                peerNode.name
            ]
        };

        connectionProfile.peers[peerNode.name] = {
            url: peerNode.api_url
        };

        if (peerNode.pem) {
            connectionProfile.peers[peerNode.name].tlsCACerts = {
                pem: Buffer.from(peerNode.pem, 'base64').toString()
            };
        }

        if (peerNode.ssl_target_name_override) {
            connectionProfile.peers[peerNode.name].grpcOptions = {
                'ssl-target-name-override': peerNode.ssl_target_name_override
            };
        }

        if (caNode) {
            connectionProfile.certificateAuthorities = {};

            connectionProfile.organizations[peerNode.msp_id].certificateAuthorities = [
                caNode.name
            ];

            connectionProfile.certificateAuthorities[caNode.name] = {
                url: caNode.api_url,
                caName: caNode.ca_name
            };

            if (caNode.pem) {
                connectionProfile.certificateAuthorities[caNode.name].tlsCACerts = {
                    pem: Buffer.from(caNode.pem, 'base64').toString()
                };
            }
        }

        const extDir: string = vscode.workspace.getConfiguration().get(SettingConfigurations.EXTENSION_DIRECTORY);
        const homeExtDir: string = FileSystemUtil.getDirPath(extDir);
        const profileDirPath: string = path.join(homeExtDir, FileConfigurations.FABRIC_GATEWAYS, gatewayName);
        await fs.ensureDir(profileDirPath);
        const profileFilePath: string = path.join(profileDirPath, `${this.profileName}.json`);

        const connectionProfileString: string = JSON.stringify(connectionProfile, null, 4);
        await fs.writeFile(profileFilePath, connectionProfileString);

        return profileFilePath;
    }

    public static async copyConnectionProfile(gatewayName: string, connectionProfilePath: string): Promise<string> {
        try {

            const extDir: string = vscode.workspace.getConfiguration().get(SettingConfigurations.EXTENSION_DIRECTORY);
            const homeExtDir: string = FileSystemUtil.getDirPath(extDir);
            const profileDirPath: string = path.join(homeExtDir, FileConfigurations.FABRIC_GATEWAYS, gatewayName);

            await fs.ensureDir(profileDirPath);

            const connectionProfileFile: string = await fs.readFile(connectionProfilePath, 'utf8');
            let connectionProfile: any;
            let profilePath: string;

            if (connectionProfilePath.endsWith('.json')) {
                connectionProfile = JSON.parse(connectionProfileFile);
                profilePath = path.join(profileDirPath, `${this.profileName}.json`);
            } else {
                // Assume its a yml/yaml file type
                connectionProfile = yaml.safeLoad(connectionProfileFile);
                profilePath = path.join(profileDirPath, `${this.profileName}.yml`);
            }

            // Read the given connection profile
            const properties: string[] = ['peers', 'orderers', 'certificateAuthorities'];

            // Rewrite any TLS paths and create an inline pem instead
            for (const property of properties) {
                if (connectionProfile[property]) {
                    for (const item of Object.keys(connectionProfile[property])) {
                        if (connectionProfile[property][item].tlsCACerts && connectionProfile[property][item].tlsCACerts.path !== undefined) {
                            let tlsPath: string;
                            if (path.isAbsolute(connectionProfile[property][item].tlsCACerts.path)) {
                                tlsPath = connectionProfile[property][item].tlsCACerts.path;
                            } else {
                                tlsPath = path.resolve(path.dirname(connectionProfilePath), connectionProfile[property][item].tlsCACerts.path);
                            }
                            const tlsCertData: string = await fs.readFile(tlsPath, 'utf8');
                            connectionProfile[property][item].tlsCACerts.pem = tlsCertData;

                            // Delete the key
                            delete connectionProfile[property][item].tlsCACerts.path;
                        }
                    }
                }
            }

            let connectionProfileData: any;

            if (connectionProfilePath.endsWith('.json')) {
                connectionProfileData = JSON.stringify(connectionProfile, null, 4);
            } else {
                // Assume its a yml/yaml file type
                connectionProfileData = yaml.dump(connectionProfile);
            }

            // Write the new connection profile to the blockchain extension directory
            await fs.writeFile(profilePath, connectionProfileData);

            return profilePath;

        } catch (error) {
            throw error;
        }
    }

    public static async migrateGateways(): Promise<void> {
        // Get gateways from user settings
        const gateways: any = vscode.workspace.getConfiguration().get(SettingConfigurations.OLD_FABRIC_GATEWAYS);

        for (const gateway of gateways) {
            // Ensure all the gateways are stored under the gateways subdirectory
            const extDir: string = vscode.workspace.getConfiguration().get(SettingConfigurations.EXTENSION_DIRECTORY);
            const resolvedExtDir: string = FileSystemUtil.getDirPath(extDir);
            const gatewaysExtDir: string = path.join(resolvedExtDir, FileConfigurations.FABRIC_GATEWAYS);

            // create the new registry entry
            const gatewayRegistryEntry: FabricGatewayRegistryEntry = new FabricGatewayRegistryEntry();
            gatewayRegistryEntry.name = gateway.name;
            gatewayRegistryEntry.associatedWallet = gateway.associatedWallet;

            const exists: boolean = await FabricGatewayRegistry.instance().exists(gateway.name);

            if (!exists) {
                await FabricGatewayRegistry.instance().add(gatewayRegistryEntry);
            }

            if (gateway.connectionProfilePath && gateway.connectionProfilePath.includes(extDir) && !gateway.connectionProfilePath.includes(gatewaysExtDir)) {
                const newGatewayDir: string = path.join(gatewaysExtDir, gatewayRegistryEntry.name);
                try {
                    await fs.copy(gateway.connectionProfilePath, newGatewayDir);
                } catch (error) {
                    throw new Error(`Issue copying ${gateway.connectionProfilePath} to ${newGatewayDir}: ${error.message}`);
                }
                // Only remove the gateway dir if the copy worked
                await fs.remove(path.join(extDir, gateway.name));
                gateway.connectionProfilePath = path.join(newGatewayDir, path.basename(gateway.connectionProfilePath));

            }

            delete gateway.connectionProfilePath;
        }
        // Rewrite the updated gateways to the user settings
        await vscode.workspace.getConfiguration().update(SettingConfigurations.OLD_FABRIC_GATEWAYS, [], vscode.ConfigurationTarget.Global);
    }

    private static profileName: string = 'connection';

}
