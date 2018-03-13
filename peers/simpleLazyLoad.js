(function () {

    let coreFiles = [
        // "../vendor/SimplePeer.js",
        "../vendor/PeerJS.js",
        "../vendor/eventEmitter3.js",
        "../vendor/SStream.js",
        "../vendor/qrcode.js",
        "../vendor/Crypto.js",
        "../vendor/ethUtils.js",
        "../vendor/ethWallet.js",
        "../vendor/Buffer.js",
        "../vendor/Duplex.js",
        // "../vendor/mewRTC.js"
    ];

    let doc = document.getElementById("body");
    // console.log(doc);

    for (let i = 0; i < coreFiles.length; i++) {
        let script = document.createElement("script");
        script.src = coreFiles[i];
        doc.appendChild(script);
    }
    let files, peerFiles;

    console.log(window.location);
    if (/peer1/.test(window.location.href)) {
        // Initiator Peer
        peerFiles = [
            "../peers/mewConnectInitiator.js",
            "../peer1/main.js"
        ];

    } else if (/peer2/.test(window.location.href)) {
        //receiver Peer
        peerFiles = [
            "../peers/mewConnectReceiver.js",
            "../peer2/main.js"
        ];
    }

    files = [
        "../peers/mewConnectCommon.js",
        "../peers/mewConnectCrypto.js",
        "../peers/mewConnectUtils.js",
        "../peers/mewConnectPeer.js",
        "../peers/mewConnectPeerJS.js"
        // "../peers/mewConnectSimplePeer.js"
    ].concat(peerFiles);


    doCheck();

    function doCheck() {
        let doc = document.getElementById("body");
        // console.log(doc);
        // console.log(files);

        if (window.EthUtilities && window.CCrypto) {
            for (let i = 0; i < files.length; i++) {
                let script = document.createElement("script");
                script.src = files[i];
                doc.appendChild(script);
            }
        } else {
            setTimeout(doCheck, 100);
        }
    }

})();
