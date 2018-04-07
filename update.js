const fs = require('fs');
const request = require('request');

const raw_file = "games.json";
const updated_file = "updated_games.json";

const steam_list_api = `https://api.steampowered.com/ISteamApps/GetAppList/v2`;

const filtered_file = `filtered_games.json`;

const new_file = `updated_list.json`;

var base_game_list = fs.readFileSync(raw_file);
var base_game_obj = JSON.parse(base_game_list);
var base_app_list = base_game_obj.applist.apps;

var current_list = () => {
	return new Promise(async(resolve, reject) => {
		request({
			url: steam_list_api,
			json: true
		}, (error, response, body) => {
			if(error){
				reject(error);
			} else {
				resolve(body);
			}
		});
	})
}

var compare_app_lists = (old_obj, current_obj) => {
	console.log('Comparing Lists');
	var current_index = 0;

	var old_list = old_obj.applist.apps.slice();
	var current_list = current_obj.applist.apps.slice();

	var new_obj = {applist: {apps: []}};

	for(var index = 0; index < old_list.length ; index ++){
		var base_id = old_list[index].appid;
		var new_id = current_list[current_index].appid;
		console.log(`Comparing ${base_id} WITH ${new_id}`);
		if ( base_id != new_id){
			while(new_id != base_id && current_index < current_list.length){
				console.log(`Base: ${base_id}, New: ${new_id}`);
				new_obj.applist.apps.push(current_list[current_index]);
				current_index += 1;
				new_id = current_list[current_index].appid;
			}
		}
		current_index += 1;

	}

	while(current_index < current_list.length){
		new_obj.applist.apps.push(current_list[current_index]);
		current_index += 1;
	}
	return new_obj;
}

var main = () => {
	// current_list().then((result) => {
	// 	var current_list = Object.assign({}, result);
	// 	var old_list = JSON.parse(fs.readFileSync(filtered_file));

	// 	var new_obj = compare_app_lists( old_list, current_list);

	// 	fs.writeFileSync(new_file, JSON.stringify(new_obj, undefined, 2));




	// }).catch((error) => {
	// 	console.log(error);
	// });

	//console.log(JSON.parse(fs.readFileSync(new_file)).applist.apps.length);
}

main();
