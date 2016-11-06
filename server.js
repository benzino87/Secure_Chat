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
 * We define a route handler / that gets called when clients hit website home
 * will automatically search for and serve index from this directory.
 * */
app.get('/', function(request, response) {
    response.sendfile(__dirname + '/client')
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
    });

    socket.on('disconnect', function() {
        console.log(socket.id + "client disconnected");
        for(var i = 0; i < clients.length; i++)
        {
            if(clients[i].socket.id === socket.id)
            {
                clients.splice(i, 1);
                
            }
            
            updateUserList();
        }
        

    });
    
    
    /**
     * Listens for incoming message from clients, broadcasts message to all clients
     * 
     * TODO: add whisper functionality
    * */
    
    socket.on('message to server', function(message) {
        
        //Break apart message and check if its a whisper
        var messageArr = message.split(" ", 2);
        
        if(messageArr[0] === '/w'){
            //check clients list for name
            for(var pos in clients){
                if(clients[pos].name == messageArr[1]){
                    console.log(clients[pos].socket.id);
                    
                    io.sockets.socket(clients[pos].socket.id).emit('broadcast', 'super secret message');

                    //io.connected[clients[pos].socket.id].emit();
                    
                }
            }
        }
        else{
            io.sockets.emit('broadcast', message);
        }
        console.log('message from client: ' + message);        
    });
});




/**
 * Iterates through clients and provides an comma delimited list which is 
 * broadcasted to each client for an up to date list of users
 * */
function updateUserList() {
    var clientList = "";
    for (var i = 0; i < clients.length; i++) 
    {
        if (i === 0) 
        {
            clientList = clients[i].name;
        }

        clientList = clientList + ',' + clients[i].name;
    }
    io.sockets.emit('updated user list', clientList);
}
