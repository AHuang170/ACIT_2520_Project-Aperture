const express = require('express');
const request = require('request');
const hbs = require('hbs');
const fs = require('fs');
const _ = require('lodash');
const bodyParser = require('body-parser');
const serverPort = 8080;

var gamelist = fs.readFileSync('games.json');
var gameobj = JSON.parse(gamelist);

var app = express();
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
  extended: true
}));

hbs.registerHelper('getCurrentYear', () => {
	return new Date().getFullYear();
})

hbs.registerHelper('message', (text) => {
	return text.toUpperCase();
})

app.get('/', (request, response) => {
	steam('20').then((result)=>{
		response.render('index.hbs', {
			game_name: result,
			logo: 'Steam_logo.png',
			year: new Date().getFullYear()
		});
	}).catch((error)=>{
		response.render('index.hbs');
	})
});

app.post('/', (request, response) => {
	var index = _.findIndex(gameobj['applist'].apps, function(o) { return o.name == request.body.game; });
	console.log(gameobj['applist'].apps[index]);
})

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

var steam = (game_id) => {
    return new Promise((resolve, reject) => {
        request({
            url: 'http://store.steampowered.com/api/appdetails?appids=' + game_id,
            json: true
        }, (error, response, body) => {
        	var test = `body[${game_id}].data.name`;
        	resolve(eval(test));
        });
    })

};