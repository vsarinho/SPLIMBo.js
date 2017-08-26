const TeleBot = require('telebot');

exports.startMonitoring = function(botConfig, sessions){
	var bot = null;
	
	if (botConfig.webhook !== null && botConfig.webhook !== undefined)
		bot = new TeleBot({"token":botConfig.jid.id+":"+botConfig.jid.token, "webhook":botConfig.webhook});
	else
		bot = new TeleBot(botConfig.jid.id+":"+botConfig.jid.token);
	
	console.log("startMonitoring "+botConfig.jid.id+":"+botConfig.jid.token);
	bot.on('*', (msg) => {			
		require('./zapml_controller.js').evaluateMsg(bot, botConfig, msg, sessions, 'telegram', sendMessage, receiveMessage);
	});
	
	bot.start();
};	

function sendMessage (bot, userId, type, text, path){	
	console.log("sendMessage type:"+type+", userId:"+userId+", path:"+path);
	
	try {
		if (type == "text"){	
			if (text != "") bot.sendMessage(userId, text);
		}
		else if (type == "image"){
			if (path != "") bot.sendPhoto(userId, path);
		}
		else if (type == "audio"){
			if (path != "") bot.sendAudio(userId, path);
		}
		else if (type == "video"){
			if (path != "") bot.sendVideo(userId, path);
		}
		else if (type == "voice"){
			if (path != "") bot.sendVoice(userId, path);
		}
		else if (type == "document"){
			if (path != "") bot.sendDocument(userId, path);			
		}
	}
	catch(err){
		console.log("sendMessage type:"+type+", path:"+path+". ERROR:"+err.message);
	}
};
	
function receiveMessage(bot, botConfig, msg, params){
	var file_id = null;
	
	if (msg.hasOwnProperty('text')){
		params.ext = "txt";
		params.text = msg.text;
	}
	else if (msg.hasOwnProperty('location')){
		params.ext = "loc";
		params.text = msg.location.latitude+","+msg.location.longitude;		
	}
	else if (msg.hasOwnProperty('photo')){
		//console.dir(msg);
		if (msg.photo[2] != undefined)
			file_id = msg.photo[2].file_id;	
		else if (msg.photo[1] != undefined)
			file_id = msg.photo[1].file_id;	
		else
			file_id = msg.photo[0].file_id;	
	}
	else if (msg.hasOwnProperty('video')){
		file_id = msg.video.file_id;					
	}
	else if (msg.hasOwnProperty('audio')){
		file_id = msg.audio.file_id;		
	}
	else if (msg.hasOwnProperty('voice')){
		file_id = msg.voice.file_id;			
	}
	else if (msg.hasOwnProperty('document')){
		file_id = msg.document.file_id;			
	}	
	
	if (file_id != null)
		bot.request(`/getFile`, {file_id}).then(file => {
            const result = file.result;
            result.fileLink = this.fileLink + result.file_path;
			
			var url = "https://api.telegram.org/file/bot"+botConfig.jid.id+":"+botConfig.jid.token+"/"+ result.file_path;
			console.log("url:"+url);
			
			params.ext = result.file_path.substr(result.file_path.lastIndexOf(".")+1,result.file_path.length);
			params.path = ""+msg.from.id;// + "."+ params.ext;
			console.log("dest:"+params.path);
			
			require('./util.js').download(url, params.path, function(){
			  console.log('done');
			});
        });
};
