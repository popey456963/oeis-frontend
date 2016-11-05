var User = require('../models/User')
var PageViews = require('../models/PageViews')
var moment = require('moment')
var logger = require('./logger')()
var crypto = require('crypto')

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
  popularPages(function(popularPages) {
    getLatestPages(function(latestPages) {
      getDocuments('HourViews', function(HourViews) {
        getDocuments('DayViews', function(DayViews) {
          getDocuments('WeekViews', function(WeekViews) {
            getDocuments('ActiveUsers', function(ActiveUsers) {
              var LatestChanges = [{ "id": "A000045", change: "editted" }]
              res.render('./admin/stats', {
                page: "Admin-Stats",
                section: "Admin",
                title: "Statistics :: OEIS Lookup",
                popularPages: popularPages,
                hourViews: HourViews,
                dayViews: DayViews,
                weekViews: WeekViews,
                activeUsers: ActiveUsers,
                latestChanges: LatestChanges,
                latestPages: latestPages
              })
            })
          })
        })
      })
    })
  })
}

function getLatestPages(callback) {
  PageViews.WeekViews.find({}).sort({ createdAt: -1 }).limit(300).exec(function(err, pages) {
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
    callback(sortedPages.slice(0, 10))
  })
}

function getDocuments(name, callback) {
  PageViews[name].find({}, function(err, documents) {
    if (err) logger.error(err)
    callback(documents)
  })
}

function popularPages(callback) {
  PageViews.PageViews.find({}).sort({ totalViews: -1 }).limit(10).exec(function(err, pages) {
    callback(pages)
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
        logger.log('Successfully Made ' + email + ' Admin Lvl.' + String(level))
      })
    } else {
      logger.log('No User Found...')
    }
  })
}

exports.makeAdmin('popey@debenclipper.com', 15)