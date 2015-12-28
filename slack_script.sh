#!/usr/bin/env node

/* nG1Alarm Script */

var client = require('redis').createClient();
var redisChannelName = 'ng1_alarms';

var proc = process.argv.shift();
var script = process.argv.shift();

var params = {
	MEName : process.argv.shift(),
	IPAddress : process.argv.shift(),
	TSDate : process.argv.shift(),
	TSTime : process.argv.shift(),
	Severity : process.argv.shift(),
	AlarmType : process.argv.shift(),
	AlarmVariable : process.argv.shift(),
	AlarmVariableValue : process.argv.shift(),
	AlarmVariableThreshold : process.argv.shift(),
	AlarmInterval : process.argv.pop(),
	AlarmDescription : process.argv.join(' ')
}

client.on('error', function(err) {
	console.log('Failed to connect to Redis server - ', err);
});

client.publish(redisChannelName, JSON.stringify(params));
client.quit();