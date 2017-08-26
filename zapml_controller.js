const DEBUG = true;
const EXPIRATION_TIME = 10;

const util = require('./util.js');
const xml = require('./zapml_parser.js');

exports.evaluateMsg = function (bot, botConfig, msg, sessions, urlClient, _sendMessage, _receiveMessage){
	// if the first session was created
	if (sessions.length > 0){
		var session = null;
		
		var timeLimitToExpire = new Date();
		timeLimitToExpire.setMinutes(timeLimitToExpire.getMinutes() - EXPIRATION_TIME);
							
		// look for available and not expired sessions
		for (j in sessions)
			if ((sessions[j].id == botConfig.jid.id) && (sessions[j].userId == msg.from.id) && 
				(timeLimitToExpire.getTime() <= sessions[j].date.getTime())){
				session = sessions[j];			
			}
		
		// perform msg with found session or create a new one
		if (session !== null) {
			console.log("Session found at "+((new Date()).toLocaleString())+". "+
						"BotName:"+ botConfig.name+ "; UserId:"+session.userId);
			session.date = new Date();
			
			var params = {text:"", ext:"", path:""};
			_receiveMessage(bot, botConfig, msg, params);
			perform(session, bot, params.text, params.path, params.ext);					
		}
		else {
			console.log("New session loaded at "+((new Date()).toLocaleString())+". "+
						"BotName:"+ botConfig.name+ "; UserId:"+msg.from.id);
						
			var zapml = null;
			if (util.getExt(botConfig.path) == "xml")
				xml.loadXMLConfig(botConfig.path, function (zapml) {
					var _execution = {zapml:zapml, optionParents:[], variables:{"jidUrlClient":urlClient}, sendMessage:_sendMessage};
					session = {id:botConfig.jid.id, userId:msg.from.id, date:new Date(), 
									botConfig:botConfig, execution:_execution};
					sessions.push(session);
					
					var params = {text:"", ext:"", path:""};
					_receiveMessage(bot, botConfig, msg, params);
					
					perform(session, bot, params.text, params.path, params.ext);
				});
			else {
				zapml = require(botConfig.path).zapml;
			
				var _execution = {zapml:zapml, optionParents:[], variables:{"jidUrlClient":urlClient}, sendMessage:_sendMessage};
				session = {id:botConfig.jid.id, userId:msg.from.id, date:new Date(), 
								botConfig:botConfig, execution:_execution};
				sessions.push(session);
				
				var params = {text:"", ext:"", path:""};
				_receiveMessage(bot, botConfig, msg, params);
			
				perform(session, bot, params.text, params.path, params.ext);									
			}
		}
	}
	else {		
		// create the first session
		console.log("First session loaded at "+((new Date()).toLocaleString())+". "+
					"BotName:"+ botConfig.name+ "; UserId:"+msg.from.id);
		
		var zapml = null;
		if (util.getExt(botConfig.path) == "xml")
			xml.loadXMLConfig(botConfig.path, function (zapml) {
				var _execution = {zapml:zapml, optionParents:[], variables:{"jidUrlClient":urlClient}, sendMessage:_sendMessage};
				session = {id:botConfig.jid.id, userId:msg.from.id, date:new Date(), 
									botConfig:botConfig, execution:_execution};
				sessions.push(session);
				
				var params = {text:"", ext:"", path:""};
				_receiveMessage(bot, botConfig, msg, params);
				perform(session, bot, params.text, params.path, params.ext);
			});
		else {
			zapml = require(botConfig.path).zapml;
		
			var _execution = {zapml:zapml, optionParents:[], variables:{"jidUrlClient":urlClient}, sendMessage:_sendMessage};
			session = {id:botConfig.jid.id, userId:msg.from.id, date:new Date(), 
								botConfig:botConfig, execution:_execution};
			sessions.push(session);
			
			var params = {text:"", ext:"", path:""};
			_receiveMessage(bot, botConfig, msg, params);
			perform(session, bot, params.text, params.path, params.ext);
		}
	}
};


function perform(session, bot, message, media, extension){
	var e = session.execution;
	
	// if execution == null then startup execution data and perform it again
	if ((e.variables["currentOption"] === null || e.variables["currentOption"] === undefined) && e.zapml.length > 1){
		// get the first ZapML Option after path attribute
		//console.dir(e.zapml);
		e.variables["currentPath"] = e.zapml[0].path;
		e.variables["backInCurrentSequence"] = false;
		e.variables["currentOption"] = e.zapml[1]; // first ZapML option 
		
		e.optionParents.push(e.zapml);
		
		e.variables["currentReturnText"] = session.botConfig.config.returnText;
		e.variables["currentReturnOption"] = session.botConfig.config.returnOption;			
		e.variables["currentMediaPath"] = session.botConfig.config.mediaPath;
						
		perform(session, bot, message, media, extension);
	}
	else {			
		e.variables["currentMessage"] = message;
		e.variables["currentExtension"] = extension;
		e.variables["currentMedia"] = media; // currentImageLabel
		
		e.variables["jidServer"] = session.id;
		e.variables["jidClient"] = session.userId;
				
		//console.dir(session);
		
		var currentOption = e.variables["currentOption"]; 
		if (DEBUG) console.log("currentOption:");
		if (DEBUG) console.dir(currentOption);
		
		if (DEBUG) console.log("message:"+message+", path:"+media+", ext:"+extension);
		
		if (currentOption !== null && currentOption !== undefined && Object.keys(currentOption).length > 0){
			// ### MENU ###
			if (currentOption.name.toLowerCase() == "menu") {
				if (DEBUG) console.log("Start Menu");		
				
				performMenu(session, currentOption, bot, function(waitBuffer){
					if (waitBuffer.length == 0)
						perform(session, bot, "", "", "");	
				});
			}
			
			// ### PROMPT ###
			if (currentOption.name.toLowerCase() == "prompt" ) {
				if (DEBUG) console.log("Start Prompt");			
					
				performPrompt(session, currentOption, bot, function(waitBuffer){
					if (waitBuffer.length == 0)
						perform(session, bot, "", "", "");	
				});
			}	
			
			// ### WAIT ###
			if (currentOption.name.toLowerCase() == "wait" ) {
				if (DEBUG) console.log("Start Wait");			
				
				performWait(session, currentOption, bot, function(waitBuffer){
					if (waitBuffer.length == 0)
						perform(session, bot, "", "", "");	
				});
			}
					
			// ### COMMAND ###
			if (currentOption.name.toLowerCase() == "command" ) {
				if (DEBUG) console.log("Start Command");			
				
				performCommand(session, currentOption, bot, function(waitBuffer){
					if (waitBuffer.length == 0)
						perform(session, bot, "", "", "");	
				});
				
			}		
			
			// ### SEQUENCE ###
			if (currentOption.name.toLowerCase() == "sequence" ) {
				if (DEBUG) console.log("Start Sequence");			
				
				var nextOption;					

				var currentIndex = e.variables["SequenceIndex_"+currentOption.currentId];
				
				if (DEBUG) console.log("currentIndex="+currentIndex+"; currentId="+currentOption.currentId+"; subOptions size="+currentOption.subOptions.length);
				if (currentIndex === null || currentIndex === undefined){
					if (currentOption.condition == ""){
						e.variables["SequenceIndex_"+currentOption.currentId] = 0;
						currentIndex = 0;
						//console.log("currentIndex criado sem condition");
					}
					else if (evaluateCondition(e.variables, currentOption)){
						e.variables["SequenceIndex_"+currentOption.currentId] = 0;
						currentIndex = 0;
						//console.log("currentIndex criado apos condition");
					}
				}
				
				if (DEBUG) console.log("currentIndex="+currentIndex);

				if (currentIndex !== null && currentIndex !== undefined && e.variables["backInCurrentSequence"]){
					currentIndex = currentIndex - 2; 
					e.variables["backInCurrentSequence"] = false;
				}
				
				if (DEBUG) console.log("after backInCurrentSequence: currentIndex="+currentIndex+" ; size="+currentOption.subOptions.length);

				if (currentIndex !== null && currentIndex !== undefined && currentIndex >= currentOption.subOptions.length){
					if (currentOption.condition != "" && evaluateCondition(e.variables, currentOption) &&
						(currentOption.hasOwnProperty('isLooping') && currentOption.isLooping == 'true')){
						currentIndex = 0;
					}						
				}
				
				// console.log("step4 - currentIndex="+currentIndex+" ; size="+currentOption.subOptions.length);
				if (currentIndex !== null && currentIndex !== undefined && currentIndex >= 0 && currentIndex < currentOption.subOptions.length){
					nextOption = currentOption.subOptions[currentIndex];
					e.optionParents.push(currentOption);
					//console.log("nextOption:");
					//console.dir(nextOption);
					e.variables["SequenceIndex_"+currentOption.currentId] = currentIndex+1;
				}						
				else {
					nextOption = e.optionParents.pop();
					//console.log("nextOption is parent:");
					console.dir(nextOption);
					
					//if (currentIndex != null)
					delete e.variables["SequenceIndex_"+currentOption.currentId];											
				}
				
				e.variables["currentOption"] = nextOption;
				
				e.variables["backInCurrentSequence"] = false;
				
				clear(e.variables);
				
				perform(session, bot, "", "", "");						
			}
		}
	}
}

function performMenu(session, currentOption, bot, finalPerform){
	var waitBuffer = ["wait"];
	
	var e = session.execution;
	var message = e.variables["currentMessage"];
		
	e.variables["backInCurrentSequence"] = false;
				
	if (evaluateCondition(e.variables, currentOption)){
		//if (DEBUG) console.log("condition ok");
		
		// get secretKey
		var secretKey = "";
		if (currentOption.hasOwnProperty('secretKey')){
			//console.log("Menu secretKey => "+currentOption.secretKey);					
			secretKey = currentOption.secretKey;
			secretKey = applyContext(e.variables, secretKey);
		}
		//if (DEBUG) console.log("secret ok");
		
		// get subOptions of the menu
		var subOptionsText = "";
		var instructions = [];
		var order = 1;
		for (_subOption = 0; _subOption < currentOption.subOptions.length; _subOption++){
			var keycode = "";
			var currentSubOption = currentOption.subOptions[_subOption];
								
			//if (DEBUG) console.dir(_subOption);
			//if (DEBUG) console.dir(currentSubOption);
			
			if (currentSubOption.hasOwnProperty('keycode')){
				keycode = currentSubOption.keycode;
				
				var description = "";
				var condition = "";
					
				if (currentSubOption.hasOwnProperty('description'))
					description = currentSubOption.description;
				
				if (currentSubOption.hasOwnProperty('condition'))
					condition = currentSubOption.condition;
				
				// if condition is valid to include this subOption
				var canAddSubOption = true;
				if (condition != "") canAddSubOption = evaluateCondition(e.variables, condition);
				
				if (canAddSubOption){
					var keyText = keycode + " - " + description;
					
					if (keyText.includes("System.order")){
						keyText = applyContext(e.variables, keyText.replace("System.order",""+order));
						instructions.push(currentSubOption);
					}
					
					if (secretKey == ""){
						subOptionsText += "\n" + keyText;
						order++;
					}
					else if (!keyText.includes(secretKey)){
						subOptionsText += "\n" + keyText;
						order++;
					}
				}
			}			
		}
		//if (DEBUG) console.log("suboptions ok");
		
		// verify if subOption was selected or secretKey was received
		var subOption = null;				
		var found = false;
		if (message != null)
			if (secretKey != "" && secretKey == message)
				found = true;
			else 
				for (_subOption = 0; _subOption < currentOption.subOptions.length; _subOption++){
					var currentSubOption = currentOption.subOptions[_subOption];
								
					if ("System.order".toUpperCase() != message.toUpperCase())
						if (currentSubOption.hasOwnProperty('keycode'))
							if (currentSubOption.keycode.toUpperCase() == message.toUpperCase()){
								subOption = currentSubOption; 							
								found = true;
							}			
				}			
		//if (DEBUG) console.log("subOption verification ok - found = "+found);
		
		// verify if subOption was selected by number option				
		if (!found){
			if (!isNaN(message))
				try {
					if ((instructions[parseInt(message)-1] !== null) && (instructions[parseInt(message)-1] !== undefined)){
						found = true;
						subOption = instructions[parseInt(message)-1];
						//if (DEBUG) console.dir(subOption);
					}
				}
				catch(err){
					console.log("Suboptions verification error!! message:"+message +"; " + err.message);
				}
		}
		
		if (instructions.length == 1 && currentOption.hasOwnProperty('execIfOneInstruction')){
			subOption = instructions[0];
			found = true;
		}				
		
		if (DEBUG) console.log("menu found = "+found);
		
		e.variables["backInCurrentSequence"] = false;	
		
		clear(e.variables);
		
		// valid subOption was selected
		if (found){
			e.variables["currentOption"] = subOption;
			e.optionParents.push(currentOption);
			//console.dir(e.optionParents);
			
			waitBuffer.pop();
			finalPerform(waitBuffer);
		}
		// return command was received
		else if (message != null && e.variables["currentReturnOption"] == message.toUpperCase() &&
				(currentOption.hasOwnProperty('includeBackOption') && currentOption.includeBackOption == "true")){
			e.variables["currentOption"] = e.optionParents.pop();
			e.variables["backInCurrentSequence"] = true;
			
			waitBuffer.pop();
			finalPerform(waitBuffer);
		}
		// send current menu content
		else {		
			//if (DEBUG) console.log("preparing menu text");
						
			var result = "";
			var subOptionsTextIncluded = false;
			var hyperTextToRemove = [];
			
			// for each element in the Menu array
			for (_subOption = 0; _subOption < currentOption.subOptions.length; _subOption++){
				//if (DEBUG) console.log("_subOption:"+_subOption);
				//if (DEBUG) console.dir(currentOption.subOptions[_subOption]);
				
				// if it is a hypertext
				if (currentOption.subOptions[_subOption].name.toLowerCase() == "hypertext"){							
					var currentSubOption = currentOption.subOptions[_subOption]; // get hypertext object
					
					//if (DEBUG) console.dir(currentSubOption);
												
					var hypertext = currentSubOption.value;
					hypertext = applyContext(e.variables, hypertext);
				
					//if (DEBUG) console.log("menu hypertext: "+hypertext);
					if (currentSubOption.hasOwnProperty('destroyAfterShow') && currentSubOption.destroyAfterShow == "true") 
						hyperTextToRemove.push(_subOption);						
					
					if (currentSubOption.type == "text"){									
						result += hypertext;									
					}
					else {
						var path = e.variables["currentPath"]+hypertext;
						//if (DEBUG) console.log("menu path: "+path);
						e.sendMessage(bot, session.userId, currentSubOption.type, "", path, util.getExt(path));	
						//if (DEBUG) console.log("step 1");						
					}																					
				}
				else {
					if (!subOptionsTextIncluded){
						//if (DEBUG) console.log("menu subOptionsText: "+subOptionsText);
						result += subOptionsText;
						subOptionsTextIncluded = true;
						if (currentOption.hasOwnProperty('includeBackOption') && currentOption.includeBackOption == "true")
							result += "\n\n"+e.variables["currentReturnOption"]+"- "+e.variables["currentReturnText"];
					}
				}
			}
			
			for (i = hyperTextToRemove.length-1; i >= 0; i--)
				currentOption.subOptions.splice(hyperTextToRemove[i], 1);	
			
			//if (DEBUG) console.log("result:"+result);
			
			e.sendMessage(bot, session.userId, "text", result, "", "");
		}									
	}
	else {
		e.variables["currentOption"] = e.optionParents.pop();
		
		e.variables["backInCurrentSequence"] = false;
		
		clear(e.variables);
		
		waitBuffer.pop();
		finalPerform(waitBuffer);	
	}	
}

function performPrompt(session, currentOption, bot, finalPerform){
	var waitBuffer = ["wait"];
	
	var e = session.execution;
	var message = e.variables["currentMessage"];
	var extension = e.variables["currentExtension"];
	
	e.variables["backInCurrentSequence"] = false;			
	
	if (extension == ""){ // if it is the first Prompt Execution!!
		if (evaluateCondition(e.variables, currentOption)){						
			var hyperTextToRemove = [];
			
			// for each element in the Prompt array
			for (_subOption = 0; _subOption < currentOption.subOptions.length; _subOption++){
				//if (DEBUG) console.log("_subOption:"+_subOption);
				//if (DEBUG) console.dir(currentOption.subOptions[_subOption]);
				
				// if it is a hypertext
				if (currentOption.subOptions[_subOption].name.toLowerCase() == "hypertext"){							
					var currentSubOption = currentOption.subOptions[_subOption]; // get hypertext object
					
					sendHyperText(bot, e.sendMessage, e.variables, currentSubOption, waitBuffer, finalPerform);
				
					if (currentSubOption.hasOwnProperty('destroyAfterShow') && currentSubOption.destroyAfterShow == "true") 
						hyperTextToRemove.push(_subOption);														
				}						
			}
			
			for (i = hyperTextToRemove.length-1; i >= 0; i--)
				currentOption.subOptions.splice(hyperTextToRemove[i], 1);
						
			clear(e.variables);
		}
		else {
			e.variables["currentOption"] = e.optionParents.pop();
			
			clear(e.variables);
			
			waitBuffer.pop();
			finalPerform(waitBuffer);	
		}							
	}			
	else if (e.variables["currentReturnOption"] == message.toUpperCase()){
		e.variables["currentOption"] = e.optionParents.pop();
		
		e.variables["backInCurrentSequence"] = true;			
		
		clear(e.variables);
			
		waitBuffer.pop();
		finalPerform(waitBuffer);
	}
	else {
		if (currentOption.hasOwnProperty('execAfterConfirmation')){
			performExec(bot, session, currentOption.execAfterConfirmation, waitBuffer, finalPerform); 
		
			var receiver = ""+session.userId;
			var receiverName = session.userName;
			
			if (currentOption.hasOwnProperty('receiver'))
				receiver = currentOption.receiver; 
			
			receiver = applyContext(e.variables, receiver);
			
			if (currentOption.hasOwnProperty('messageToSend')){
				e.sendMessage(bot, receiver, "text", currentOption.messageToSend, "", "");
			}
				
			if (currentOption.hasOwnProperty('confirmationMessage'))
				e.sendMessage(bot, session.userId, "text", 
							applyContext(e.variables, currentOption.confirmationMessage), "", "");				
		}
		
		e.variables["currentOption"] = e.optionParents.pop();
		
		clear(e.variables);
			
		waitBuffer.pop();
		finalPerform(waitBuffer);
	}	
}	


function performWait(session, currentOption, bot, finalPerform){
	var waitBuffer = ["wait"];
	
	var e = session.execution;
	var message = e.variables["currentMessage"];
	var extension = e.variables["currentExtension"]
	
	e.variables["backInCurrentSequence"] = false;	
				
	var secretKey = applyContext(e.variables, currentOption.secretKey);
	//console.log("secretKey : "+secretKey);
	
	if (secretKey == message){
		e.variables["currentOption"] = e.optionParents.pop();
		//console.log("secretKey ok -> restart ");
		
		clear(e.variables);
			
		waitBuffer.pop();
		finalPerform(waitBuffer);				
	}
	else if (extension == ""){ // if it is the first Wait Execution!!
		if (evaluateCondition(e.variables, currentOption)){	
			var hyperTextToRemove = [];
			
			// for each element in the Wait array
			if (currentOption.subOptions !== null && currentOption.subOptions !== undefined)
				for (_subOption = 0; _subOption < currentOption.subOptions.length; _subOption++){
					//if (DEBUG) console.log("_subOption:"+_subOption);
					//if (DEBUG) console.dir(currentOption.subOptions[_subOption]);
					
					// if it is a hypertext
					if (currentOption.subOptions[_subOption].name.toLowerCase() == "hypertext"){							
						var currentSubOption = currentOption.subOptions[_subOption]; // get hypertext object
						
						sendHyperText(bot, e.sendMessage, e.variables, currentSubOption, waitBuffer, finalPerform);
					
						if (currentSubOption.hasOwnProperty('destroyAfterShow') && currentSubOption.destroyAfterShow == "true") 
							hyperTextToRemove.push(_subOption);														
					}						
				}
			
			for (i = hyperTextToRemove.length-1; i >= 0; i--)
				currentOption.subOptions.splice(hyperTextToRemove[i], 1);
			
			clear(e.variables);
		}
		else {
			e.variables["currentOption"] = e.optionParents.pop();
			
			clear(e.variables);
				
			waitBuffer.pop();
			finalPerform(waitBuffer);
		}							
	}	
}

function performCommand(session, currentOption, bot, finalPerform){
	var waitBuffer = ["wait"];
	
	var e = session.execution;
	
	if (evaluateCondition(e.variables, currentOption)){
		//console.log("condition ok!!");
		var hyperTextToRemove = [];
		
		for (_subOption = 0; _subOption < currentOption.subOptions.length; _subOption++)
			if (currentOption.subOptions[_subOption].name.toLowerCase() == "hypertext"){
				var currentSubOption = currentOption.subOptions[_subOption]; // get hypertext object
				
				sendHyperText(bot, e.sendMessage, e.variables, currentSubOption, waitBuffer, finalPerform);
										
				if (currentSubOption.hasOwnProperty('destroyAfterShow') && currentSubOption.destroyAfterShow == "true") 
					hyperTextToRemove.push(_subOption);	
			}
				
		for (i = hyperTextToRemove.length-1; i >= 0; i--)
				currentOption.subOptions.splice(hyperTextToRemove[i], 1);
			
		e.variables["currentOption"] = e.optionParents.pop();
		
		for (_subOption = 0; _subOption < currentOption.subOptions.length; _subOption++)
			if ((currentOption.subOptions[_subOption].name.toLowerCase() == "exec"))
				performExec(bot, session, currentOption.subOptions[_subOption].value, waitBuffer, finalPerform); 				
	}
	else
		e.variables["currentOption"] = e.optionParents.pop();
						
	e.variables["backInCurrentSequence"] = false;
	clear(e.variables);	
	
	waitBuffer.pop();
	finalPerform(waitBuffer);
}

function clear(variables){
	variables["currentMessage"] = "";
	variables["currentMedia"] = "";			
	variables["currentExtension"] = "";
}

function evaluateCondition(variables, currentOption){
	var result = true;
	
	if (currentOption.hasOwnProperty('condition')){
		console.log("Command condition => "+currentOption.condition);
		
		var condition = currentOption.condition;
		if ((condition !== undefined) && (condition != "")){
			result = false;
			
			condition = applyContext(variables, condition);
			condition = condition.trim();			
			condition = condition.replace("\r","").replace("\n","").replace("\r\n","");
			
			try {	        
				result = eval(condition);
				console.log("Condition:"+condition+" ### Result:"+result);
			}
			catch(err) {
				console.log(err.message);
			}
		}
	}
	
	return result;
}

function sendHyperText(bot, sendMessage, variables, hypertextOption, waitBuffer, finalPerform){
	waitBuffer.push("wait");
				
	var receiver = "";
	if (hypertextOption.hasOwnProperty('receiver'))
		receiver = applyContext(variables, hypertextOption.receiver);	
	if (receiver == "")
		receiver = variables["jidClient"];
	
	var hypertext = hypertextOption.value;
	
	if (hypertext.toUpperCase().includes("SQL."))
		evaluateSQL(variables, hypertext, function (sqlResult, paramsToPerform){
				performHyperText(bot, receiver, sendMessage, variables, hypertextOption, sqlResult, waitBuffer, finalPerform);
			}, {}, waitBuffer, finalPerform);
	else 
		performHyperText(bot, receiver, sendMessage, variables, hypertextOption, 
						applyContext(variables, hypertext), waitBuffer, finalPerform);	
}

function performHyperText(bot, receiver, sendMessage, variables, hypertextOption, hypertext, waitBuffer, finalPerform){
	//console.log("type = "+hypertextOption.type);
	//console.dir(hypertextOption);
	if (hypertextOption.type == "text"){									
		sendMessage(bot, receiver, "text", hypertext, "", "");	

		waitBuffer.pop();
		finalPerform(waitBuffer);
	}
	else if (hypertextOption.type == "http-text"){		
		util.download(hypertext, receiver, function(){
			console.log('done');
			fs.readFile(receiver, function(err, data) {
				sendMessage(bot, receiver, "text", data, "", "");	
				
				waitBuffer.pop();
				finalPerform(waitBuffer);
			});
		});			
	}
	else if ((hypertextOption.type == "http-image") || (hypertextOption.type == "http-document")){		
		var ext = util.getExt(hypertext);
		var type = "document";
		
		if (ext == "jpg" || ext == "png" || ext == "gif")
			type = "image";
		
		util.download(hypertext, receiver, function(){
			console.log('done');
			fs.readFile(receiver, function(err, data) {
				sendMessage(bot, receiver, type, "", receiver, ext);
				
				waitBuffer.pop();
				finalPerform(waitBuffer);
			});
		});		
	}
	else {
		var path = variables["currentPath"]+hypertext;
		//console.log("step2 path:"+path);
		sendMessage(bot, receiver, hypertextOption.type, "", path, util.getExt(path));	
		//console.log("step3");
		waitBuffer.pop();
		finalPerform(waitBuffer);
	}
}

function performExec(bot, session, routines, waitBuffer, finalPerform){
	waitBuffer.push("wait");
	var e = session.execution;
		
	//console.log(routines);
	for (var i = 0; i < routines.length; i++){
		routines[i] = routines[i].trim();
		if (DEBUG) console.log("routine: "+routines[i]);
		//console.log("routines[i].substring(0,5).toUpperCase(): "+routines[i].substring(0,5).toUpperCase());
		//console.log("routines[i].substring(0,5).toUpperCase().includes('SQL.'):"+routines[i].substring(0,5).toUpperCase().includes("SQL."));
		if ("exit" == routines[i].toLowerCase()){			
			var currentOption = e.variables["currentOption"]; 
			
			while (currentOption.name.toLowerCase() != "sequence" && !currentOption.hasOwnProperty('isRoot'))
				currentOption = e.optionParents.pop();  
			
			e.variables["currentOption"] = currentOption;
		}
		else if ("double-exit" == routines[i].toLowerCase()){
			var currentOption = e.variables["currentOption"]; 
			
			while (currentOption.name.toLowerCase() != "sequence" && !currentOption.hasOwnProperty('isRoot'))
				currentOption = e.optionParents.pop();  
			
			delete e.variables["SequenceIndex_"+currentOption.currentId];
				
			currentOption = e.optionParents.pop();
			
			while (currentOption.name.toLowerCase() != "sequence" && !currentOption.hasOwnProperty('isRoot'))
				currentOption = e.optionParents.pop();
			
			if (DEBUG) console.log("forward => currentOption:");
			if (DEBUG) console.dir(currentOption);
			
			e.variables["currentOption"] = currentOption;
		}
		else if ("++" == routines[i].substring(0,2)){
			var variable = e.variables[routines[i].substring(2,routines[i].length)];
			var incrementedValue = 0;
			try {
				incrementedValue = parseInt(variable) + 1;
			}
			catch (err){
				console.log(err.message);
			}
			e.variables[routines[i].substring(2,routines[i].length)] = ""+incrementedValue;
		}
		else if (routines[i].substring(0,8).toUpperCase().includes("JS.EVAL")){
			var expression = routines[i].substring(routines[i].indexOf("JS.EVAL(")+"JS.EVAL(".length,routines[i].length-1);
			expression = applyContext(e.variables,expression);
			if (DEBUG) console.log("expression:"+expression);
			eval(expression);
		}
		else if (routines[i].substring(0,5).toUpperCase().includes("SQL.")){
			evaluateSQL(e.variables, routines[i], function (sqlResult, paramsToPerform){}, {}, waitBuffer, finalPerform);
		}			
		else {
			var variable = routines[i].substring(0,routines[i].indexOf("="));
			var expression = routines[i].substring(routines[i].indexOf("=")+1, routines[i].length);
			
			if (expression.toUpperCase().includes("SQL."))
				evaluateSQL(e.variables, expression, function (sqlResult, paramsToPerform){
						if (DEBUG) console.log("SQL atribution: "+paramsToPerform.variable + " = " +sqlResult);
						e.variables[paramsToPerform.variable] = sqlResult;	
					},{"variable":variable}, waitBuffer, finalPerform);
			else if (expression.toUpperCase().includes("JS.EVAL")){
				expression = expression.substring(expression.indexOf("JS.EVAL(")+"JS.EVAL(".length,expression.length-1);
				expression = eval(applyContext(e.variables,expression));	
				e.variables[variable] = expression ;	
				if (DEBUG) console.log("JS atribution: "+variable + " = " +expression);
			} 
			else {
				expression = applyContext(e.variables, expression);	
				e.variables[variable] = applyContext(e.variables, expression);	
				if (DEBUG) console.log("atribution: "+variable + " = " +expression);
			}
		}
	}
	
	waitBuffer.pop();
	finalPerform(waitBuffer);
}

function applyContext(variables, value){
	for (key in variables){
		try {
			value = util.replaceAll(value, "System."+key, variables[key]);
		}
		catch(err) {
			console.log(err.message+" key:"+key);
		}		
	}		
	
	value = util.replaceAll(value, "System.dateTime", (new Date()).toLocaleString());		
	
	return value;
}

var mysql = require('mysql');
var conn = null;

function getMySQLUrlConnection(databaseUrl){
	return 	mysql.createConnection({
		host     : 'localhost',
		user     : 'root',
		password : 'root',
		database : databaseUrl
	});
}

function getMySQLDefaultConnection(databaseUrl){
	return 	mysql.createConnection({
		host     : 'localhost',
		user     : 'root',
		password : 'root',
		database : databaseUrl
	});
}

function evaluateSQL(variables, sql, functionToPerform, paramsToPerform, waitBuffer, finalPerform){
	if (DEBUG) console.log("Evaluating "+sql);
	waitBuffer.push("wait");
	
	try {
		if ("SQL.CONNECT_URL" == sql.toUpperCase().substring(0,"SQL.CONNECT_URL".length)){
			var databaseUrl = sql.substring("SQL.CONNECT_URL(".length, sql.length-1);
			//if (conn !== null) conn.close();	
			if (DEBUG) console.log("database:"+database);			
			conn = getMySQLUrlConnection(applyContext(variables, databaseUrl));
			if (DEBUG) console.log("Connected with "+databaseUrl);
			
			waitBuffer.pop();
			finalPerform(waitBuffer);			
		}
		else if ("SQL.CONNECT" == sql.toUpperCase().substring(0,"SQL.CONNECT".length)){
			var database = sql.substring("SQL.CONNECT(".length, sql.length-1);
			if (DEBUG) console.log("database:"+database);
			//if (conn !== null) conn.close();			
			conn = getMySQLDefaultConnection(applyContext(variables, database));
			if (DEBUG) console.log("Connected with "+database);	

			waitBuffer.pop();
			finalPerform(waitBuffer);			
		}
		else if (conn !== null && sql.toUpperCase().includes("SQL.CALL")){
			var paramText = sql.substring(sql.indexOf("SQL.CALL(")+"SQL.CALL(".length, sql.length-1);
			var params = paramText.split(",,");
			
			var call = "CALL " + params[0] + "(";
			for (var i = 1; i < params.length; i++)
				call = call + "?,";
			
			if (params.length > 1)
				call = call.substring(0, call.length-1) + ")";
			else
				call = call.substring(0, call.length) + ")";
			
			for (var i = 1; i < params.length; i++){
				params[i] = applyContext(variables, params[i]);
				if (DEBUG) console.log("params["+i+"]:"+params[i]);
			}			
			
			params.splice(0,1); // remove SQL call
			
			if (DEBUG) console.log("Executing "+call);
			
			conn.query(call, params, function(err, result) { 
				//if (err) throw err; 
				try{
					var tmpResult = JSON.parse(JSON.stringify(result));
										
					var sqlResult = "";
					for (var i = 0; i < tmpResult.length-1; i++)
						for (j in tmpResult[i][0])
							sqlResult += tmpResult[i][0][j];
						
					if (DEBUG) console.log(sqlResult);
					
					if (functionToPerform !== undefined) functionToPerform(sqlResult, paramsToPerform);				
				}
				catch(err){
					console.log(err.message);
				}
				
				waitBuffer.pop();
				finalPerform(waitBuffer);
			});			
		}
		else if (conn !== null && sql.toUpperCase().includes("SQL.QUERY")){
			var paramText = sql.substring(sql.indexOf("SQL.QUERY(")+"SQL.QUERY(".length, sql.length-1);				
			var params = paramText.split(",,");
			
			var query = params[0];
			
			for (var i = 1; i < params.length; i++){
				params[i] = applyContext(variables, params[i]);
				if (DEBUG) console.log("params["+i+"]:"+params[i]);
			}	
			
			params.splice(0,1); // remove SQL query
			
			if (DEBUG) console.log("Querying "+query);
			
			conn.query(query, params, function(err, result) { 
				try {
					var tmpResult = JSON.parse(JSON.stringify(result));
										
					var sqlResult = "";
					for (var i = 0; i < tmpResult.length; i++)
						for (j in tmpResult[i])
							sqlResult += tmpResult[i][j];
						
					if (DEBUG) console.log(sqlResult);
					
					if (functionToPerform !== undefined) functionToPerform(sqlResult, paramsToPerform);
				}
				catch(err){
					console.log(err.message);
				}
				
				waitBuffer.pop();
				finalPerform(waitBuffer);
			});			
		}			
		else if (conn !== null && sql.toUpperCase().includes("SQL.UPLOAD")){
			var paramText = sql.substring(sql.indexOf("SQL.UPLOAD(")+"SQL.UPLOAD(".length, sql.length-1);
			var params = paramText.split(",,");
			
			var call = "CALL " + params[0] + "(";
			for (var i = 1; i < params.length; i++)
				call = call + "?,";
			
			if (params.length > 1)
				call = call.substring(0, call.length-1) + ")";
			else
				call = call.substring(0, call.length) + ")";
			
			for (var i = 1; i < params.length; i++){
				params[i] = applyContext(variables, params[i]);
				if (DEBUG) console.log("params["+i+"]:"+params[i]);
			}
			
			params.splice(0,1); // remove SQL call
			
			if (DEBUG) console.log("Executing "+call);
			
			var defaultPath = variables["currentMediaPath"];
			var blobPath = params[0];
			if (!blobPath.includes(defaultPath)) 
				blobPath = defaultPath+blobPath;
			
			if (DEBUG) console.log("blobPath:"+blobPath);
								
			// blob -> from file to DB
			require('fs').readFile(blobPath, function(err, data) {
				params[0] = data;
				
				conn.query(call, params, function(err, result) { 
					console.log(err.message); 
					if (err) throw err; 	
					
					waitBuffer.pop();
					finalPerform(waitBuffer);
				});		
			});	
		}
		else if (conn !== null && sql.toUpperCase().includes("SQL.DOWNLOAD")){
			var paramText = sql.substring(sql.indexOf("SQL.DOWNLOAD(")+"SQL.DOWNLOAD(".length, sql.length-1);
			var params = paramText.split(",,");
			
			var call = "CALL " + params[0] + "(";
			for (var i = 1; i < params.length; i++)
				call = call + "?,";
			
			if (params.length > 1)
				call = call.substring(0, call.length-1) + ")";
			else
				call = call.substring(0, call.length) + ")";
						
			for (var i = 1; i < params.length; i++){
				params[i] = applyContext(variables, params[i]);
				if (DEBUG) console.log("params["+i+"]:"+params[i]);
			}
						
			params.splice(0,1); // remove SQL call
			
			if (DEBUG) console.log("Executing "+call);
			
			// blob -> from DB to file
			conn.query(call, params, function(err, result) { 
				if (err) throw err; 
				var tmpResult = JSON.parse(JSON.stringify(result));
				var sqlResult = "";
				for (var i = 0; i < tmpResult.length-1; i++)
					for (j in tmpResult[i][0]){
						if (DEBUG) console.log("params[0]:"+params[0]+"; tmpResult[i][0][j]:"+tmpResult[i][0][j]);
						
						require('fs').writeFile(params[0], tmpResult[i][0][j], "binary", function(err) {
							console.log(err.message); 
							if (err) throw err; 	

							waitBuffer.pop();
							finalPerform(waitBuffer);							
						});
					}
			});
		}
	}
	catch (err){
		console.log(err.message);
	}
}