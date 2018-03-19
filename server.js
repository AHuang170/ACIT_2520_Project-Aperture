const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.urlencoded({
  extended: true
}));

const serverPort = 8080;



app.use(express.static(__dirname + '/public'));

app.get('/', (request, response) => {
	response.redirect(`http://localhost:${serverPort}/login.html`);
});


app.listen(8080, () => {
    console.log(`Server is up on the port ${serverPort}`);
});