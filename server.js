var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
var async = require('async');
var path = require('path');

var AES = require('crypto-js/aes');
var SHA256 = require('crypto-js/sha256');
var CryptoJS = require("crypto-js");



//Define static content for app to use.
app.use(express.static('client'));

//Generated public key on server start
var publicKey = "";

//List of client's name, socket, private key
var clients = [];

//Number to attach to anonymous users
var count = 0;

generateRandomKey();

/**
 * 
 * We define a route handler / that gets called when clients hit website home
 * will automatically search for and serve index from this directory.
 * 
 * */
app.get('/', function(request, response) {

    response.sendfile(__dirname + '/client');

});

server.listen(8080, function() {

    console.log('listening on : 8080');

});

/**
 * 
 * Creates a client object after successfull socket creation
 * broadcasts to all users that a new user has connected
 * saves client information for user list
 * 
 * */
io.on('connection', function(socket) {


    socket.on('client name', function(name) {

        io.sockets.emit('publicKey', publicKey);

        handleNewClient(socket, name);

    });


    socket.on('disconnect', function() {

        handleDisconnectedClient(socket);

    });
    
    /**
     * 
     * Receive encrypted private key from client, decrypt and add key to client
     * 
     * */
    socket.on('privateKey', function(key) {
        
        console.log(key);
        
        var decrypted  = CryptoJS.AES.decrypt(key, publicKey);
        
        var decryptedKey = decrypted.toString(CryptoJS.enc.Utf8);
        
        findClientAndAddPrivateKey(socket, decryptedKey);
        
    })


    /**
     * 
     * Listens for incoming message from clients, finds sender socket's private
     * key translates and rebroadcasts to each individual client encrypted with 
     * each clients private keybroadcasts message to all clients

     * */

    socket.on('message to server', function(message) {
        
        var decryptedMsg = decryptIncomingMessage(socket, message);
        
        var senderName = findSenderSocketInformation(socket);
        
        //Break apart message and check if its a whisper
        var messageArr = decryptedMsg.split(" ", 2);
        
        if(senderName === "admin" && messageArr[0] === '/r'){
            
            findAndRemoveClient(socket, messageArr[1]);
            
        }

        else if (messageArr[0] === '/w') {

            findClientAndSendWhisper(socket, decryptedMsg, messageArr);

        }
        else {
            
            encryptAndBroadcastToAllClients(socket, decryptedMsg);

        }

    });
    

});




/**
 * 
 * Iterates through clients and provides an comma delimited list which is 
 * broadcasted to each client for an up to date list of users
 * 
 * */
function updateUserList() {
    
    var clientList = "";
    
    for (var i = 0; i < clients.length; i++) {
        
        if (i === 0) {
            
            clientList = clients[i].name;
            
        }

        clientList = clientList + ',' + clients[i].name;
        
    }
    
    io.sockets.emit('updated user list', clientList);
}


/**
 * 
 * Removes client from clients list and broadcasts updated user list to all
 * connected clients
 * 
 * @param {socket}: disconnected client socket
 * 
 * */
function handleDisconnectedClient(socket) {

    console.log(socket.id + "client disconnected");

    for (var i = 0; i < clients.length; i++) {
        
        if (clients[i].socket.id === socket.id) {
            
            clients.splice(i, 1);

        }

        updateUserList();
    }
}

/**
 * 
 * Attaches a name to a clients if entered, if no name is entered, it defaults
 * to ananymous plus a count to differentiate anon client sockets. Appends
 * new client to client list then broadcasts an updated client list to all 
 * connected clients
 * 
 * @param {socket}: new client socket
 * 
 * @param {name}: chosen name of new client user
 * 
 * */
function handleNewClient(socket, name) {
    
    var client = new Object();

    if (name === "") {

        name = 'anonymous' + count;

        client.name = name;

        count++;
    }
    else {
        client.name = name;
    }

    client.socket = socket;

    clients.push(client);

    console.log('Client name: ' + client.name + '\nID: ' + client.socket);

    io.sockets.emit('server message', 'user connected');
    
    io.sockets.socket(socket.id).emit('setName', name);

    updateUserList();

}

/**
 * 
 * Searches for client, if client exists we trim the original message and send
 * to found client, otherwise sends response back to sender that no client exists
 * 
 * @param {senderSocket}: sender socket
 * 
 * @param {message}: original, unfilitered message
 * 
 * @param {messageArr}: array that contains desired client name
 * 
 * */
function findClientAndSendWhisper(senderSocket, message, messageArr) {
    
    var senderName = findSenderSocketInformation(senderSocket);
    
    var isFound = false;
    
    for (var pos in clients) {

        if (clients[pos].name == messageArr[1]) {

            var destinationId = clients[pos].socket.id;

            var index = message.indexOf(messageArr[1]);

            var length = messageArr[1].length;

            var trimmedMessage = message.substr(index + length, message.length);
            
            var reconstructedMessage = senderName + ": " + trimmedMessage;
            
            var encryptedMessage = CryptoJS.AES.encrypt(reconstructedMessage, clients[pos].key);

            io.sockets.socket(destinationId).emit('whisper', encryptedMessage.toString());
            
            isFound = true;

        }
    }
    
    if(!isFound){
        
        io.sockets.socket(senderSocket.id).emit('admin', 'No client exists with that name');
        
    }
}

/**
 * 
 * Helper method that iterates through list of clients to find sender name
 * 
 * @param {senderSocket}: raw socket info of sender
 * 
 * */
function findSenderSocketInformation(senderSocket){
    
    var senderName = "";
    
    for(var pos in clients){
        
        if(clients[pos].socket.id === senderSocket.id){
            
            senderName = clients[pos].name;
            
        }
        
    }
    return senderName;
}

/**
 * Searches though the list of clients, if found sends admin disconnect message
 * to client, disconnect the client and update user list.
 * 
 * @param {senderSocket}: Admin socket 
 * 
 * @param {clientName}: Name of client socket to be disconnected
 * 
 * */
function findAndRemoveClient(senderSocket, clientName){
    
    var isFound = false;
    
    for (var pos in clients){
        
        if(clients[pos].name === clientName){
            
            var sockId = clients[pos].socket.id
            
            io.sockets.socket(sockId).emit('admin', 'You have been removed');
            
            io.sockets.socket(sockId).disconnect();
            
            isFound = true;
            
            //close this clients connection
        }
    }
    if(!isFound){
        
        io.sockets.socket(senderSocket.id).emit('admin', 'No client exists with that name');
        
    }
}

/**
 * Searches list of clients to find client key
 * 
 * @param {socket}: Socket from message source
 * 
 * */
function getEncryptionKey(socket){
    
    for(var pos in clients){
        
        if(clients[pos].socket.id === socket.id){
            
            return clients[pos].key;
            
        }
    }
}

/**
 * Generates a random public key
 * 
 * */
function generateRandomKey(){
            var keySource = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a',
                            'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l',
                            'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w',
                            'x', 'y', 'z'];
            
            for(var i = 0; i < 100; i++){
                
                publicKey += keySource[Math.floor((Math.random() * 35) + 1)];
                
            }
            
            console.log('PUBLIC KEY: ' + publicKey);
}

/**
 * Adds decrypted client private key to client object
 * */
function findClientAndAddPrivateKey(socket, key){
    
    for(var pos in clients){
        
        if(clients[pos].socket.id === socket.id){
            
            clients[pos].key = key;
            
            console.log(clients[pos]);
        }
    }
}

/**
 * Finds client private key and decrypts incoming message
 * 
 * @param {socket}: sender socket
 * 
 * @param {message}: incoming encrypted message
 * 
 * */
function decryptIncomingMessage(socket, message){
     
      for(var pos in clients){
        
        if(clients[pos].socket.id === socket.id){
            
            var decrypted  = CryptoJS.AES.decrypt(message, clients[pos].key);
        
            var decryptedMessage = decrypted.toString(CryptoJS.enc.Utf8);
            
            console.log('DECRYPTED: '+decryptedMessage);
            
        }
    }
     
     return decryptedMessage;
 }

/**
 * Re-encrypts the original message and and sends to each individual client
 * 
 * @param {message}: original message
 * 
 * */
function encryptAndBroadcastToAllClients(socket, message){
    
    senderName = "";
    
    for(var i in clients){
        if(clients[i].socket.id === socket.id){
            senderName = clients[i].name;
        }
    }
    
    var broadcastMessage = senderName + ': '+message
    
    for(var pos in clients){
            
            var encryptedMessage = CryptoJS.AES.encrypt(broadcastMessage, clients[pos].key);
            
            console.log('ENCRYPTED: '+encryptedMessage.toString());
            console.log('CLIENT NAME: '+clients[pos].name);
            console.log('SOCKET ID: '+clients[pos].socket.id);
            
            io.sockets.socket(clients[pos].socket.id).emit('broadcast', encryptedMessage.toString());
            
            }
}