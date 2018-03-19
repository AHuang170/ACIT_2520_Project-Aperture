const express = require('express');
const request = require('request');
const hbs = require('hbs');
const serverPort = 8080;

var app = express();

app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/public'));

app.get('/', (request, response) => {
	response.render('index.hbs');
});

app.get('/login', (request, response) => {
	response.render('login.hbs');
});

app.use( (request, response) => {
	response.status(404);
	response.render('404.hbs');
});

app.listen(8080, () => {
    console.log(`Server is up on the port ${serverPort}`);
});