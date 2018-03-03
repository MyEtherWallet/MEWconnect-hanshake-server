"use strict";

// const socket = io.connect("https://salty-ocean-27014.herokuapp.com/");
const socket = io.connect("http://localhost:3001");
let connectionState = document.getElementById("connState");
let disconnectBtn = document.getElementById("disconnect");
let testRTCBtn = document.getElementById("testRTC");

let p, send;

disconnectBtn.disabled = true;
testRTCBtn.disabled = true;

testRTCBtn
  .addEventListener("click", testRTC);

disconnectBtn
  .addEventListener("click", disconnectRTC);

socket.on('offer', recieveOffer);


function recieveOffer(data) {
  console.log(data);
  p = new SimplePeer({initiator: false, trickle: false});
  p.signal(JSON.parse(data.data));

  p.on('error', function (err) {
    logger("error", err)
  });

  p.on('connect', function () {
    logger("CONNECT", "ok");
    connectionState.textContent = "WebRTC Connected";
    p.send('From Web');
    socket.disconnect();
  });

  p.on('data', function (data) {
    logger("peer2 data", data.toString());
  });

  p.on('close', function (data){
    connectionState.textContent = "Connection Closed";
    disconnectBtn.disabled = true;
    testRTCBtn.disabled = true;
  });

  p.on('signal', function (data) {
    logger("signal", JSON.stringify(data));
    send = JSON.stringify(data);
    socket.emit('answer', {data: send});
    disconnectBtn.disabled = false;
    testRTCBtn.disabled = false;
  })
}



function testRTC(){
  p.send("Sent Via RTC From Web Peer");
}

function disconnectRTC(){
  disconnectBtn.disabled = true;
  testRTCBtn.disabled = true;
  p.destroy();
}


function logger(tag, err){
  console.log(tag, err)
}