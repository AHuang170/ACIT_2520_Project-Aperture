const express = require('express');
const request = require('request');
// const bodyParser = require('body-parser');

var app = express();

// app.use(bodyParser.urlencoded({
//   extended: true
// }));

const serverPort = 8080;

app.use(express.static(__dirname + '/public'));

app.get('/', (request, response) => {
	response.sendFile(__dirname + '/public/index.html');
});

app.get('/login', (request, response) => {
	response.sendFile(__dirname + '/public/login.html');
});

app.use( (request, response) => {
	response.status(404);
	response.sendFile(__dirname + '/public/404.html');
});

app.listen(8080, () => {
    console.log(`Server is up on the port ${serverPort}`);
});