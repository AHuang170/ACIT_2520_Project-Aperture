const express = require('express');
const request = require('request');


const serverPort = 8080;

var app = express();

app.use(express.static(__dirname + '/public'));

app.get('/', (request, response) => {
	response.redirect(`http://localhost:${serverPort}/login.html`);
});


app.listen(8080, () => {
    console.log(`Server is up on the port ${serverPort}`);
});