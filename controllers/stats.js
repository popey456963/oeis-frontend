var PageViews = require('../models/PageViews')

function handleError(err) {
  if (err) console.log(err)
}

exports.statsDaemon = function (req, res, next) {
  var url = req.url.split("?")[0]

  var pageInformation = {
    page: url
  }

  console.log("Someone visited page " + url + " with method " + req.method)
  if (req.method == "GET") {
    var hour = new PageViews.HourViews(pageInformation); hour.save(handleError)
    var day =  new PageViews.DayViews(pageInformation);  day.save(handleError)
    var week = new PageViews.WeekViews(pageInformation); week.save(handleError)
    if (req.user) {
      // console.log(req.user)
      PageViews.ActiveUsers.remove({ email: req.user.email}, handleError)
      var active = new PageViews.ActiveUsers({ email: req.user.email, name: req.user.name }); active.save(handleError)
    }
    PageViews.PageViews.findOne({ page: url }, function(err, doc) {
      if (err) console.log(err)
      if (!doc) {
        var page = new PageViews.PageViews({ page: url, totalViews: 1}); page.save(handleError)
      } else {
        doc.totalViews += 1
        doc.save()
      }
    })
  }
  next()
}