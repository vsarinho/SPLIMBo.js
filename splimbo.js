// npm install telebot --save
// npm install request
// npm install mysql, xmldom

var sessions = [];

var botConfigs = require('./bot_configs.js').bots;

for (i in botConfigs) {	
	if (botConfigs[i].url == "telegram")
		require('./telegram_monitor.js').startMonitoring(botConfigs[i], sessions);
}

