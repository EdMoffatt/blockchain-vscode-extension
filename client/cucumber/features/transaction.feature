Feature: Submit transaction
    Test submitting a transaction

    Scenario Outline: Submit a transaction for a smart contract
        Given a <language> smart contract for <assetType> assets with the name <name> and version <version>
        And the Local Fabric is running
        And connected to the 'Local Fabric' gateway
        And the contract has been created
        And the contract has been packaged
        And the package has been installed
        And the contract has been instantiated with the transaction '' and args '', not using private data
        When I submit the transaction 'createConga' with args '["Conga_001", "Big Conga"]'
        Then the logger should have been called with 'SUCCESS', 'Successfully submitted transaction' and 'No value returned from createConga'
        Examples:
        | language   | assetType | name               | version |
        | JavaScript | Conga     | JavaScriptContract | 0.0.1   |
        | TypeScript | Conga     | TypeScriptContract | 0.0.1   |
        | Java       | null      | JavaContract       | 0.0.1   |
        | Go         | null      | GoContract         | 0.0.1   |
