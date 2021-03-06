#
# SPDX-License-Identifier: Apache-2.0
#
FROM codercom/code-server:2.1699-vsc1.41.0
# Revert back to root
USER root
# Add essential build dependencies
RUN apt-get update && \
    apt-get -y install build-essential python && \
    rm -rf /var/lib/apt/lists/*
# Install Go and the various Go dependencies
RUN wget -qO go1.13.4.linux-amd64.tar.gz https://dl.google.com/go/go1.13.4.linux-amd64.tar.gz && \
    tar xzvf go1.13.4.linux-amd64.tar.gz -C /usr/local && \
    rm go1.13.4.linux-amd64.tar.gz
ENV PATH /usr/local/go/bin:${PATH}
RUN GOPATH=/tmp/go go get github.com/mdempsky/gocode \
    github.com/uudashr/gopkgs/cmd/gopkgs \
    github.com/ramya-rao-a/go-outline \
    github.com/acroca/go-symbols \
    golang.org/x/tools/cmd/guru \
    golang.org/x/tools/cmd/gorename \
    github.com/go-delve/delve/cmd/dlv \
    github.com/stamblerre/gocode \
    github.com/rogpeppe/godef \
    github.com/sqs/goreturns \
    golang.org/x/lint/golint && \
    tar cf - -C /tmp/go/bin . | tar xf - -C /usr/local/bin && \
    rm -rf /tmp/go
# Install Java
RUN mkdir /usr/local/java && \
    wget -qO OpenJDK8U-jdk_x64_linux_hotspot_8u232b09.tar.gz https://github.com/AdoptOpenJDK/openjdk8-binaries/releases/download/jdk8u232-b09/OpenJDK8U-jdk_x64_linux_hotspot_8u232b09.tar.gz && \
    tar xzvf OpenJDK8U-jdk_x64_linux_hotspot_8u232b09.tar.gz --strip 1 -C /usr/local/java && \
    rm OpenJDK8U-jdk_x64_linux_hotspot_8u232b09.tar.gz
ENV PATH /usr/local/java/bin:${PATH}
# Install Node.js
RUN mkdir /usr/local/node && \
    wget -qO node-v10.18.0-linux-x64.tar.xz https://nodejs.org/dist/latest-v10.x/node-v10.18.0-linux-x64.tar.xz && \
    tar xJvf node-v10.18.0-linux-x64.tar.xz --strip 1 -C /usr/local/node && \
    rm node-v10.18.0-linux-x64.tar.xz
ENV PATH /usr/local/node/bin:${PATH}
# Install other extensions for Visual Studio Code
RUN code-server --extensions-dir /usr/local/extensions --install-extension ms-vscode.go && \
    code-server --extensions-dir /usr/local/extensions --install-extension vscjava.vscode-java-pack
# Install our extension for Visual Studio Code
COPY ibm-blockchain-platform-docker.vsix /tmp/
RUN code-server --extensions-dir /usr/local/extensions --install-extension /tmp/ibm-blockchain-platform-docker.vsix && \
    cd /usr/local/extensions/ibmblockchain.ibm-blockchain-platform-* && \
    npm rebuild
# Create a user which doesn't have sudo access
RUN useradd -m -s /bin/bash vscode
ADD vscode.sh /usr/local/bin/
USER vscode
WORKDIR /home/vscode
ENTRYPOINT ["/usr/local/bin/vscode.sh"]
