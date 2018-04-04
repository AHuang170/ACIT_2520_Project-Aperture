const fs = require('fs');
const _ = require('lodash');
const request = require('request');

const old_file = "games.json";
const new_file = "filtered_games.json";

var gamelist = fs.readFileSync(old_file);
var gameobj = JSON.parse(gamelist);
var applist = gameobj.applist.apps;

var newGameList = {applist: {apps: []}};

(async function game_loop(){
  console.log(`Fetching data from ${old_file}, and saving new data to ${new_file}`);
  for (const item of applist){

    var result = await steam(item.appid);
    console.log(`Fetching data for: ${item.appid} - ${item.name}`);
    if (result != undefined){
      
      //game and DLC
      //if (result["type"] == 'game' || result["type" == 'dlc']){

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

function steam(game_id) {
  return new Promise((resolve, reject) => {
    request({
      url: `http://store.steampowered.com/api/appdetails?appids=${game_id}`,
      json: true
    }, (error, response, body) => {
      var gameData = undefined;
      if (body[game_id] != undefined){
        gameData = `body[${game_id}].data`;
      }

      resolve(eval(gameData));
    });
  });
}
