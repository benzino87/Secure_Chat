/**
 * Initializes app to be a function handler that you can supply to an HTTP server
 * */
var app = require('express')();
var http = require('http').Server(app);

/**
 * We define a route handler / that gets called when clients hit website home
 * */
app.get('/', function(req, res){
  res.sendfile('/client/index.html');
});

/**
 * Make the http server listen on port 8080
 * */
http.listen(8080, function(){
  console.log('listening on : 8080');
});