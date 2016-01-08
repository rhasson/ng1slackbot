/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
This is a Slack bot for nGeniusOne.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node bot.js

# USE THE BOT:

  
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


var Botkit = require('botkit')
var os = require('os');
var fs = require('fs');

var moment = require('moment');
var pretty = require('prettysize');

var pubsub;
var Redis;
var isRedis = false;
try { 
  Redis = require('redis');
  isRedis = true;
} catch (e) { isRedis = false; }
var redisChannelName = 'ng1_alarms';
var activeChannels = [];

var WATCH = require('chokidar');
var watcher = undefined;
var watched_dir = '/tmp/';
var watched_file_pattern = '_alarm*';

var stats = require('./libs/stats');

var controller = Botkit.slackbot({
  debug: false,
});

var bot;

/* file watcher if redis is not available */
function handleFileAdd(path, stats) {
  var doc = fs.readFileSync(path);
  handleIncomingAlarm(redisChannelName, doc);
  fs.unlinkSync(path);
}
function cancelFileWatcher() {
  watcher.close();
  watcher = undefined;
}
function setupFileWatcher() {
  if (watcher == undefined) {
    console.log('Setting up file watchers for : ', watched_dir + watched_file_pattern);
    watcher = WATCH.watch(watched_dir + watched_file_pattern, {ignored: /[\/\\]\./});
    watcher.on('add', handleFileAdd);
  }
}

/* handle incoming alarm message from redis or file read */
function handleIncomingAlarm(topic, doc) {
  var text, msg;
  try { 
    text = JSON.parse(doc);
    msg = 'Severity ' + text.Severity + ' alarm - ' + text.AlarmDescription;
    activeChannels.forEach(function(id) {
      bot.say({text: msg, channel: id});
    });
  }
  catch(e) { console.log('Parsing error: ', e); }
}

/* redis pub/sub for receiving alarm messages */
function setupRedisListeners() {
  pubsub = Redis.createClient({max_attempts: 3});
  pubsub.on('error', function(err) {
    if (watcher === undefined && err.code === 'CONNECTION_BROKEN') {
      console.log('Redis not available - ', err.code);
      setupFileWatcher();
    }
  });

  pubsub.on('ready', function() {
    if (watcher != undefined) cancelFileWatcher();
    pubsub.subscribe(redisChannelName);
  });

  /* handle published messages from nG1 alarm scripts */
  pubsub.on('message', handleIncomingAlarm);
}

bot  = controller.spawn(
  {
    token:process.env.token
  }
).startRTM(function(err, bot, payload) {
  if (err) throw new Error('Failed to connect to Slack');
  bot.api.channels.list({}, function(err, resp) {
    if (!err) {
      resp.channels.forEach(function(item) {
        if (item.is_member) activeChannels.push(item.id);
      });
      /* subscribe to redis publisher */
      if (isRedis) {
        setupRedisListeners();
      } else setupFileWatcher();
    }
    console.log('channels: ', activeChannels)
  });
});

/* when the bot joins a channel, keep track of the channel ID */
controller.on('channel_joined', function(bot, message) {
  console.log('joining channel: ', message.channel.id);
  if (!activeChannels.indexOf(message.channel.id)) activeChannels.push(message.channel.id);
});

/* when the bot leaves a channel, remove its ID from the list */
controller.on('channel_left', function(bot, message) {
  activeChannels = activeChannels.filter(function(id){ return id !== message.channel });
  console.log('leaving channel: ', message.channel);
});

/* input: stats [ip|community name] [date] [hour][Timezone] */
controller.hears(['server (.*)'],'direct_message,direct_mention,mention',function(bot,message) {
  var matches = message.text.match(/stats (.*)/, 'i');
  var params = matches ? matches[1].split(' ') : undefined;

  stats.queryServerStats(params, function(err, row) {
    if (err) bot.reply(message, "I'm sorry but there was a problem getting the data you requested");
    else {
      console.log('RESULTS: ', row)
      if (row) {
        bot.reply(message,  moment(new Date(row.targettime)).calendar() + " " +
                  row.name + " " +
                  "had *" + row.activesessions + "* active sessions. " +
                  "It sent *" + pretty(row.fromserveroctets, true) + "* and " +
                  "received *" + pretty(row.toserveroctets, true) + "*."
        );
      } else bot.reply(message, "I'm sorry but I didn't find anything");
    }
  });
});



/****************************************************
controller.hears(['hello','hi'],'direct_message,direct_mention,mention',function(bot,message) {

  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  },function(err,res) {
    if (err) {
      bot.log("Failed to add emoji reaction :(",err);
    }
  });


  controller.storage.users.get(message.user,function(err,user) {
    if (user && user.name) {
      bot.reply(message,"Hello " + user.name+"!!");
    } else {
      bot.reply(message,"Hello.");
    }
  });
})

controller.hears(['call me (.*)'],'direct_message,direct_mention,mention',function(bot,message) {
  var matches = message.text.match(/call me (.*)/i);
  var name = matches[1];
  controller.storage.users.get(message.user,function(err,user) {
    if (!user) {
      user = {
        id: message.user,
      }
    }
    user.name = name;
    controller.storage.users.save(user,function(err,id) {
      bot.reply(message,"Got it. I will call you " + user.name + " from now on.");
    })
  })
});

controller.hears(['what is my name','who am i'],'direct_message,direct_mention,mention',function(bot,message) {

  controller.storage.users.get(message.user,function(err,user) {
    if (user && user.name) {
      bot.reply(message,"Your name is " + user.name);
    } else {
      bot.reply(message,"I don't know yet!");
    }
  })
});


controller.hears(['shutdown'],'direct_message,direct_mention,mention',function(bot,message) {

  bot.startConversation(message,function(err,convo) {
    convo.ask("Are you sure you want me to shutdown?",[
      {
        pattern: bot.utterances.yes,
        callback: function(response,convo) {
          convo.say("Bye!");
          convo.next();
          setTimeout(function() {
            process.exit();
          },3000);
        }
      },
      {
        pattern: bot.utterances.no,
        default:true,
        callback: function(response,convo) {
          convo.say("*Phew!*");
          convo.next();
        }
      }
    ])
  })
})


controller.hears(['uptime','identify yourself','who are you','what is your name'],'direct_message,direct_mention,mention',function(bot,message) {

  var hostname = os.hostname();
  var uptime = formatUptime(process.uptime());

  bot.reply(message,':robot_face: I am a bot named <@' + bot.identity.name +'>. I have been running for ' + uptime + ' on ' + hostname + ".");

})

function formatUptime(uptime) {
  var unit = 'second';
  if (uptime > 60) {
    uptime = uptime / 60;
    unit = 'minute';
  }
  if (uptime > 60) {
    uptime = uptime / 60;
    unit = 'hour';
  }
  if (uptime != 1) {
    unit = unit +'s';
  }

  uptime = uptime + ' ' + unit;
  return uptime;
}
***********************************************************************/