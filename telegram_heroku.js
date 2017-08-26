// npm install express request body-parser --save

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');

var app = express();

var sessions = [];
var botConfig = {name:"XXXZap", url:"telegram", path:"./config.xml", 
				jid:{id:"11111", token:"AAAAAAAAAAA"},
				config:{returnText:"Back", returnOption:"B", mediaPath:""}};
var bot = null;
var token = botConfig.jid.id+":"+botConfig.jid.token;


app.set('port', (process.env.PORT || 443));

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.send('Hello world, I am a SPLIMBo chat bot')
});

app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
});

app.post('/', function (req, res) {
	//bot.processUpdate(req.body);
	//console.dir(req.body);
	require('./zapml_controller.js').evaluateMsg(bot, botConfig, req.body.message, sessions, 'telegram', sendMessage, receiveMessage);
	res.sendStatus(200);
});

function sendMessage (bot, userId, type, text, path){	
	console.log("sendMessage type:"+type+", userId:"+userId+", text:"+text+", path:"+path);
	
	try {
		if (type == "text" && text != "")
			sendTextMessage(userId, text);
		else if (path != "") 
			sendMediaMessage(userId, type, path);			
	}
	catch(err){
		console.log("ERROR after sendMessage type:"+type+", text:"+text+", path:"+path+". ERROR:"+err.message);
	}
};

function sendTextMessage(sender, text) {
    request({
	    url: 'https://api.telegram.org/bot'+token+'/sendMessage',
	    method: 'POST',
		json: {
		    chat_id: sender,
			text: text
		}
	}, function(error, response, body) {
		if (error) {
		    console.log('Error sending messages: ', error)
		} else if (response.body.error) {
		    console.log('Error: ', response.body.error)
	    }
    })
}

function sendMediaMessage(sender, type, path) {
	var url = "";
	var data = {chat_id: sender};
	if (type == "image"){
		url = "sendPhoto";
		data["photo"] = path;
	}
	else if (type == "audio"){
		url = "sendAudio";
		data["audio"] = path;
	}
	else if (type == "video"){
		url = "sendVideo";
		data["video"] = path;
	}
	else if (type == "voice"){
		url = "sendVoice";
		data["voice"] = path;
	}
	else if (type == "document"){
		url = "sendDocument";
		data["document"] = path;
	}
	
	request({
	    url: 'https://api.telegram.org/bot'+token+'/'+url,
	    method: 'POST',
		json: data
	}, function(error, response, body) {
		if (error) {
		    console.log('Error sending messages: ', error);
		} else if (response.body.error) {
		    console.log('Error: ', response.body.error);
	    }
    });	
}
	
function receiveMessage(bot, botConfig, msg, params){
	var file_id = null;
	if (msg.text){
		params.ext = "txt";
		params.text = msg.text;
	}
	else if (msg.location){
		params.ext = "loc";
		params.text = msg.location.latitude+","+msg.location.longitude;		
	}
	else if (msg.photo){
		//console.dir(msg);
		if (msg.photo[2] != undefined)
			file_id = msg.photo[2].file_id;	
		else if (msg.photo[1] != undefined)
			file_id = msg.photo[1].file_id;	
		else
			file_id = msg.photo[0].file_id;	
	}
	else if (msg.video){
		file_id = msg.video.file_id;					
	}
	else if (msg.audio){
		file_id = msg.audio.file_id;		
	}
	else if (msg.voice){
		file_id = msg.voice.file_id;			
	}
	else if (msg.document){
		file_id = msg.document.file_id;			
	}	
	
	if (file_id != null){
		request({
			url: 'https://api.telegram.org/bot'+token+'/getFile',
			method: 'POST',
			json: {file_id: file_id}
		}, function(error, response, body) {
			if (error) {
				console.log('Error sending messages: ', error)
			} else if (response.body.error) {
				console.log('Error: ', response.body.error)
			}
			else {
				var file_path = response.body.message.file_path;
				var file_url = "https://api.telegram.org/file/bot"+token+"/"+ file_path;
				params.ext = file_path.substr(file_path.lastIndexOf(".")+1,file_path.lastIndexOf(".")+4);
				params.path = ""+msg.from.id;// + "."+ params.ext;
				console.log("dest:"+params.path);
				
				require('./util.js').download(file_url, params.path, function(){
				  console.log('done');
				});
			}
		});	
	}
};