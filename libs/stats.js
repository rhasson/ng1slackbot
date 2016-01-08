var pg = require('pg');
var sql = new pg.Client('postgres://netscout:dbadmin@localhost/pgsql_stealth_db');
var isSqlReady = true;
var moment = require('moment');

var reg_ex = {
  ipv4: new RegExp(/^([1-9][0-9]{0,2})\.([0-9]{1,3}\.){2}([0-9]{1,3})$/i),
  community_id: new RegExp(/^(0)\.([0-9]{1,3}\.){2}([0-9]{1,3})$/i),
  hour: new RegExp(/^([1-9]|10|11|12)\s?(am|pm)/i)
}

//sql.on('drain', sql.end.bind(sql)); //disconnect client when all queries are finished
sql.on('error', function(err) { 
  isSqlReady = false;
  console.log('SQL ERROR: ', err);
});
sql.connect();

function queryServerStats(params, cb) {
  var query;

  if (typeof params === 'function') return params(new Error('Missing params'));
  //if (!isSqlReady) return cb(new Error('SQL Server is not connected'));

  buildServerStatsQuery(params, cb);  
}

function buildServerStatsQuery(params, cb) {
    /* params: [ipv4|community name] [date] [hour] [Timezone] */
    var query;
    var temp, name, ip, date, hour, tz = undefined;    

    var defaultQuery = "select \
                ksi.targettime, ksi.toserveroctets, ksi.fromserveroctets, ksi.clientaddress, ksi.activesessions, comm.name \
                from ksi_hourly as ksi \
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
        console.log('2 DATE: ', date)

          var matches, t, h, x, fdate;
          fdate = moment(new Date(date)).format('YYYY-MM-DD');
          x = parseInt(new Date().getFullYear()) - parseInt(fdate.split('-').shift());  //get the formatted year
          if (x > 2) fdate = moment(new Date(date)).year(new Date().getFullYear()).format('YYYY-MM-DD');  //if the user didn't provide a year, reformat with the current year as default
          console.log('3 FDATE: ', fdate)
          if (hour = params.shift()) {
            matches = hour.match(reg_ex.hour);
            if (hour) {
              matches.shift()  //get rid of the whole string
              h = parseInt(matches.shift());
              t = matches.shift().toLowerCase().trim();
              if (!isNaN(h) && t === 'pm' && h <= 12) h += 12; 
              hour = moment({hour: h, minute: 0}).format('HH:mm:ssZZ');
              console.log('4 HOUR: ', hour)
            }
          }
          if (tz = params.shift()) tz = '(' + tz.toUpperCase() + ')';

      }
      /* process first argument, should be: ip or community name */
      if (ip) {
        if (reg_ex.ipv4.test(ip) || reg_ex.community_id.test(ip)) {  //is IP address or community id in the form of ipv4
          ip = ip;
          console.log('6 IP: ', ip)
          getRecords(ip, fdate, hour, cb);
        }
        else {   //it is a community name
          name = ip.toUpperCase();
          console.log('7 NAME: ', name)
          sql.query("select clientaddress, name from lu_communities where name like '%"+name+"%' limit 1")
          .on('row', function(row, results) { results.addRow(row); })
          .on('end', function(results) {
            ip = results.rows[0].clientaddress;
            getRecords(ip, fdate, hour, cb);
          })
          .on('error', function(err) { return cb(err); })
        }
      }
    }

    function getRecords(ip, date, hour, cb) {
      var query = "select \
              ksi.targettime, ksi.toserveroctets, ksi.fromserveroctet, ksi.clientaddress, ksi.activesessions, comm.name \
              from ksi_hourly as ksi \
              inner join lu_communities as comm on ksi.clientaddress = comm.clientaddress \
              where ksi.clientaddress != '0.0.0.0' \
              and ksi.clientaddress = '" + ip + "' \
              and ksi.targettime = '" + date + " " + hour + "' \
              order by ksi.targettime desc \
              limit 5";

          console.log('5 QUERY: ', query)
          sql.query(query)
          .on('row', function(row, results) { results.addRow(row); })
          .on('end', function(results) { return cb(null, results); })
          .on('error', function(err) { return cb(err); });
    }
}

module.exports = {
  queryServerStats: queryServerStats
}
