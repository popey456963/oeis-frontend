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
var i18n = require('i18n')
var cookieParser = require('cookie-parser')
var WebSocket = require('ws')
var url = require('url')
// var httpProxy = require('http-proxy')

// Load environment variables from .env file
dotenv.load()

// Initiate Websocket
global.ws = new WebSocket('ws://localhost:8080')

global.ws.onerror = function(event) {
  global.wserror = true
  logger.warning("Could not connect to websocket server")
  startServer()
}

global.ws.on('open', function open() {
  global.ws.on('message', function(data, flags) {
    logger.log(data)
  })
  logger.success("Connected to websocket server")
  startServer()
})

function startServer() {
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

  // REPL
  if (process.env.REPL == 'true') {
    function evalInContext(js, context) { return function() { return eval(js); }.call(context) }
    var empty = '(' + os.EOL + ')'
    repl.start({
      prompt: '',
      input: process.stdin,
      output: process.stdout,
      eval: function(cmd, context, filename, callback) {
        if (cmd === empty) return callback()
        var result = evalInContext(cmd, this)
        callback(null, result)
      }
    })
  }

  /* Old, now defunct REPL code, left for posterity.
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  var util = require('util');

  process.stdin.on('data', function (text) {
    logger.log('received data:', util.inspect(text.replace('\r\n', '')));
  });
  */

  // Controllers
  var HomeController = require('./controllers/home')
  var UserController = require('./controllers/user')
  var AdminController = require('./controllers/admin')
  var StatsController = require('./controllers/stats')
  var DevController = require('./controllers/dev')
  var ApiController = require('./controllers/api')
  var SearchController = require('./controllers/search')

  // Passport OAuth strategies
  require('./config/passport')

  var app = express()

  // Start Socket.io server
  var server = require('http').Server(app)
  var io = require('socket.io').listen(server)

  // Configure Localisation
  i18n.configure({
      locales:['en', 'de'],
      directory: __dirname + '/locales',
      cookie: 'lang',
      queryParameter: 'lang',
      debug: true
  })

  // Proxy Setup
  // var iframeProxy = httpProxy.createProxyServer()

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
  //app.use(httpLogger('common', { stream: accessLogStream }))
  app.use(httpLogger('dev'))
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))
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
  app.use(cookieParser())
  app.use(i18n.init)
  app.use(function(req, res, next) { 
    res.locals.user = req.user
    res.locals.cookies = req.cookies
    res.locals.langs = require('./config/langnames.json')
    next() 
  })
  app.use(function(req, res, next) { res.locals.cookies = req.cookies; next() })
  app.use(express.static(path.join(__dirname, 'public')))
  app.use('/docs', express.static(path.join(__dirname, 'docs')))
  app.use(StatsController.statsDaemon)

  /*
  app.all('/wiki/*', function(req, res) {
    logger.log("Redirecting Iframe Request")
    iframeProxy.web(req, res, { target: 'http://oeis.org' });
  })
  */

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

  app.get('/api', ApiController.api)

  app.get('/', HomeController.index)
  app.get('/favourites', UserController.ensureAuthenticated, HomeController.favourites)
  app.get('/welcome', HomeController.welcome)
  app.get('/admin', AdminController.ensureAdmin['read'], AdminController.adminPage)
  app.get('/admin/stats', AdminController.ensureAdmin['read'], AdminController.adminStats)
  app.get('/admin/users', AdminController.ensureAdmin['list'], AdminController.adminUsers)
  app.get('/A:sequence', HomeController.id)
  app.get('/A:sequence/edit', UserController.ensureAuthenticated, HomeController.editSequence)
  app.post('/A:sequence/edit', HomeController.postEditSequence)
  app.post('/A:sequence/favourite', UserController.ensureAuthenticated, HomeController.favourite)
  app.post('/A:sequence/unfavourite', UserController.ensureAuthenticated, HomeController.unfavourite)
  app.get('/search', HomeController.search)
  app.get('/search2', SearchController.search)
  app.post('/test', HomeController.test)
  app.get('/langtest', DevController.langtest)


  app.use(function(req,res){
    request('http://oeis.org' + req.url, function (error, response, body) {
      if (!error && response.statusCode == 404) {
        res.status(404).render('404.jade')
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
    app.locals.pretty = true
  }

  // We are avoiding sockets at all costs...
  io.on('connection', function (socket) {
    socket.emit('news', 'Hello friendly individual who appears to be poking around this website.  You look lonely, wanna chat?  Send back an event with the name of "hello" with some way of contacting you.  I\'d love to get in touch.')
    socket.on('hello', function (data) {
      logger.log('Well, uhm, someone sent us some contact data:')
      logger.log(data)
    })
  })

  server.listen(app.get('port'), function(){
    logger.log('Express server listening on port ' + app.get('port'))
  })

  module.exports = app
}