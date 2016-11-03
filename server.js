
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

var path = require('path');
var async = require('async');

//Define static content for app to use.
app.use(express.static('client'));

/**
 * We define a route handler / that gets called when clients hit website home
 * will automatically search for and serve index from this directory.
 * */
app.get('/', function(request, response){
  response.sendfile(__dirname + '/client')
});

server.listen(8080, function(){
  console.log('listening on : 8080');
});

/**
 * Implement naming convention for connect and disconnect of each user
 * */
io.on('connection', function(socket){
  console.log('a user has connected');
  socket.on('disconnect', function(){
    console.log('a user has disconnected');
    });
});

/**
 * Listen for incoming messages from clients
 * */
 io.on('connection', function(socket){
   socket.on('message to server', function(message){
     console.log('message from client: ' + message);
   });
 });