const express = require('express');
const request = require('request');
const hbs = require('hbs');
const fs = require('fs');
const _ = require('lodash');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const subsearch = require('subsequence-search');
const bcrypt = require('bcrypt');
const serverPort = 8080;

const saltRounds = 10;


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
var dataList = {};
dataList['data'] = gameobj.applist.apps;
dataList['searchInProps'] = ['name'];

var app = express();
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieSession({
  name: 'steamWisklistSession',
  secret: 'uBE9Lz6pBC'
}));

// ----------------------------------- Helpers ---------------------------------
hbs.registerHelper('getCurrentYear', () => {
	return new Date().getFullYear();
})

hbs.registerHelper('message', (text) => {
	return text.toUpperCase();
})

hbs.registerHelper('apps', (list) => {
  var titleList = list.gameList;
  var out = '';
  for (var item in titleList) {
    if (titleList[item][2] === 'Discount 0%') {
      out = out+"<div class='game shadow'><p>"+titleList[item][0]+"</p><p>"+titleList[item][1]+"</p><p>"+titleList[item][2]+"</p></div>";
    } else {
      out = out+"<div class='game_sale shadow'><p>"+titleList[item][0]+"</p><p>"+titleList[item][1]+"</p><p>"+titleList[item][2]+"</p></div>";
    }
  }
  return out;
});

// ----------------------------------- Routes ----------------------------------
app.get('/', (request, response) => {
  var target_id = -1;
  if (request.session.uid != undefined) {
    target_id = request.session.uid;
  }
  var query = `SELECT * FROM wishlist WHERE uid = ${target_id}`;
  connection.query(query, function(err, queryResult, fields){
    var returnList = [];
    (async function game_loop(){
      for (const item of queryResult){
        var steam_result = await steam(item.appid);
        var initial_price = parseInt(steam_result.price_overview.initial);
        var disct_percentage = parseInt(steam_result.price_overview.discount_percent);
        var current_price = (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2);
        var steam_name = `Game Name: ${steam_result.name}`;
        var steam_price = `Current Price: $${current_price.toString()}`;
        var steam_discount = `Discount ${disct_percentage}%`;
        returnList.push([steam_name, steam_price, steam_discount]);
      }
      request.session.wishlist = returnList;
      // console.log
      response.render('index.hbs', {
        gameList: request.session.wishlist,
        year: new Date().getFullYear(),
        loggedIn: request.session.loggedIn,
        userName: request.session.userName,
        failedAuth: false
      });
    })();
  });
});

app.post('/', (request, response) => {
	var index = _.findIndex(gameobj['applist'].apps, function(o) {
    return o.name == request.body.game;
  });

	if (index != -1) {
		var appid = gameobj['applist'].apps[index].appid.toString();
    request.session.appid = appid;

		steam(appid).then((result) => {
      if(result.is_free == true){
        var current_price = 'Free';
      } else {
        var initial_price = parseInt(result.price_overview.initial);
  			var disct_percentage = parseInt(result.price_overview.discount_percent);
  			var current_price = '$'+
          (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2).toString();
      }
			response.render('index.hbs', {
        gameList: request.session.wishlist,
				year: new Date().getFullYear(),
        failedAuth: false,
        loggedIn: request.session.loggedIn,
        userName: request.session.userName,
				gamename: `Game Name: ${result.name}`,
				price: `Current Price: ${current_price}`,
				// score: `Metacritic Score: ${result.metacritic.score}%`,
				discount: `Discount ${disct_percentage}%`
			});
		}).catch((error)=>{
        console.log(error);
		});
	} else {
    var result = subsearch.search({
      rank: subsearch.transforms.rank('name'),
      noHighlight: subsearch.transforms.noHighlight,
    }, dataList, request.body.game);
    var gameList ='';
    for(i=0; i<10; i++) {
      gameList += `${result.data[i].name} `;
    }
		response.render('index.hbs', {
			year: new Date().getFullYear(),
      loggedIn: request.session.loggedIn,
			error: gameList
		});
	}
});

app.post('/loginAuth', (request, response) => {
    var input_name = request.body.username
    var input_pass = request.body.password
    var resultName = 'numMatch';
    var query = `SELECT * FROM users WHERE username = '${input_name}'`;

    connection.query(query, function(err, result, fields) {
        if (err) throw err

        if (result.length != 1){
          request.session.loggedIn = false;
            response.render('index.hbs', {
				        year: new Date().getFullYear(),
                failedAuth: true,
                loggedIn: request.session.loggedIn,
            });
        } else {
          // loggedIn: request.session.loggedIn = true;
          var hashed_pass = result[0]["password"];
          
          bcrypt.compare(input_pass, hashed_pass).then(function(authenticated){
            if(authenticated){
              
              request.session.loggedIn = true;
              request.session.userName = input_name;
              request.session.uid = result[0]["uid"];

              var wishlistQuery = `SELECT * FROM wishlist WHERE uid = ${request.session.uid}`;
              connection.query(wishlistQuery, function(err, queryResult, fields){
                var returnList = [];
                (async function game_loop(){
                  for (const item of queryResult){
                    var steam_result = await steam(item.appid);
                    var initial_price = parseInt(steam_result.price_overview.initial);
                    var disct_percentage = parseInt(steam_result.price_overview.discount_percent);
                    var current_price = (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2);
                    var steam_name = `Game Name: ${steam_result.name}`;
                    var steam_price = `Current Price: $${current_price.toString()}`;
                    var steam_discount = `Discount ${disct_percentage}%`;
                    returnList.push([steam_name, steam_price, steam_discount]);
                  }
                  request.session.wishlist = returnList;
                  // console.log
                  response.render('index.hbs', {
                    gameList: request.session.wishlist,
                    year: new Date().getFullYear(),
                    loggedIn: request.session.loggedIn,
                    userName: request.session.userName,
                    failedAuth: false
                  });
                })();
              });
            } else {
              request.session.loggedIn = false;
                response.render('index.hbs', {
                year: new Date().getFullYear(),
                failedAuth: true,
                loggedIn: request.session.loggedIn,
              });
            }
            
          });
        }
    });
});

app.get('/logout', (request, response) => {
  request.session = null;
  response.render('index.hbs', {
		year: new Date().getFullYear(),
	});
});

app.get('/accCreate', (request, response) => {
  response.render('acc_create.hbs');
});

app.post('/createUser', (request, response) => {

  var input_user_name = request.body.acc_name;
  var input_user_pass = request.body.acc_pass;
  var weak_pass = input_user_pass.length < 8;
  var short_name = input_user_name.length < 6
  var pass_space = input_user_pass.indexOf(" ") != -1;
  var containsSpace = input_user_name.indexOf(" ") != -1;
  var resultName = 'numName'

  var alreadyExists = new Promise (function(resolve, reject){
    var nameQuery = `SELECT count(*) AS ${resultName} FROM users WHERE username = '${input_user_name}'`;
    var queryResult = false;
    connection.query(nameQuery, function(err, result, fields) {
        if (err) throw err
        if (result[0][resultName] != 0){
          queryResult = true;

        }
        resolve(queryResult);
    });
  });

  alreadyExists.then(function(duplicate){
    if (duplicate || weak_pass || pass_space || short_name || containsSpace){
      response.render('acc_create.hbs', {
        shortName: short_name,
        hasSpace: containsSpace,
        duplicateName: duplicate,
        weakPass: weak_pass,
        spacePass: pass_space
      });
    } else {
      bcrypt.hash(input_user_pass, saltRounds).then(function (hash){
        var addQ = `INSERT INTO users (uid, username, password) VALUES (NULL, '${input_user_name}', '${hash}');`;
        connection.query(addQ, function(err, result, fields) {
          if (err) throw err
          response.render('placeholder.hbs')
        });
      });
      
    }
  });
})

app.post('/addToWishlist', (request, response) => {
  // Step 1 - Check if a user is logged in. If not, ask them to log in
  if (request.session.loggedIn == false) {
    response.render('index.hbs', {
      year: new Date().getFullYear(),
      failedAuth: true,
      loggedIn: request.session.loggedIn,
    });
  } else {

    // Step 2 - Write the game id to the database with their userid
    var addQuery = `INSERT INTO wishlist (uid, appid) VALUES (${request.session.uid}, ${request.session.appid})`;
    connection.query(addQuery, function(err, result, fields) {
      if (err) throw err
    });

    // Step 3 - Get all their games from the database, and update the wishlist
    var wishlistQuery = `SELECT * FROM wishlist WHERE uid = ${request.session.uid}`;
    connection.query(wishlistQuery, function(err, queryResult, fields){
      var returnList = [];
      (async function game_loop(){
        for (const item of queryResult){
          var steam_result = await steam(item.appid);
          var initial_price = parseInt(steam_result.price_overview.initial);
          var disct_percentage = parseInt(steam_result.price_overview.discount_percent);
          var current_price = (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2);
          var steam_name = `Game Name: ${steam_result.name}`;
          var steam_price = `Current Price: $${current_price.toString()}`;
          var steam_discount = `Discount ${disct_percentage}%`;
          returnList.push([steam_name, steam_price, steam_discount]);
        }
        request.session.wishlist = returnList;
        // console.log
        response.render('index.hbs', {
          gameList: request.session.wishlist,
          year: new Date().getFullYear(),
          loggedIn: request.session.loggedIn,
          userName: request.session.userName,
          failedAuth: false
        });
      })();
    });
  }
});

app.use((request, response) => {
	response.status(404);
	response.render('404.hbs');
});

app.listen(8080, () => {
    console.log(`Server is up on the port ${serverPort}`);
});

function steam(game_id) {
  return new Promise((resolve, reject) => {
    request({
      url: `http://store.steampowered.com/api/appdetails?appids=${game_id}`,
      json: true
    }, (error, response, body) => {
      var gameData = `body[${game_id}].data`;
      resolve(eval(gameData));
    });
  });
}
