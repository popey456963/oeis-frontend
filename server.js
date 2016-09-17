var express = require('express')
var path = require('path')
var logger = require('morgan')
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

/*// Pretty errors
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
})*/

// Load environment variables from .env file
dotenv.load()

// Controllers
var HomeController = require('./controllers/home')
var UserController = require('./controllers/user')
var AdminController = require('./controllers/admin')

// Passport OAuth strategies
require('./config/passport')

var app = express()

var server = require('http').Server(app)
var io = require('socket.io').listen(server)

// Logger Settings
logger.token('user', function(req, res) { return JSON.stringify(req.user) })
var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})

mongoose.connect(process.env.MONGODB, { config: { autoIndex: false, ensureIndex: false } })
mongoose.connection.on('error', function(err) {
  console.log(err)
  console.log('MongoDB Connection Error. Please make sure that MongoDB is running.')
  process.exit(1)
})
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')
app.set('port', process.env.PORT || 3005)
app.use(compression())
app.use(logger('dev', { stream: accessLogStream }))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(expressValidator())
app.use(methodOverride('_method'))
app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }))
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())
app.use(function(req, res, next) { res.locals.user = req.user; next() })
app.use(express.static(path.join(__dirname, 'public')))

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
app.get('/A:sequence', HomeController.id)
app.get('/search', HomeController.search)
app.post('/test', HomeController.test)
app.get('/langtest', HomeController.langtest)
app.get('/admin/users', AdminController.ensureAdmin['read'], HomeController.adminUsers)

app.use(function(req,res){
    res.status(404).render('404.jade')
})

// Production error handler
if (app.get('env') === 'production') {
  app.use(function(err, req, res, next) {
    console.error(err.stack)
    res.sendStatus(err.status || 500)
  })
} else {
  app.set('view options', {pretty: true})
}

io.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' })
  socket.on('my other event', function (data) {
    console.log(data)
  })
})

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))
})

module.exports = app