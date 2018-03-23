const express = require('express');
const request = require('request');
const hbs = require('hbs');
const fs = require('fs');
const _ = require('lodash');
const bodyParser = require('body-parser');
const serverPort = 8080;

// --------------------------------- MySQL RDS ---------------------------------
const config = require('./config.js');
var mysql = config.mysql;
var connection = config.connection;

connection.connect(function(err) {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }

  console.log('Connected to database with id: ' + connection.threadId);
});

var sql = 'SELECT * FROM users';

connection.query(sql, function(err, rows, fields) {
  if (err) throw err
});
// -----------------------------------------------------------------------------

var gamelist = fs.readFileSync('games.json');
var gameobj = JSON.parse(gamelist);

var app = express();
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
  extended: true
}));

// ----------------------------------- Helpers ---------------------------------
hbs.registerHelper('getCurrentYear', () => {
	return new Date().getFullYear();
})

hbs.registerHelper('message', (text) => {
	return text.toUpperCase();
})

hbs.registerHelper('apps', (context, options) => {
  var out = "<div id='wishlist'>";
  var items = [];

  for(var i=0, l=context.gamelist.length; i<l; i++) {
    current_game = context.gamelist[i].appid

    items = steam(current_game).then((result) => {
      var initial_price = parseInt(result.price_overview.initial);
      var disct_percentage = parseInt(result.price_overview.discount_percent);
      var current_price = (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2);
      var steam_name = `Game Name: ${result.name}`;
      var steam_price = `Current Price: $${current_price.toString()}`;
      var steam_discount = `Discount ${disct_percentage}%`;
      console.log([steam_name, steam_price, steam_discount]);
      return [steam_name, steam_price, steam_discount];
    });

    out = out+"<div class='game'><p>"+items[0]+"</p><p>"+items[1]+"</p><p>"+items[2]+"</p></div>";
  }
  return out + '</div>';
});

// ----------------------------------- Routes ----------------------------------
app.get('/', (request, response) => {
	response.render('index.hbs', {
		logo: 'Steam_logo.png',
		year: new Date().getFullYear(),
        failedAuth: false
	});
});

app.post('/', (request, response) => {
	var index = _.findIndex(gameobj['applist'].apps, function(o) {
    return o.name == request.body.game;
  });

	if (index != -1) {
		var appid = gameobj['applist'].apps[index].appid.toString();

		steam(appid).then((result) => {

			var initial_price = parseInt(result.price_overview.initial);
			var disct_percentage = parseInt(result.price_overview.discount_percent);
			var current_price =
        (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2);

			response.render('index.hbs', {
				logo: 'Steam_logo.png',
				year: new Date().getFullYear(),
                failedAuth: false,
				gamename: `Game Name: ${result.name}`,
				price: `Current Price: $${current_price.toString()}`,
				score: `Metacritic Score: ${result.metacritic.score}%`,
				discount: `Discount ${disct_percentage}%`
			});
		}).catch((error)=>{

		});
	} else {
		response.render('index.hbs', {
			logo: 'Steam_logo.png',
			year: new Date().getFullYear(),
			error: 'Game not found'
		});
	}
});

//app.get('/login', (request, response) => {
//	response.render('login.hbs', {
//        failedAuth: false
//    });
//});

app.get('/wishlist', (request, response) => {
  var query = 'SELECT * FROM wishlist WHERE uid = 1';

  connection.query(query, function(err, result, fields) {
    if (err) throw err
    response.render('wishlist.hbs', {
      gamelist: result
    });
  });
});

app.post('/loginAuth', (request, response) => {
    var input_name = request.body.username
    var input_pass = request.body.password
    var resultName = 'numMatch';
    var query = `SELECT count(*) AS ${resultName} FROM users WHERE username = '${input_name}' AND password = '${input_pass}'`;

    connection.query(query, function(err, result, fields) {
        if (err) throw err
        if (result[0][resultName] != 1){
            response.render('index.hbs', {
                logo: 'Steam_logo.png',
				year: new Date().getFullYear(),
                failedAuth: true,
            });
        } else {
            response.render('loginSuccess.hbs')
        }
    });
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
            url: 'http://store.steampowered.com/api/appdetails?appids='
                  + game_id,
            json: true
        }, (error, response, body) => {
        	var test = `body[${game_id}].data`;
        	resolve(eval(test));
        });
    })

};
