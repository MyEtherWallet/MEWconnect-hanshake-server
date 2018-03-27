# mew-signer-hs
handshake server for MEW signer

#### Getting Started

Clone Repo:

`git clone https://github.com/MyEtherWallet/mew-signer-hs.git`

Install Dependencies:

`npm install`

Start Signal Server:

`node server.js`

or 

`npm start`


## MEW Connect* API
-----
*Working Name

### Signaling:
#### Key Components:

**Initiator :** Mew Website or Other End Point

**Receiver:** Mobile Application or Other Configured Key store

**Server:** Intermediate signaling server acting to pass the offer and answer between connecting peers.

**connId:** last [← check] 32 characters of the confirmation signature. Created by the Initiating peer and transferred to the Receiving peer via a string (plain text or via a QR Code)



#### Initial Signaling Event Progression Overview:

**Connect** [Server → Initiator] (initial socket connection with signaling server)

**Connect** [Server → Receiver] (initial socket connection with signaling server using credentials created during initiator connection creation)

**Handshake** [Server → Receiver] (A connection slot exists for the supplied credentials)

**Signature** [ Receiver → Server] (Identity confirmation credentials supplied to server for validation against credentials initially supplied to the server by the Initiator)

**Confirmation** [Server → Initiator] (Confirmation of Receiver identity made by the server and initialization of RTC my be attempted)

*(WebRTC Offer Creation by Initiator)*

**OfferSignal** [Initiator → Server] (Transmission of an offer and server list to the signaling server for retransmission to the Receiver)

**Offer** [Server → Receiver] (Retransmission of the offer and server list to the Receiver)

*(WebRTC Answer Creation by Initiator)*

**AnswerSignal** [Receiver → Server] (Transmission of an answer to the received offer for retransmission to the Initiator)

**Answer** [Server → Initiator] (Retransmission of the answer to the Initiator)

*(On Successful Connection)*

**RtcConnected** [Receiver → Server] (signal to clean up the connection entry)

**RtcConnected** [Initiator → Server] (signal to clean up the connection entry)

*(Upon receipt of rtcConnected the server removes the related connection entry)*



#### Initial RTC Connection Failure Signaling Event Progression Overview:

**TryTurn** [Initiator → Server] (Signal RTC Connection Failure to the signaling server. Sets a flag (if unset) in the connection entry indicating a RTC Connection via a TURN Server is to be attempted)

**TryTurn** [Receiver → Server] (Signal RTC Connection Failure to the signaling server. Sets a flag (if unset) in the connection entry indicating a RTC Connection via a TURN Server is to be attempted)

*(Obtain TURN Server credentials)*

**TurnToken** [Server → Initiator] (Transmission of TURN Server credentials triggering Initiator to re-attempt RTC connection)

*(WebRTC Offer Creation by Initiator)*

**OfferSignal** [Initiator → Server] (Transmission of an offer and TURN server list with credentials to the signaling server for retransmission to the Receiver)

**Offer** [Server → Receiver] (Retransmission of the offer and TURN server list with credentials to the Receiver)

*(WebRTC Answer Creation by Initiator)*

**AnswerSignal** [Receiver → Server] (Transmission of an answer to the received offer for retransmission to the Initiator)

**Answer** [Server → Initiator] (Retransmission of the answer to the Initiator)

------

### Signaling Event Details:

**Connect**

 - Direction: [Server → Initiator]
 - Signal String: connection
 - Transmitted Data (JSON Object):
   - None

**Connect**

 - Direction: [Server → Receiver]
 - Signal String: connection
 - Transmitted Data (JSON Object):
   - None

**Handshake**

 - Direction: [Server → Receiver]
 - Signal String: handshake
 - Transmitted Data (JSON Object):
   - None

**Signature**
 - Direction: [ Receiver → Server]
 - Signal String: signature
 - Transmitted Data (JSON Object):
   - signed: signed Response
   - connId: connection ID

**Confirmation**

 - Direction: [Server → Initiator]
 - Signal String: confirmation
 - Transmitted Data (JSON Object):

**OfferSignal**

 - Direction: [Initiator → Server]
 - Signal String: offerSignal
 - Transmitted Data (JSON Object):
   - data: WebRTC offer as string (Stringified JSON)
   - connId: connection ID
   - options: JSONArray of STUN or TURN server details
       - Format:
         - for STUN - [{url: “details”}]
         - for TURN [{url: “url”, username: “username”, credential: “credential”}, ...]

**Offer**

 - Direction: [Server → Receiver]
 - Signal String: offer
 - Transmitted Data (JSON Object):
   - data: WebRTC offer as string (Stringified JSON)
   - connId: connection ID
   - options: JSONArray of STUN or TURN server details
       - Format:
         - for STUN - [{url: “details”}]
         - for TURN [{url: “url”, username: “username”, credential: “credential”}, ...]

**AnswerSignal**

 - Direction: [Receiver → Server]
 - Signal String: answerSignal
 - Transmitted Data (JSON Object):
   - data: WebRTC answer as string (Stringified JSON)
   - connId: connection ID

**Answer**

 - Direction: [Server → Initiator]
 - Signal String: answer
 - Transmitted Data (JSON Object):
   - data: WebRTC answer as string (Stringified JSON)
   - connId: connection ID

**TryTurn**

 - Direction: [Initiator → Server]
 - Signal String: tryTurn
 - Transmitted Data (JSON Object):
   - connId: connection ID
   - cont: true
   
Note: Semi simultaneous (race condition) to Receiver → Server “tryTurn” signal

**TryTurn**

 - Direction: [Receiver → Server]
 - Signal String: tryTurn
 - Transmitted Data (JSON Object):
   - connId: connection ID
   - cont: true

Note: Semi simultaneous (race condition) to Initiator → Server “tryTurn” signal

**TurnToken**

 - Direction: [Server → Initiator]
 - Signal String: turnToken
 - Transmitted Data (JSON Object):
   - data: JSONArray of STUN or TURN server details
      - Format:
        - for TURN [{url: “url”, username: “username”, credential: “credential”}, ...]

 **OfferSignal** (for turn attempt)
 - Direction: [Initiator → Server]
   - See “OfferSignal” above.

**Offer** (for turn attempt)
 - Direction: [Server → Receiver]
   - See “Offer” above.

(WebRTC Answer Creation by Initiator)

**AnswerSignal** (for turn attempt)
 - Direction: [Receiver → Server]
   - See “AnswerSignal” above.

**Answer** (for turn attempt)
 - Direction: [Server → Initiator]
   - See “Answer” above.



**RtcConnected** (for turn attempt)
 - Direction: [Receiver → Server]
 - Signal String: rtcConnected
 - Transmitted Data (String): connection ID

**RtcConnected** (for turn attempt)
 - Direction: [Initiator → Server]
 - Signal String: rtcConnected
 - Transmitted Data (String): connection ID





#### RTC Communications
Messages are exchanged in JSON containing two primary identifying parts, “type” and “data”.

**Type:**
 - **Property name:** type
 - **Description:** A string indicating the intent of the message or response. Used to intercept message responses and forward them to the correct handler(s).

**Data:**
 - **Property name:** data
 - **Description:** The content of the message. This serves as the container for the content being transmitted.



#### Current RTC Communication “types”:

Address
 - **Signal String:** address
 - **Transmitted Data (String):** connection ID



SignMessage
 - **Signal String:** signMessage
 - **Transmitted Data (String):** connection ID

SignTx
 - **Signal String:** signTx
 - **Transmitted Data (String)**: connection ID


 ---------------------------------------


#### Generate Documentation
Install jsdoc

>globally
>```text
>npm install -g jsdoc
>```
or
>locally
>```text
>npm install --save-dev jsdoc
>```

then 
```
text>npm run docs
```
- This will generate the documentation and place it in a created docs directory.

navigate to ~/mew-signer-hs/docs

open index.html in chrome


