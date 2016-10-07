var User = require('../models/User')
var moment = require('moment')
var logger = require('./logger')()
var crypto = require('crypto')

var adminNames = ['read', 'list', 'write', 'execute']
exports.ensureAdmin = []
ensurePerm = []

for (var i = 0; i < adminNames.length; i++) {
  exports.ensureAdmin[adminNames[i]] = new Function('req', 'res', 'next', `
    if (req.isAuthenticated()) {
      var adminNames = ` + JSON.stringify(adminNames) + `
      var pad = new Array(adminNames.length + 1).join("0")
      var admin = pad + (req.user.admin >>> 0).toString(2)
      var perm = admin.slice(adminNames.length * -1).split("").reverse().join("")
      if (String(perm.charAt(` + i + `)) == "1") {
        console.log("Calling that...")
        next()
      } else {
        console.log("Calling this!")
        res.render('./admin/not_admin', {
          title: "Not An Admin :: OEIS Lookup"
        })
      }
    } else {
      res.redirect('/login?redirect=' + req.url)
    }
  `)
}

for (var i = 0; i < adminNames.length; i++) {
  ensurePerm[adminNames[i]] = new Function('user', `
    if (user) {
      var adminNames = ` + JSON.stringify(adminNames) + `
      var pad = new Array(adminNames.length + 1).join("0")
      var admin = pad + (user.admin >>> 0).toString(2)
      var perm = admin.slice(adminNames.length * -1).split("").reverse().join("")
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

var getPerms = new Function('number', `
  var adminNames = ` + JSON.stringify(adminNames) + `
  var perms = String(new Array(adminNames.length + 1).join("0") + (number >>> 0).toString(2)).slice(-3)
  var roles = []
  for (var i = 0; i < adminNames.length; i++) {
    if (perms.charAt(i) == '1') {
      roles.push(adminNames[i])
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