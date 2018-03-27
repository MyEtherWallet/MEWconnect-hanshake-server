var io = require("socket.io-client");


// On Mac, must launchctl limit maxfiles 400000 unlimited
for (i=0;i<parseInt(process.argv[2],10);i++) {

    var socket = io.connect('http://127.0.0.1:8000/',{'force new connection':true});

    socket.on('ping', function (data) {
        socket.emit('pong', { content: 'parisjs' });
    });

}