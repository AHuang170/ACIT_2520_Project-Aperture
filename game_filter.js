const fs = require('fs');
const request = require('request');

const old_file = "updated_list.json";
const new_file = "filtered_games_AU_pt2.json";

const start_index = 4001;
const end_index = 8000;

var gamelist = fs.readFileSync(old_file);
var gameobj = JSON.parse(gamelist);
var applist = gameobj.applist.apps;

var newGameList = {applist: {apps: []}};

var steam = (game_id) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {

      request({
        url: `http://store.steampowered.com/api/appdetails?appids=${game_id}`,
        json: true
      }, (error, response, body) => {

        if(error){
          reject(error);
        } else {
          console.log(response.status);
          if (body != undefined){
            if (body[game_id] != undefined){
              resolve(body[game_id].data);
            } else {
              resolve(undefined);
            }
          } else {
            resolve(undefined);
          }
        }

      });

    }, 1000);
  });
}

(async function game_loop(){
  console.log(`Fetching data from ${old_file}, and saving new data to ${new_file}`);
  var index = start_index;
  for (var index = start_index; index <= end_index; index++){

    var item = applist[index];
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
