const express = require('express');
const request = require('request');
const hbs = require('hbs');
const serverPort = 8080;

var app = express();
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/public'));

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
			year: new Date().getFullYear()
		});
	}).catch((error)=>{
		response.render('index.hbs'});
	})
});

app.post('/', (request, response) => {
	console.log('Request received');

	console.log('Finding game...');

	// Look in games.json
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