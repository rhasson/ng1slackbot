#!/usr/bin/env node

/* nG1Alarm Script */

var fs = require('fs');
var client = require('redis').createClient({max_attempts: 3});
var redisChannelName = 'ng1_alarms';
var file_path = '/tmp/_alarm';

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

function writeAlarmToFile() {
	var rnd = new Date().getTime();
	fs.writeFileSync(file_path + rnd, JSON.stringify(params));
}

client.on('error', function(err) {
	console.log('Failed to connect to Redis server - ', err.code);
	if (err.code === 'CONNECTION_BROKEN') writeAlarmToFile();
});

client.publish(redisChannelName, JSON.stringify(params));
client.quit();