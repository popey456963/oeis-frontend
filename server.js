// At some point consider doing something with:
// border-bottom: 1.5px dotted #888888;

var express = require('express')
var path = require('path')
var httpLogger = require('morgan')
var compression = require('compression')
var methodOverride = require('method-override')
var session = require('express-session')
var flash = require('express-flash')
var bodyParser = require('body-parser')
var expressValidator = require('express-validator')
var dotenv = require('dotenv')
var mongoose = require('mongoose')
var passport = require('passport')
var fs = require('fs')
var request = require('request')
var logger = require('./controllers/logger')()
var repl = require('repl')
var os = require('os')
var MongoStore = require('connect-mongo')(session)

// Pretty errors
var pe = require('pretty-error').start()
pe.appendStyle({
  'pretty-error > trace > item > footer > addr': {
      display: 'none'
  },
  'pretty-error > trace > item > footer': {
    display: 'block'
  },
  'pretty-error > trace > item': {
    display: 'block',
    marginBottom: 0,
    marginLeft: 2,
    bullet: '"<grey>-</grey>"'
  }
})

// Load environment variables from .env file
dotenv.load()

// REPL
if (process.env.REPL == 'true') {
  function evalInContext(js, context) { return function() { return eval(js); }.call(context) }
  var empty = '(' + os.EOL + ')'
  repl.start({
    input: process.stdin,
    output: process.stdout,
    eval: function(cmd, context, filename, callback) {
      if (cmd === empty) return callback()
      var result = evalInContext(cmd, this)
      callback(null, result)
    }
  })
}

/*
process.stdin.resume();
process.stdin.setEncoding('utf8');
var util = require('util');

process.stdin.on('data', function (text) {
  console.log('received data:', util.inspect(text.replace('\r\n', '')));
});
*/

// Controllers
var HomeController = require('./controllers/home')
var UserController = require('./controllers/user')
var AdminController = require('./controllers/admin')
var StatsController = require('./controllers/stats')

// Passport OAuth strategies
require('./config/passport')

var app = express()

// Start Socket.io server
var server = require('http').Server(app)
var io = require('socket.io').listen(server)

// Logger Settings
httpLogger.token('user', function(req, res) { return JSON.stringify(req.user) })
var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})

// Connect to Mongoose database & Fix Promise Error
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB, { config: { autoIndex: false, ensureIndex: false } })
mongoose.connection.on('error', function(err) {
  logger.error('MongoDB Connection Error. Please make sure that MongoDB is running.')
  process.exit(1)
})
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')
app.set('port', process.env.PORT || 3005)
app.use(compression())
app.use(httpLogger('common', { stream: accessLogStream }))
app.use(httpLogger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(expressValidator())
app.use(methodOverride('_method'))
app.use(session({ 
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}))
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())
app.use(function(req, res, next) { res.locals.user = req.user; next() })
app.use(express.static(path.join(__dirname, 'public')))
app.use(StatsController.statsDaemon)

app.get('/account', UserController.ensureAuthenticated, UserController.accountGet)
app.put('/account', UserController.ensureAuthenticated, UserController.accountPut)
app.delete('/account', UserController.ensureAuthenticated, UserController.accountDelete)
app.get('/signup', UserController.signupGet)
app.post('/signup', UserController.signupPost)
app.get('/login', UserController.loginGet)
app.post('/login', UserController.loginPost)
app.get('/forgot', UserController.forgotGet)
app.post('/forgot', UserController.forgotPost)
app.get('/reset/:token', UserController.resetGet)
app.post('/reset/:token', UserController.resetPost)
app.get('/logout', UserController.logout)
app.get('/unlink/:provider', UserController.ensureAuthenticated, UserController.unlink)
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }))
app.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/', failureRedirect: '/login' }))
app.get('/auth/twitter', passport.authenticate('twitter'))
app.get('/auth/twitter/callback', passport.authenticate('twitter', { successRedirect: '/', failureRedirect: '/login' }))

app.get('/', HomeController.index)
app.get('/welcome', HomeController.welcome)
app.get('/admin', AdminController.ensureAdmin['read'], AdminController.adminPage)
app.get('/admin/stats', AdminController.ensureAdmin['read'], AdminController.adminStats)
app.get('/admin/users', AdminController.ensureAdmin['list'], AdminController.adminUsers)
app.get('/A:sequence', HomeController.id)
//app.get('/A:sequence/edit', HomeController.editSequence)
app.get('/search', HomeController.search)
app.post('/test', HomeController.test)
app.get('/langtest', HomeController.langtest)

app.use(function(req,res){
  request('http://oeis.org' + req.url, function (error, response, body) {
    if (!error && response.statusCode == 404) {
      res.render('404.jade')
    } else {
      res.status(response.statusCode).render('frame.jade', { url: 'http://oeis.org' + req.url })
    }
  })
})

// Production error handler
if (app.get('env') === 'production') {
  app.use(function(err, req, res, next) {
    logger.error(err.stack)
    res.sendStatus(err.status || 500)
  })
} else {
  app.set('view options', {pretty: true})
}

io.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' })
  socket.on('my other event', function (data) {
    logger.log(data)
  })
})

server.listen(app.get('port'), function(){
  logger.log('Express server listening on port ' + app.get('port'))
})

module.exports = app