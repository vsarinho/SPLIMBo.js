var fs = require('fs'), request = require('request');

exports.download = function(uri, filename, callback){
	request.head(uri, function(err, res, body){
		//if (res !== null & res !== undefined){
			console.log('content-type:', res.headers['content-type']);
			console.log('content-length:', res.headers['content-length']);

			request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
		//}
  });
};

exports.getExt = function(path){
	if ((path !== null) && (path !== undefined))
		return path.substr(path.lastIndexOf(".")+1,path.length).toLowerCase();
	else
		return "";
};

exports.replaceAll = function (str, find, replaceTo){	
	return str.split(find).join(replaceTo);
}