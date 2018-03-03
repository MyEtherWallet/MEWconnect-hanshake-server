"use strict";

// const socket = io.connect("https://salty-ocean-27014.herokuapp.com/");
const socket = io.connect("http://localhost:3001");
let connectionState = document.getElementById("connState");
let disconnectBtn = document.getElementById("disconnect");
let initiateRTCBtn = document.getElementById("initiateRTC");
let testRTCBtn = document.getElementById("testRTC");

let p, send;

initiateRTCBtn.disabled = false;
disconnectBtn.disabled = true;
testRTCBtn.disabled = true;

initiateRTCBtn
  .addEventListener("click", initiateRTC);

testRTCBtn
  .addEventListener("click", testRTC);

socket.on("answer", recieveAnswer);

disconnectBtn.addEventListener("click", disconnectRTC);

function initiateRTC(event){
  initiateRTCBtn.disabled = true;
  disconnectBtn.disabled = false;
  testRTCBtn.disabled = false;
  p = new SimplePeer({initiator: true, trickle: false});

  p.on('error', function (err) {
    logger("error", err);
  });

  p.on('connect', function () {
    logger("CONNECT", "ok");
    p.send('From Mobile');
    connectionState.textContent = "WebRTC Connected";
    socket.disconnect();
  });

  p.on('close', function (data){
    document.getElementById("connState").textContent = "Connection Closed";
    initiateRTCBtn.disabled = false;
    disconnectBtn.disabled = true;
    testRTCBtn.disabled = true;
  });

  p.on('data', function (data) {
    let recdData = data.toString();
    logger("peer1 data", recdData);
  });

  p.on('signal', function (data) {
    logger('SIGNAL', JSON.stringify(data));
    send = JSON.stringify(data);
    socket.emit('offer', {data: send});
  });
  document.querySelector("#Initiate").style.color = "green";
}




function recieveAnswer(data){
  p.signal(JSON.parse(data.data));
}



function testRTC(){
  p.send("Sent Via RTC From Mobile Peer");
}

function disconnectRTC(){
  initiateRTCBtn.disabled = false;
  disconnectBtn.disabled = true;
  testRTCBtn.disabled = true;
  p.destroy();
}



function logger(tag, err){
  console.log(tag, err)
}