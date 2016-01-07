var pg = require('pg');
var sql = new pg.Client('postgres://netscout:dbadmin@localhost/pgsql_stealth_db');
var moment = require('moment');

var reg_ex = {
  ipv4: new RegExp(/^([1-9][0-9]{0,2})\.([0-9]{1,3}\.){2}([0-9]{1,3})$/i),
  community_id: new RegExp(/^(0)\.([0-9]{1,3}\.){2}([0-9]{1,3})$/i),
  hour: new RegExp(/^([1-9]|10|11|12)\s?(am|pm)/i),
  date_parts: new RegExp(/^/i)
}

function queryServerStats(params, cb) {
  var query;

  if (typeof params === 'function') return params(new Error('Missing params'));

  buildServerStatsQuery(params, function(err, query) {
    console.log('0 QUERY: ', err, query)
  });

  sql.connect(function(err) {
    if (err) return cb(err);  //bot.reply(message, "I'm sorry but there was a problem getting the data you requested");
    else {
      sql.query(query, function(err, results) {
        var item;
        if (err) return (err);  //bot.reply(message, "I'm sorry but I couldn't find any data at this time");
        else {
          if (results && results.rows.length) item = results.rows[0];
          else return cb(new Error('No data found'));   //bot.reply(message, "I'm sorry but I couldn't find any data at this time");
          bot.reply(message,  moment(item.targettime).calendar() + " " +
                              item.name + " " +
                              "had *" + item.activesessions + "* active sessions. " +
                              "It sent *" + item.fromserveroctet + "* Bytes and " +
                              "received *" + item.toserveroctets + "* Bytes."
                    )
        }
        sql.end();
      });
    }
  });
}

function buildServerStatsQuery(params, cb) {
    /* params: [ipv4|community name] [date] [hour] [Timezone] */
    var query;
    var temp, name, ip, date, hour, tz = undefined;    

    var defaultQuery = "select \
                ksi.targettime, ksi.toserveroctets, ksi.fromserveroctet, ksi.clientaddress, ksi.activesessions, comm.name \
                inner join lu_communities as comm on ksi.clientaddress = comm.clientaddress \
                where ksi.clientaddress != '0.0.0.0' \
                order by ksi.targettime desc \
                limit 5";

    if (!params || params.length <= 0) query = defaultQuery;
    else {
      console.log('1 PARAMS: ', params)
      ip = params.shift();
      date = params.shift();
      /* process date argument */
      if (date) {
        //console.log('2 DATE: ', date)
        (function processDateTime(d) {
          var matches, t, h, x;
          date = moment(new Date(d)).format('YYYY-MM-DD');
          x = parseInt(new Date().getFullYear()) - parseInt(d.split('-').shift());  //get the formatted year
          if (x > 2) date = moment(new Date(d)).year(new Date().getFullYear()).format('YYYY-MM-DD');  //if the user didn't provide a year, reformat with the current year as default
          //console.log('3 DATE: ', date)
          if (hour = params.shift()) {
            matches = hour.match(reg_ex.hour);
            if (hour) {
              matches.shift()  //get rid of the whole string
              h = parseInt(matches.shift());
              t = matches.shift().toLowerCase();
              if (!isNaN(h) && t === 'pm' && h < 12) h + 12;
              hour = moment({hour: h, minute: 0}).format('HH:mm:ss');
              //console.log('4 HOUR: ', hour)
            }
          }
          if (tz = params.shift()) tz = '(' + tz.toUpperCase() + ')';
        })(date)
      }
      /* process first argument, should be: ip or community name */
      if (ip) {
        if (reg_ex.ipv4.test(ip) || reg_ex.community_id.test(ip)) {  //is IP address or community id in the form of ipv4
          ip = ip;
          console.log('6 IP: ', ip)
          getRecords(ip, date, hour, cb);
        }
        else {   //it is a community name
          name = ip.toUpperCase();
          console.log('7 NAME: ', name)
          sql.query("select clientaddress, name from lu_communities where name like %"+name+"% limit 1", function(err, res) {
            if (err) return cb(err);
            if (res && res.rows) {
              ip = res.rows[0].clientaddress;
              getRecords(ip, date, hour, cb);
            }
          });
        }
      }
    }

    function getRecords(ip, date, hour, cb) {
      var query = "select \
              ksi.targettime, ksi.toserveroctets, ksi.fromserveroctet, ksi.clientaddress, ksi.activesessions, comm.name \
              inner join lu_communities as comm on ksi.clientaddress = comm.clientaddress \
              where ksi.clientaddress != '0.0.0.0' \
              and ksi.clientaddress = '" + ip + "' \
              and ksi.targettime like '" + date + " " + hour + "%' \
              order by ksi.targettime desc \
              limit 5";

          console.log('5 QUERY: ', query)
          sql.query(query, function (err, resp) {
            if (err) return cb(err);
            return cb(null, resp.rows);
          });
    }
}

module.exports = {
  queryServerStats: queryServerStats
}