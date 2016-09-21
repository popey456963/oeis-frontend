var request = require('request')
var cachedRequest = require('cached-request')(request)
var User = require('../models/User')
var Sequence = require('../models/Sequence')
var old_updates = require('../data/updates')
var seq_list = require('../config/sequences')
var logger = require('./logger')()

logger.log("Hey!")

function hi() {
  logger.log("Bye!")
}


hi()

/**
 * GET /
 */
exports.index = function(req, res) {
  var randomSequence = seq_list[Math.floor(Math.random() * seq_list.length)]
  res.render('search', {
    page: 'Search',
    title: 'Search :: OEIS Lookup',
    sequence: randomSequence
  })
}

/**
 * GET /welcome
 */
exports.welcome = function(req, res) {
  res.render('welcome', {
    title: 'Welcome :: OEIS Lookup',
    page: 'Welcome'
  })
}

/**
 * POST /test
 */
exports.test = function(req, res) {
  var sequence = req.body.sequence  
  var url = 'https://oeis.org/search?fmt=json&q=' + encodeURIComponent(sequence)

  if (sequence == '') {
    res.send('Sequence must not be blank')
  } else {
    superRequest(url, function(data) {
      if (data) {
        if (data.count != 0 && data.results == null) {
          res.send('Too many results.')
        } else if (data.results == null) {
          res.send('No results.')
        } else if (data.count == 1) {
          res.send('1 ' + data.results[0].number)
        } else {
          res.send('')
        }
      } else {
        res.send('OEIS didn\'t provide a good response, despite multiple attempts.  Check their website, or contact us.')
      }
    })
  }
}

/*
 * GET /A******
 */
exports.id = function(req, res) {
  var sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) { sequence = '0' + sequence }
    res.redirect('/A' + sequence)
    return
  }
  if (sequence.length != 6 || isNaN(sequence) || sequence.indexOf('e') > -1) {
    res.render('not_found', {
      title: 'ID Not Found :: OEIS Lookup'
    })
  } else {
    var url = 'https://oeis.org/search?fmt=json&q=id:A' + sequence
    superRequest(url, function(data) {
      if (data) {
        if (data.count == 0 || data.results == null) {
          res.render('not_found', {
            title: 'ID Not Found :: OEIS Lookup'
          })
        } else {
          if (data.results[0].program != undefined) {
            data.results[0].program = parseProgram(data.results[0].program)
          }
          for (var i in data.results[0]) {
            data.results[0][i] = linkName(data.results[0][i])
          }
          res.render('id', {
            page: 'A-Page',
            title: 'A' + sequence + ' :: OEIS Lookup',
            data: data.results[0],
            toTitleCase: function(str){return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});},
            sequenceName: 'A' + sequence,
            id_page: true
          })
          logger.log('Successfully served user wanting to go to A' + sequence)
        }
      } else {
        res.send('OEIS didn\'t provide a good response, despite multiple attempts.  Check their website, or contact us.')
      }
    })
  }
}

/*
 * GET /search
 */
exports.search = function(req, res) {
  var sequence = decodeURIComponent(req.query.q);
  var page = (typeof req.query.page === 'undefined') ? 0 : parseInt(req.query.page) - 1
  var url = 'https://oeis.org/search?fmt=json&q=' + sequence + '&start=' + (page * 10)

  superRequest(url, function(data) {
    res.render('./search_results/search_results', {
      title: 'Search Results :: OEIS Lookup',
      page: 'Search Results',
      query: req.query.q,
      data: data.results,
      numResults: data.count,
      currentPage: data.start / 10,
      maxPage: Math.ceil(data.count / 10),
      sequenceGen: function padLeft(nr, n, str){
        return Array(n-String(nr).length+1).join(str||'0')+nr;
      }
    })
  })
}

/*
 * GET /langtest
 */
exports.langtest = function(req, res) {
  res.render('./test_lang', {
    page: 'Test-Lang',
    title: 'Lang Test :: OEIS Lookup'
  })
}

function parseProgram(program) {
  var transform = {
    'PARI': 'apache',
    'S/R': 'css'
  }
  var languages = []
  var currentCounter = -1
  var re = /^\([a-zA-Z0-9\/\-.]+\)/
  var re2 = /^\(([a-zA-Z0-9\/\-.]+)\)/
  var re3 = /^([.]+)/
  for (var i = 0; i < program.length; i++) {
    var trimmed = false
    if (re.test(program[i])) {
      var group = re2.exec(program[i])[1]
      currentCounter++
      // logger.log(group + ': ' + program[i].replace(re, '').trim())
      program[i] = program[i].replace(re, '').trim()
      languages[currentCounter] = [[group, transform[group]], []]
      // logger.log('Found Group: ' + group)
      trimmed = true
    }
    var replacement = re3.exec(program[i])
    if (replacement && replacement.length > 0) {
      program[i] = program[i].replace(replacement[1], new Array(replacement[1].length + 1).join(' '))
    }
    if (currentCounter != -1 && !(trimmed && program[i].length == 0)) {
      languages[currentCounter][1].push(program[i])
    }
  }
  // logger.log('Language Data: ' + JSON.stringify(languages))
  return languages
}

function superRequest(url, callback, ttl) {
  ttl = (typeof ttl === 'undefined') ? 1000 * 60 * 60 * 24 : ttl
  var options = { url: url, ttl: ttl }
  // logger.log('Super Request Options: ' + options)
  try {
    cachedRequest(options, function(err, resp, body) {
      try {
        callback(JSON.parse(body))
      } catch(e) {
        if (ttl == 0) {
          request(url, function(err, resp, body) {
            try {
              callback(JSON.parse(body))
            } catch(e) {
              logger.warning("We were forced to return false...")
              callback(false)
            }
          })
        } else {
          superRequest(url, callback, 0)
        }
      }
    })
  } catch(e) {
    logger.error("Cached Request had a fatal error whilst handling: " + url)
    logger.error(e)
    request(url, function(err, resp, body) {
      try {
        callback(JSON.parse(body))
      } catch(e) {
        logger.error(e)
        callback(false)
      }
    })
  }
}

function getRecentlyChanged(callback) {
  request('https://oeis.org/recent.txt', function(err, resp, body) {
    if (body) {
      logger.success('Got /recent.txt successfully')
      var text = body.split('\n')
      var updates = []
      for (var i = 0; i < text.length; i++) {
        if (text[i].substring(0, 2) == '%I') {
          updates.push(text[i].split(' ')[1])
        }
      }
      callback(updates)
    } else {
      logger.warning('Failed to get /recent.txt')
    }
  })
}

function findSubstring(arr, subarr, fromIndex) {
    var i = fromIndex >>> 0
    var sl = subarr.length
    var l = arr.length + 1 - sl

    loop: for (; i<l; i++) {
      for (var j=0; j<sl; j++)
        if (arr[i+j] !== subarr[j])
          continue loop
      return i
    }
    return -1
}

if (old_updates = {}) {
  getRecentlyChanged(function(updates) {
    old_updates = updates
    setTimeout(checkUpdate, 100000)
  })
} else {
  setTimeout(checkUpdate, 100000)
}

function checkUpdate() {
  getRecentlyChanged(function(updates) {
    var indexToFind = findSubstring(updates, old_updates.slice(0, 100), 0)
    if (indexToFind != 0) {
      for (var i = 0; i < indexToFind; i++) {
        logger.log('Updated Item: ' + updates[i])
        // updateItem(updates[i])
      }
    }
    old_updates = updates
  })
}

function linkName(text){
  if (text) {
    if (text.constructor === Array) {
      for(var j in text) {
        text[j] = linkName(text[j])
      }
      return text
    } if (text.constructor === String) {
      var link = /_(\S([A-Za-z \.]+)?)_/gm;
      var html = text.replace(link, "<a href='http://oeis.org/wiki/User:$1'>$1</a>");
      return html
    } else {
      return text
    }
  } else {
    return text
  }
}

function updateItem(id, number) {
  superRequest('https://oeis.org/search?q=id:A' + id + '&fmt=json', function(data) {
    // Fix for some weird closure issues.
    var y = data
    Sequence.findOne({number: number}, function(err, seq) {
      var data = y
      if (err) logger.error(err)
      else {
        if (seq === null) {
          logger.log('Sequence Not Found... Creating... ')
          var itemID = new Sequence(data.results[0])
          itemID.data = itemID.data.split(',')
          itemID.save(function(err) {
            if (err) {
              logger.log('Error Saving Sequence: ' + err)
            }
            else {
              logger.log('Created New Item: ' + id)
            }
          })
        } else {
          logger.log('Sequence Found')
          for (var i in data.results[0]) {
            seq[i] = data.results[0][i]
          }
          seq.data = seq.data.split(',')
          seq.save(function(err) {
            if (err) logger.error(err)
            else {
              logger.log('Sequence Updated')
            }
          })
        }
      }
    })
  })
}

function listItems() {
  Sequence.find({}, function(err, docs) {
    logger.error(err)
    logger.log(docs)
  })
}

// Sequence.remove({}, function(err) { if (!err) logger.success('Collection Removed.') })

function updateOne(id) {
  var text = ('000000' + String(id)).substring(String(id).length)
  // Possibly need to change this to just request.  We don't really want to
  // Use the super request because that includes logging...
  superRequest('https://oeis.org/search?q=id:A' + text + '&fmt=json', function(newData) {
    var query = { number: id }
    if (newData && newData.results && newData.results[0]) {
      var update = newData.results[0]
      var options = { upsert: true, new: true }

      Sequence.findOneAndUpdate(query, update, options, function(err, result) {
        if (err) {
          logger.error(err)
          Hi
        }
        logger.success(text + ' was updated successfully!')
      })
    } else {
      logger.error('Request returned something wrong when trying to update one...')
    }
  })
}

function updateAll(max) {
  for (var i = 1; i <= max; i++) {
    setTimeout(function(i) { try{ updateOne(i) } catch(e) { logger.error(e) } }, i * 400, i)
  }
}

// updateAll(1000)

updateOne(72)

// updateItem('000011')

// updateAll(100)