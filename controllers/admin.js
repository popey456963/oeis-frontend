var User = require('../models/User')
var moment = require('moment')

var adminNames = ['read', 'write', 'execute']
exports.ensureAdmin = []

for (var i = 0; i < adminNames.length; i++) {
  exports.ensureAdmin[adminNames[i]] = new Function('req', 'res', 'next', `
    if (req.isAuthenticated()) {
      var adminNames = ` + JSON.stringify(adminNames) + `
      var pad = new Array(adminNames.length + 1).join("0");
      if (String(pad + (req.user.admin >>> 0).toString(2).slice(adminNames.length * -1).charAt(` + i + `) == "1")) {
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
/*
for (var i = 0; i < adminNames.length; i++) {
  exports.ensurePerm[adminNames[i]] = new Function(`adminLevel
    if (r {
      var adminNames = ` + JSON.stringify(adminNames) + `
      var pad = new Array(adminNames.length + 1).join("0");
      if (String(pad + (req.user.admin >>> 0).toString(2).slice(adminNames.length * -1).charAt(` + i + `) == "1")) {
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
*/

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
        website: docs[i].website
      }
      listOfUsers.push(temp)
    }
    res.render('./admin/users', {
      page: 'User-List',
      section: "Admin",
      title: 'User List :: OEIS Lookup',
      users: listOfUsers,
      getPerms: getPerms,
      AdminController: {
        ensureAdmin: exports.ensurePerm
      }
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