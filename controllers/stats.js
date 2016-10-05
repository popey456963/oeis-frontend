

exports.statsDaemon = function (req, res, next) {
  if (req.user) {
  	console.log("User " + req.user.name + " visited page " + req.url + " with method " + req.method)
  } else {
    console.log(req.headers)
    console.log(req.url)
    console.log(req.method)
    console.log(req.sessionID)
    console.log(req.user)
  }
  next()
}