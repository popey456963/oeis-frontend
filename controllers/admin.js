var User = require('../models/User')
var PageViews = require('../models/PageViews')
var moment = require('moment')
var logger = require('./logger')()
var crypto = require('crypto')
var async = require('async')
var stats = require('simple-stats-server')()
var timeout = require('async-timeout')
var filesize = require('filesize')

var adminRanks = ['read', 'list', 'write', 'execute']
exports.ensureAdmin = []
ensurePerm = []

for (var i = 0; i < adminRanks.length; i++) {
  exports.ensureAdmin[adminRanks[i]] = new Function('req', 'res', 'next', `
    if (req.isAuthenticated()) {
      var adminRanks = ` + JSON.stringify(adminRanks) + `
      var pad = new Array(adminRanks.length + 1).join("0")
      var admin = pad + (req.user.admin >>> 0).toString(2)
      var perm = admin.slice(adminRanks.length * -1).split("").reverse().join("")
      if (String(perm.charAt(` + i + `)) == "1") {
        next()
      } else {
        res.render('./admin/not_admin', {
          title: "Not An Admin :: OEIS Lookup"
        })
      }
    } else {
      res.redirect('/login?redirect=' + req.url)
    }
  `)
}

for (var i = 0; i < adminRanks.length; i++) {
  ensurePerm[adminRanks[i]] = new Function('user', `
    if (user) {
      var adminRanks = ` + JSON.stringify(adminRanks) + `
      var pad = new Array(adminRanks.length + 1).join("0")
      var admin = pad + (user.admin >>> 0).toString(2)
      var perm = admin.slice(adminRanks.length * -1).split("").reverse().join("")
      if (String(perm.charAt(` + i + `)) == "1") {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  `)
}

function gravatar(email) {
  if (!email) {
    return 'https://gravatar.com/avatar/?s=80&d=retro';
  }
  var md5 = crypto.createHash('md5').update(email).digest('hex');
  return 'https://gravatar.com/avatar/' + md5 + '?s=200&d=retro';
}

/*
 * GET /admin/users
 */
exports.adminUsers = function(req, res) {
  User.find({}, function(err, docs) {
    var listOfUsers = []
    for (var i = 0; i < docs.length; i++) {
      var temp = {
        joined: moment(docs[i].createdAt).fromNow(),
        editted: moment(docs[i].updatedAt).fromNow(),
        name: docs[i].name,
        email: docs[i].email,
        location: docs[i].location,
        picture: docs[i].picture,
        twitter: docs[i].twitter,
        facebook: docs[i].facebook,
        admin: docs[i].admin,
        gender: docs[i].gender,
        website: docs[i].website,
        last_active: moment().fromNow(),
        gravatar: gravatar(docs[i].email),
        contributions: 0
      }
      listOfUsers.push(temp)
    }
    res.render('./admin/users', {
      page: 'User-List',
      section: "Admin",
      title: 'User List :: OEIS Lookup',
      users: listOfUsers,
      getPerms: getPerms,
      ensurePerm: ensurePerm
    })
  })
}

/*
 * GET /admin
 */
exports.adminPage = function(req, res) {
  res.render('./admin/admin', {
    page: "Admin-Actions",
    section: "Admin",
    title: "Admin Actions :: OEIS Lookup"
  })
}

/*
 * GET /admin/stats
 */
exports.adminStats = function(req, res) {
  /*
   * This needs:
   *  - Active Users
   *  - PageViews (ALL)
   *  - Latest Changes
   */

  async.parallel({
    popularPages: function(callback) { popularPages(callback) },
    popularWeekPages: function(callback) { getMostTime('WeekViews', 10, callback) },
    popularDayPages: function(callback) { getMostTime('DayViews', 10, callback) },
    popularHourPages: function(callback) { getMostTime('HourViews', 10, callback) },
    latestPages: function(callback) { getLatestPages(callback) },
    latestChanges: function(callback) { getLatestChanges(callback) },
    hourViews: function(callback) { getDocuments('HourViews', callback) },
    dayViews: function(callback) { getDocuments('DayViews', callback) },
    weekViews: function(callback) { getDocuments('WeekViews', callback) },
    activeUsers: function(callback) { getDocuments('ActiveUsers', callback) },
    stats: timeout(function(callback){ stats.get('/', callback) }, 2000, 'Stats Timed Out')
  }, function(err, results) {
    var obj = {
      page: "Admin-Stats",
      section: "Admin",
      title: "Statistics :: OEIS Lookup"
    }

    for (var attrname in results) {
      obj[attrname] = results[attrname]
    }

    obj.stats = generateStats(results.stats)
    obj.serverStats = generateServerStats(results.stats)
    res.render('./admin/stats', obj)
  })
}

function generateStats(stats) {
  if (stats == "Stats Timed Out") {
    return "Statistics engine is still spinning up!"
  } 
  var processTime = moment.duration(stats.uptime.process * 1000).humanize()
  var systemTime = moment.duration(stats.uptime.system * 1000).humanize()
  var result = "The program is currently running successfully on <b>Node V." + stats.versions.node
  result += "</b> with <b>" + stats.versions.modules + " modules</b> installed.  This process has been "
  result += "running for <b>" + processTime + "</b>, whilst the system has been running "
  result += "for <b>" + systemTime + "</b>."
  return result
}

function generateServerStats(stats) {
  if (stats == "Stats Timed Out") {
    return ["Statistics engine is still spinning up!"]
  }
  var length = 0
  var sum = 0
  for (var i in stats.cpu['1m']) { length++; sum+= stats.cpu['1m'][i] }
  var cpuMinAvg = Math.round(sum*100/length)
  length = 0; sum = 0
  for (var i in stats.cpu['15s']) { length++; sum+= stats.cpu['15s'][i] }
  var cpuSecAvg = Math.round(sum*100/length)
  var result = []

  var rss = filesize(stats.memory.process.rss, {base: 2})
  var free = filesize(stats.memory.system.free , {base: 2})
  var total = filesize(stats.memory.system.total, {base: 2})

  result.push("<b>CPU (1m):    </b>" + cpuMinAvg + "%")
  result.push("<b>CPU (15s):   </b>" + cpuSecAvg + "%")
  result.push("<b>Mem (Proc):  </b>" + rss + " (" + parseInt(stats.memory.process.rss*100/stats.memory.system.total) + "%)")
  result.push("<b>Mem (Free):  </b>" + free + " (" + parseInt(stats.memory.system.free*100/stats.memory.system.total) + "%)")
  result.push("<b>Mem (Total): </b>" + total)
  return result
}

function getLatestChanges(callback) {
  callback(null, [{ "id": "A000045", change: "editted" }])
}

function getLatestPages(callback) {
  PageViews.WeekViews.find({ page: /^(?!(\/js|\/css)).+$/g }).sort({ createdAt: -1 }).limit(300).exec(function(err, pages) {
    var sortedPages = []
    var uniquePages = []
    for (var i = 0; i < pages.length; i++) {
      if (uniquePages.indexOf(pages[i].page) == -1) {
        sortedPages.push({
          page: pages[i].page,
          time: moment(pages[i].createdAt).fromNow()
        })
        uniquePages.push(pages[i].page)
      }
    }
    callback(null, sortedPages.slice(0, 10))
  })
}

function getMostTime(table, amount, callback) {
  var count = {}
  PageViews[table].distinct('page', { page: /^(?!(\/js|\/css)).+$/g }, function(err, pages) {
    async.forEachOf(pages, function(value, key, cb) {
      PageViews[table].count({ page: value }, function(err, counter) {
        count[value] = counter
        cb()
      })
    }, function(err) {
      if (err) logger.error(err)
      var sortable = []
      for (var page in count)
            sortable.push([page, count[page]])
      sortable.sort(
          function(a, b) {
              return b[1] - a[1]
          }
      )
      callback(null, sortable.slice(0, amount))
    })
  })
}

function getDocuments(name, callback) {
  if (name == "ActiveUsers") {
    PageViews.ActiveUsers.count({}, function(err, count) {
      PageViews.ActiveUsers.find({}).limit(9).exec(function(err, documents) {
        PageViews.ActiveUsers.count({}, function(err, count) {
          if (count > 9) {
            documents.push({ email:"nope", name:"And " + (count - 9) + " more..." })
          }
          callback(null, documents)
        })
      })    
    })
  } else {
    PageViews[name].find({}).limit(10).exec(function(err, documents) {
      callback(null, documents)
    })
  }
}

function popularPages(callback) {
  PageViews.PageViews.find({ page: /^(?!(\/js|\/css)).+$/g }).sort({ totalViews: -1 }).limit(10).exec(function(err, pages) {
    callback(null, pages)
  })
}

var getPerms = new Function('number', `
  var adminRanks = ` + JSON.stringify(adminRanks) + `
  var perms = String(new Array(adminRanks.length + 1).join("0") + (number >>> 0).toString(2)).slice(-3)
  var roles = []
  for (var i = 0; i < adminRanks.length; i++) {
    if (perms.charAt(i) == '1') {
      roles.push(adminRanks[i])
    }
  }
  return roles.join(', ')
`)

exports.makeAdmin = function(email, level) {
  User.findOne({ email: email }, function(err, user) {
    if (err) logger.error(err)
    if (user && !err) {
      user.admin = level
      user.save(function(err, updatedUser) {
        if (err) logger.error(err)
        logger.log('Successfully made ' + email + ' admin lvl.' + String(level))
      })
    } else {
      logger.log('No User Found...')
    }
  })
}

exports.makeAdmin('popey@debenclipper.com', 15)