var fs = require('fs');
var DOMParser = require('xmldom').DOMParser;
//var DOMParser = require('dom-parser');

exports.loadXMLConfig = function (filename, onReady){
	fs.readFile(filename, "utf-8", function (err,data){
		var zapmlJSON = [{"name":"zapapp", "path":""}];
		
		//try {
			var currentSequenceId = 1;
			var zapmlConfig = new DOMParser().parseFromString(data);
			
			zapmlJSON[0].path = zapmlConfig.getElementsByTagName("zapapp")[0].attributes[0].value;
			
			var zapmlTree = makeJSON(zapmlConfig.getElementsByTagName("zapapp")[0].childNodes[1], currentSequenceId, true, 1);
			
			if (Object.keys(zapmlTree).length > 0)
				zapmlJSON.push(zapmlTree);
		//}
		//catch (err) {console.log(err.message)}
		
		//console.log("zapmlTree:");
		//console.dir(zapmlTree);
		
		onReady(zapmlJSON);
	});
};

function makeJSON(currentNode, currentSequenceId, isRoot, level){	
	//console.log("level="+level);

	if (currentNode !== null && currentNode !== undefined && 
		currentNode.nodeName !== null && currentNode.nodeName !== undefined && 
		currentNode.nodeType == 1){
			
		//console.log("currentNode.nodeName:"+currentNode.nodeName);
		
		var result = {};
		
		result.name = currentNode.nodeName.toLowerCase();
		
		if (["text","audio","image","video","voice","document"].includes(currentNode.nodeName.toLowerCase())){
			result.name = "hypertext";
			result.type = currentNode.nodeName;
			result.value = currentNode.textContent;
		}
		else if (currentNode.nodeName.toLowerCase() == "exec"){
			result.value = currentNode.textContent.split(';;;');
		}
		else if (currentNode.nodeName.toLowerCase() == "sequence"){
			result.currentId = ""+currentSequenceId;
			currentSequenceId++;
		}
		
		if (isRoot){
			result.isRoot = isRoot;
			isRoot = false;
		}
		
		for (j in currentNode.attributes){			
			if (currentNode.attributes[j].name == "execAfterConfirmation")
				result[currentNode.attributes[j].name] = [currentNode.attributes[j].value];
			else if (!["undefined","item","getNamedItem","setNamedItem","setNamedItemNS",
				  "removeNamedItem","removeNamedItemNS","getNamedItemNS"].includes(currentNode.attributes[j].name))
				result[currentNode.attributes[j].name] = currentNode.attributes[j].value;
							
			delete result["undefined"];	
		}
					
		var subOptions = currentNode.childNodes;			
		if (subOptions !== undefined && Object.keys(subOptions).length > 0){	
			for (i in subOptions){				
				//console.log("subTree["+i+"] at level "+level+":");
				var subTree = makeJSON(subOptions[i], currentSequenceId, isRoot, level + 1);
				//console.dir(subTree);
				if (subTree !== null && subTree !== undefined && Object.keys(subTree).length > 0){
					if (result.subOptions === undefined)
						result.subOptions = [];
					result.subOptions.push(subTree);
				}
			}
		}
		
		return result;
	}
	
	
};
