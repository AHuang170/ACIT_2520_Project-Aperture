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

var gamelist = fs.readFileSync('filtered_games.json');
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

hbs.registerHelper('searchResults', (list) => {
  var out = '';
  for (var index in list.searchList) {
    out = out+`<a href="/fetchDetails?n=${list.searchList[index]}">${list.searchList[index]}</a><br>`;
  }
  return out;
})

// ----------------------------------- Routes ----------------------------------
app.get('/', (request, response) => {

  var target_id = -1;
  if (request.session.uid != undefined) {
    target_id = request.session.uid;
  }
  var query = `SELECT * FROM wishlist WHERE uid = ${target_id}`;
  connection.query(query, function(err, queryResult, fields){
    var returnList = [];

    game_loop(queryResult).then((result) => {
      request.session.wishlist = result;

      response.render('index.hbs', {
        gameList: request.session.wishlist,
        year: new Date().getFullYear(),
        loggedIn: request.session.loggedIn,
        userName: request.session.userName,
      });
    }).catch((error) => {
      serverError(response, error);
    });
  });
});

app.post('/', (request, response) => {
  if(request.body.game == ''){
    response.render('index.hbs', {
        gameList: request.session.wishlist,
        year: new Date().getFullYear(),
        loggedIn: request.session.loggedIn,
        userName: request.session.userName
    })
  } else {
    var index = _.findIndex(gameobj['applist'].apps, function(o) {
      return o.name == request.body.game;
    });

    if (index != -1) {
      var appid = gameobj['applist'].apps[index].appid.toString();
      request.session.appid = appid;

      steam(appid).then((result) => {

        var initial_price = parseInt(result.price_overview.initial);
        var disct_percentage = parseInt(result.price_overview.discount_percent);
        var current_price = '$'+
          (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2).toString();

        response.render('index.hbs', {
          gameList: request.session.wishlist,
          year: new Date().getFullYear(),
          loggedIn: request.session.loggedIn,
          userName: request.session.userName,
          gamename: `Game Name: ${result.name}`,
          price: `Current Price: ${current_price}`,
          // score: `Metacritic Score: ${result.metacritic.score}%`,
          discount: `Discount ${disct_percentage}%`,
          displayDetails: true
        });
      }).catch((error)=>{
          console.log(error);
      });
    } else {
      //_.replace([string=''], pattern, replacement)

      // var gnQuery = _.replace(request.body.game, ' ', '');
      var result = subsearch.search({
        rank: subsearch.transforms.rank('name'),
        noHighlight: subsearch.transforms.noHighlight,
      }, dataList, request.body.game);
      var gameList = [];
      var maxItem = result.data.length;
      if (maxItem > 10){
        maxItem = 10;
      }
      for(i=0; i<maxItem; i++) {

        var gameName = result.data[i].name;
        gameList.push(gameName);
      }
      response.render('index.hbs', {
        gameList: request.session.wishlist,
        year: new Date().getFullYear(),
        loggedIn: request.session.loggedIn,
        userName: request.session.userName,
        distype: "block",
        searchList: gameList,
        error: "Game not found.  Select from closest results."
      });
    }
  }
});

app.get('/fetchDetails', (request, response) => {
  var index = _.findIndex(gameobj['applist'].apps, function(o) {
    return o.name == request.query.n;
  });

  if (index != -1) {
    var appid = gameobj['applist'].apps[index].appid.toString();
    request.session.appid = appid;

    steam(appid).then((result) => {

      var initial_price = parseInt(result.price_overview.initial);
      var disct_percentage = parseInt(result.price_overview.discount_percent);

      var final_price = (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2).toString();

      var current_price = `$${final_price}`;

      response.render('index.hbs', {
        gameList: request.session.wishlist,
        year: new Date().getFullYear(),
        failedAuth: false,
        loggedIn: request.session.loggedIn,
        userName: request.session.userName,
        gamename: `Game Name: ${result.name}`,
        price: `Current Price: ${current_price}`,
        // score: `Metacritic Score: ${result.metacritic.score}%`,
        discount: `Discount ${disct_percentage}%`,
        displayDetails: true
      });
    }).catch((error)=>{
        console.log(error);
    });
  }
});

app.post('/loginAuth', (request, response) => {
    var input_name = request.body.username
    var input_pass = request.body.password
    var resultName = 'numMatch';
    var query = `SELECT * FROM users WHERE username = '${input_name}'`;

    var empty_field = (input_name == '' || input_pass == '');

    connection.query(query, function(err, result, fields) {
        if (err) throw err

        if (result.length != 1){
          request.session.loggedIn = false;
            response.render('index.hbs', {
				        year: new Date().getFullYear(),
                failedAuth: true,
                emptyField: empty_field,
                loggedIn: request.session.loggedIn,
            });
        } else {
          var hashed_pass = result[0]["password"];

          bcrypt.compare(input_pass, hashed_pass).then(function(authenticated){
            if(authenticated){

              request.session.loggedIn = true;
              request.session.userName = input_name;
              request.session.uid = result[0]["uid"];

              var wishlistQuery = `SELECT * FROM wishlist WHERE uid = ${request.session.uid}`;
              connection.query(wishlistQuery, function(err, queryResult, fields){

                game_loop(queryResult).then((result) => {
                  request.session.wishlist = result;

                  response.render('index.hbs', {
                    gameList: request.session.wishlist,
                    year: new Date().getFullYear(),
                    loggedIn: request.session.loggedIn,
                    userName: request.session.userName,
                  });
                }).catch((error) => {
                  serverError(response, error);
                })
              });
            } else {
              request.session.loggedIn = false;
                response.render('index.hbs', {
                year: new Date().getFullYear(),
                failedAuth: true,
                loggedIn: request.session.loggedIn,
              });
            }
          }).catch((error) => {
            serverError(response, error);
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
  response.render('acc_create.hbs', {
    creatingUser: true,
    noLogIn: true
  });
});

app.post('/createUser', (request, response) => {

  var input_user_name = request.body.acc_name;
  var input_user_pass = request.body.acc_pass;
  var input_dupe_pass = request.body.rpt_pass;
  var weak_pass = input_user_pass.length < 8;
  var short_name = input_user_name.length < 6;
  var pass_space = input_user_pass.indexOf(" ") != -1;
  var containsSpace = input_user_name.indexOf(" ") != -1;
  var pw_mismatch = input_user_pass != input_dupe_pass;
  var resultName = 'numName';

  alreadyExists(input_user_name, resultName).then((result) => {
    if (weak_pass || weak_pass || short_name || pass_space || containsSpace || pw_mismatch){
      response.render('acc_create.hbs', {
        mismatch: pw_mismatch,
        shortName: short_name,
        hasSpace: containsSpace,
        duplicateName: result,
        weakPass: weak_pass,
        spacePass: pass_space,
        noLogIn: true
      });
    } else {
      bcrypt.hash(input_user_pass, saltRounds).then((hash) => {
        var addQ = `INSERT INTO users (uid, username, password) VALUES (NULL, '${input_user_name}', '${hash}');`;
        connection.query(addQ, function(err, result, fields){
          if (err) throw err;
          response.render('acc_created.hbs', {
            noLogin: true
          });
        });
      }).catch((error) => {
        serverError(response, error);
      });
    }
  }).catch((error) => {
    serverError(response, error);
  });
})

app.post('/addToWishlist', (request, response) => {
  // Step 1 - Check if a user is logged in. If not, ask them to log in
  if (request.session.loggedIn != true) {
    response.render('index.hbs', {
      year: new Date().getFullYear(),
      loggedIn: request.session.loggedIn,
      error: `Please login first to add to wishlist.`
    });
  } else if(request.session.loggedIn === true){


    // Pre-Step 2 - check for duplicate entry
    var chkQuery = `SELECT * FROM wishlist WHERE uid = ${request.session.uid} AND appid = ${request.session.appid}`;

    connection.query(chkQuery, function(err, result, fields) {
      if (err) throw err

      var duplicate = (result.length != 0);

      // Step 2 - Write the game id to the database with their userid
      if (!duplicate){
        var addQuery = `INSERT INTO wishlist (uid, appid) VALUES (${request.session.uid}, ${request.session.appid})`;
        connection.query(addQuery, function(err, result, fields) {
          if (err) throw err
        });
      }

      // Step 3 - Get all their games from the database, and update the wishlist
      var wishlistQuery = `SELECT * FROM wishlist WHERE uid = ${request.session.uid}`;
      connection.query(wishlistQuery, function(err, queryResult, fields){
        var returnList = [];

        game_loop(queryResult).then((result) => {
          request.session.wishlist = result;

          response.render('index.hbs', {
            gameList: request.session.wishlist,
            year: new Date().getFullYear(),
            loggedIn: request.session.loggedIn,
            userName: request.session.userName,
            badAdd: duplicate
          });
        }).catch((error) => {
          serverError(response, error);
        });
      });

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

var steam = (game_id) => {
  return new Promise((resolve, reject) => {
    request({
      url: `http://store.steampowered.com/api/appdetails?appids=${game_id}`,
      json: true
    }, (error, response, body) => {
      if(error){
        reject(error);
      } else {

        var gameData = Object.assign({}, body[game_id].data);

        if(gameData.price_overview == undefined){
          gameData.price_overview = {
            initial: 0,
            discount_percent: 0
          };
        }

        resolve(eval(gameData));
      }
    });
  });
}

var serverError = (response, errorMsg) => {
  console.log(errorMsg);
  response.status(500);
  response.render('500.hbs');
}

var alreadyExists = (input_user_name, resultName) => {
  return new Promise((resolve, reject) => {
    var nameQuery = `SELECT count(*) AS ${resultName} FROM users WHERE username = '${input_user_name}'`;
    var queryResult = false;

    connection.query(nameQuery, function(err, result, fields) {
        if (err) {
          reject(err);
        }
        if (result[0][resultName] != 0){
          queryResult = true;
        }
        resolve(queryResult);
    });
  })
}

var game_loop = (queryResult) => {
  return new Promise (async (resolve, reject) => {
    var returnList = [];

    for (const item of queryResult){
      try{
          var steam_result = await steam(item.appid);
      }
      catch (error) {
        reject(error);
      }

      var initial_price = parseInt(steam_result.price_overview.initial);
      var disct_percentage = parseInt(steam_result.price_overview.discount_percent);
      var current_price = (initial_price * (1 - (disct_percentage / 100))/100).toFixed(2);
      var steam_name = `Game Name: ${steam_result.name}`;
      var steam_price = `Current Price: $${current_price.toString()}`;
      var steam_discount = `Discount ${disct_percentage}%`;

      returnList.push([steam_name, steam_price, steam_discount]);

    }
    resolve(returnList);
  })
}
