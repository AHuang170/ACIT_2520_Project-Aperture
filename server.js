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
    steam('20').then((result) => {
    	console.log('Success');
	}, (errorMessage) => {
	    console.log(errorMessage);
	});
});

var steam = (game_id) => {
    return new Promise((resolve, reject) => {
        request({
            url: 'http://store.steampowered.com/api/appdetails?appids=' + game_id,
            json: true
        }, (error, response, body) => {
            if (error) {
            	console.log('Error');
                reject('Cannot connect to Steam Store');
            } else if (body.status === 'OK') {
				console.log(body);
            }
        });
    })

};