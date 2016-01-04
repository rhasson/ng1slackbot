#!/usr/bin/env node

/* nG1Alarm Script */

var fs = require('fs');
var Redis;
var isRedis = false;
try { 
  Redis = require('redis');
  isRedis = true;
} catch (e) { isRedis = false; }

var temp;

var redisChannelName = 'ng1_alarms';
var file_path = '/tmp/_alarm';

var proc = process.argv.shift();
var script = process.argv.shift();

var params = {
	MEName : process.argv.shift(),
	IPAddress : process.argv.shift(),
	TSDate : process.argv.shift()
}

if (params.TSDate.indexOf(' ') != -1) {
	temp = params.TSDate.split(' ');
	params.TSDate = temp[0];
	params.TSTime = temp[1];
} else params.TSTime = process.argv.shift();

params.Severity = process.argv.shift();
params.AlarmType = process.argv.shift();
params.AlarmVariable = process.argv.shift();
params.AlarmVariableValue = process.argv.shift();
params.AlarmVariableThreshold = process.argv.shift();
params.AlarmInterval = process.argv.pop();
params.AlarmDescription = process.argv.join(' ');

function writeAlarmToFile() {
	var rnd = new Date().getTime();
	fs.writeFileSync(file_path + rnd, JSON.stringify(params));
}

if (isRedis) {
	client = Redis.createClient({max_attempts: 3});
	client.on('error', function(err) {
		console.log('Failed to connect to Redis server - ', err.code);
		if (err.code === 'CONNECTION_BROKEN') writeAlarmToFile();
	});

	client.publish(redisChannelName, JSON.stringify(params));
	client.quit();
} else writeAlarmToFile();
