const fs = require('fs');
const _ = require('lodash');
const request = require('request');

const old_file = "games.json";
const new_file = "filtered_games.json";

var gamelist = fs.readFileSync(old_file);
var gameobj = JSON.parse(gamelist);
var applist = gameobj.applist.apps;

var newGameList = {applist: {apps: []}};

var steam = (game_id) => {
  return new Promise((resolve, reject) => {
    request({
      url: `http://store.steampowered.com/api/appdetails?appids=${game_id}`,
      json: true
    }, (error, response, body) => {
      setTimeout(() => {
        if(error){
          reject(error);
        } else {
          var gameData = `body[${game_id}].data`;
          resolve(eval(gameData));
        }
    }, 1000);
    });
  });
}

(async function game_loop(){
  console.log(`Fetching data from ${old_file}, and saving new data to ${new_file}`);

  for (const item of applist){
    console.log(`Fetching data for: ${item.appid} - ${item.name}`);

    try{
        var result = await steam(item.appid);
    } catch (error) {
      console.log(error);
    }

    if (result != undefined){

      if (result["type"] == 'game'){
        newGameList.applist.apps.push(item);
      }
    }

  }
  console.log(`\n\n==========Fetching Complete==========\n\n`);
  var game_jsonData = JSON.stringify(newGameList, undefined, 2);
  fs.writeFileSync(new_file, game_jsonData, function(err){
    if(err){
      console.log(err);
    }
  })
})();
