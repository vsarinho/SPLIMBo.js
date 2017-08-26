'use strict'

// npm install express request body-parser --save

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

const VERIFICATION_TOKEN = 'facebook_monitor_verification_token'


app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a SPLIMBo chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === VERIFICATION_TOKEN) {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})

var sessions = [];
var botConfig = {name:"XXXZap", url:"facebook", path:"./config.xml", 
		 jid:{id:"XXXZap", token:"EEESSSAAA"},
		 config:{returnText:"Back", returnOption:"B", mediaPath:""}};
var bot = null;

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging;
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i];
        let sender = event.sender.id;
        if (event.message){
			if (event.message.text) {
				let text = event.message.text;
				require('./zapml_controller.js').
					evaluateMsg(bot, botConfig, {"text":text, "from":{"id":sender}}, 
						sessions, 'facebook', sendMessage, receiveMessage);				
			}
			else if (event.message.attachments) {
				var type = event.message.attachments[0].type;

				if (type == "location"){
					var lat = event.message.attachments[0].payload.coordinates.lat;
					var lng = event.message.attachments[0].payload.coordinates.long;
					
					console.log("type:"+type+", lat:"+lat+", lng:"+lng);
					
					require('./zapml_controller.js').
						evaluateMsg(bot, botConfig, {"type":type, "lat":lat, "lng":lng, "from":{"id":sender}}, 
							sessions, 'facebook', sendMessage, receiveMessage);
				}
				else {
					var path = event.message.attachments[0].payload.url;
					
					console.log("type:"+type+", path:"+path);
					
					require('./zapml_controller.js').
						evaluateMsg(bot, botConfig, {"type":type, "path":path, "from":{"id":sender}}, 
							sessions, 'facebook', sendMessage, receiveMessage);
				}
				
				
			}
		}
    }
    res.sendStatus(200)
})

function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
	    url: 'https://graph.facebook.com/v2.6/me/messages',
	    qs: {access_token:botConfig.jid.token},
	    method: 'POST',
		json: {
		    recipient: {id:sender},
			message: messageData,
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
	let messageData = { "attachment": {
		  "type": type,
		  "payload": {
			"url": path,
			"is_reusable": true
		  }
		} 
	  }
	request({
	    url: 'https://graph.facebook.com/v2.6/me/messages',
	    qs: {access_token:botConfig.jid.token},
	    method: 'POST',
		json: {
		    recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
		    console.log('Error sending messages: ', error)
		} else if (response.body.error) {
		    console.log('Error: ', response.body.error)
	    }
    })
}

function sendMessage (bot, userId, type, text, path){	
	console.log("sendMessage type:"+type+", userId:"+userId+", path:"+path);
	
	try {
		if (type == "text"){	
			if (text != "") sendTextMessage(userId, text);
		}
		else if (type == "image"){
			if (path != "") sendMediaMessage(userId, type, path);
		}
		else if (type == "audio"){
			if (path != "") sendMediaMessage(userId, type, path);
		}
		else if (type == "video"){
			if (path != "") sendMediaMessage(userId, type, path);
		}
		else if (type == "voice"){
			if (path != "") sendMediaMessage(userId, type, path);
		}
		else if (type == "document"){
			if (path != "") sendMediaMessage(userId, "file", path);		
		}
	}
	catch(err){
		console.log("sendMessage type:"+type+", path:"+path+". ERROR:"+err.message);
	}
};
	
function receiveMessage(bot, botConfig, msg, params){
	if (msg.text){
		params.ext = "txt";
		params.text = msg.text;
	}
	else if (msg.type){
		if (msg.type == "location"){
			params.ext = "loc";
			params.text = msg.lat+","+msg.lng;	
		}
		else if (msg.path){
			params.ext = msg.path.substr(msg.path.lastIndexOf(".")+1,msg.path.lastIndexOf(".")+4);
			params.path = ""+msg.from.id;
			console.log("dest:"+params.path);
			
			require('./util.js').download(msg.path, params.path, function(){
			  console.log('done');
			});
		}
	}		
};
