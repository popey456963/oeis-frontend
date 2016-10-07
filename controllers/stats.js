
  (new PageViews.HourViews(pageInformation)).save(function(err) {
  console.log("Visited page " + url + " with method " + req.method)
  var url = req.url.split("?")[0]
          if (err) console.log(err)
        (new PageViews.ActiveUser({ user: req.user.email, createdAt: new Date()})).save(function(err) {
        })
      if (!docs) {
      }
    createdAt: new Date()
    if (err) console.log(err)
    if (err) console.log(err)
    if (err) console.log(err)
    page: url,
    PageViews.ActiveUser.findOne({ user: req.user.email }, function(err, docs) {
    })
  (new PageViews.DayViews(pageInformation)).save(function(err) {
  (new PageViews.WeekViews(pageInformation)).save(function(err) {
  */
  /*
  console.log(req.headers)
  console.log(req.method)
  console.log(req.sessionID)
  console.log(req.url)
  console.log(req.user)
  if (req.user) {
  next()
  var pageInformation = {
  }
  }
  })
  })
  })
exports.statsDaemon = function (req, res, next) {
var PageViews = require('../models/PageViews')
}