var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

var path = require('path');
var async = require('async');

//Define static content for app to use.
app.use(express.static('client'));


var clients = [];

var count = 0;

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
 * TODO: Remove disconnected clients from client list
 * 
 * */
io.on('connection', function(socket) {


    socket.on('client name', function(name) {

        handleNewClient(socket, name);

    });


    socket.on('disconnect', function() {

        handleDisconnectedClient(socket);

    });


    /**
     * 
     * Listens for incoming message from clients, broadcasts message to all clients
     * 
     * TODO: add whisper functionality
     * 
     * */

    socket.on('message to server', function(message) {

        //Break apart message and check if its a whisper
        var messageArr = message.split(" ", 2);

        if (messageArr[0] === '/w') {

            findClientAndSendWhisper(socket, message, messageArr);

        }
        else {

            io.sockets.emit('broadcast', message);

        }

        console.log('message from client: ' + message);

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

    io.sockets.emit('broadcast', 'user connected');

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

            var pos = message.indexOf(messageArr[1]);

            var length = messageArr[1].length;

            var trimmedMessage = message.substr(pos + length, message.length);

            io.sockets.socket(destinationId).emit('whisper', senderName + ": " + trimmedMessage);
            
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