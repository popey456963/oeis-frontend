var request = require('request')
var fs = require('fs')
var utils = require('../controllers/utils')
var User = require('../models/User')
var Sequence = require('../models/Sequence')
var Favourite = require('../models/Favourite')
var old_updates = require('../data/updates')
var seq_list = require('../config/sequences')
var logger = require('./logger')()
var toMarkdown = require('to-markdown')
var async = require('async')
var entities = new (require('html-entities').XmlEntities)()
var XRegExp = require('xregexp')
 
/**
 * @module HomeController
 */

const GRAB_INTERVAL = 300
const BASE_URL = 'https://oeis.org/'

/**
 * Handles any get requests to `/`.  This program responds to the user with a
 * rendered Jade template of the search page, including a random sequence.
 * 
 * @function index
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.index = function(req, res) {
  res.render('search', {
    page: 'Search',
    title: 'Search :: OEIS Lookup',
    sequence: seq_list[Math.floor(Math.random() * seq_list.length)]
  })
}

/**
 * Handles any get requests to `/welcome`.  This program responds to the user
 * with a rendered Jade template of the welcome page, a static page that can
 * be heavily cached.
 *
 * @function welcome
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.welcome = function(req, res) {
  res.render('welcome', {
    title: 'Welcome :: OEIS Lookup',
    page: 'Welcome'
  })
}

/**
 * Handles whenever a program cannot find a specific sequence, sending
 * back a rendered Jade file of the home page with a `req.flash()` style
 * error.
 *
 * @function seqNotFound
 * @instance
 * @param {object} res - The response object to reply to the client.
 */
function seqNotFound(res) {
  res.render('search', {
    page: 'Search',
    title: 'Sequence Not Found :: OEIS Lookup',
    sequence: seq_list[Math.floor(Math.random() * seq_list.length)],
    error: 'Sequence Not Found'
  })
}

/**
 * Handles any post requests to `/test`.  This program responds to the user
 * with a reply of whether or not the request has too many, none or just one
 * repsonse.  Depending on this the client should then respond with an alert
 * to the user or a redirect to the search results or A-page.
 *
 * @function test
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.test = function(req, res) {
  var sequence = req.body.sequence
  var url = BASE_URL + 'search?fmt=json&q=' + encodeURIComponent(sequence)

  if (sequence == '') {
    res.send('Sequence must not be blank')
  } else {
    utils.superRequest(url, function(data) {
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
        res.send('The OEIS didn\'t provide a good response, despite multiple attempts.  Check their website, or contact us.')
      }
    })
  }
}

/**
 * Handles any post requests to `/A:seq`.  This program responds to the user
 * with either a redirect to a fully formed sequence page, an error page if
 * the sequence is not found or a rendered Jade page giving information on
 * an ID.  This program uses `parseProgram` and `linkName` to parse the data.
 *
 * @function id
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.id = function(req, res) {
  var sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) {
      sequence = '0' + sequence
    }
    res.redirect('/A' + sequence)
    return
  }
  if (sequence.length != 6 || isNaN(sequence) || sequence.indexOf('e') > -1) {
    return seqNotFound(res)
  } else {
    Sequence.findOne({
      number: sequence
    }).lean().exec(function(err, doc) {
      if (!doc) {
        if (0 < parseInt(sequence) < 277000) {
          updateOne(parseInt(sequence))
        }
        return seqNotFound(res)
      } else {
        if (doc.program) {
          doc.program = parseProgram(doc.program)
        }
        for (var i in doc) {
          doc[i] = linkName(doc[i])
        }
        if (req.user) {
          Favourite.find({ email: req.user.email, seq: sequence }, function(err, docs) {
            var isFavourite = false
            if (docs.length > 0) {
              console.log("Favourite")
              console.log(docs)
              isFavourite = true
              finalRender(sequence, isFavourite, doc, res)
            }
          })
        } else {
          finalRender(sequence, false, doc, res)
        }
      }
    })
  }
}

function finalRender(sequence, isFavourite, doc, res) {
  res.render('id', {
    page: 'A-Page',
    title: 'A' + sequence + ' :: OEIS Lookup',
    favourite: isFavourite,
    data: organiseData(doc, false),
    toTitleCase: function(str) {
      return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      })
    },
    sequenceName: 'A' + sequence,
    id_page: true
  })
}

/**
 * Organises sequence data into a certain order to match the order shown
 * on the official OEIS website.  Also optionally replaces all undefined values
 * with `<no data>` depending on the `edit` boolean.  At the moment, this is
 * only used on the edit page.
 *
 * @function organiseData
 * @instance
 * @param {object} data - All information on a specific sequence
 * @param {boolean} edit - If true, undefined values are replaced with `<no data>`
 */
function organiseData(data, edit) {
  headers = ['number', 'name', 'references', 'revision', 'id', 'data', 'comment', 'reference', 'link', 'formula', 'example', 'maple', 'mathematica', 'program', 'xref', 'keyword', 'author']
  obj = {}
  for (var i = 0; i < headers.length; i++) {
    if (data[headers[i]]) {
      obj[headers[i]] = data[headers[i]]
    } else if (edit) {
      obj[headers[i]] = "<no data>"
    }
  }
  return obj
}

/**
 * Assuming the `/test` post has worked, search requests get routed to a
 * `/search` url with parameters of `q` for the query string and `page`
 * for the pagination.  This requests from the OEIS website to get the
 * search results before displaying to the user a rendered Jade page or
 * error message (if no results).
 * 
 *
 * @function search
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.search = function(req, res) {
  var sequence = decodeURIComponent(req.query.q)
  var page = (typeof req.query.page === 'undefined') ? 0 : parseInt(req.query.page) - 1
  var url = BASE_URL + 'search?fmt=json&q=' + sequence + '&start=' + (page * 10)

  utils.superRequest(url, function(data) {
    if (data && data.results && data.count > 0) {
      data = parseSearch(data, req.query.q)
      res.render('./search_results/search_results', {
        title: 'Search Results :: OEIS Lookup',
        page: 'Search Results',
        query: req.query.q,
        data: data.results,
        numResults: data.count,
        currentPage: data.start / 10,
        maxPage: Math.ceil(data.count / 10),
        sequenceGen: function padLeft(nr, n, str) {
          return Array(n - String(nr).length + 1).join(str || '0') + nr
        }
      })
    } else {
      res.render('./search_results/no_results', {
        title: 'No Results :: OEIS Lookup',
        page: 'Search Results',
        query: req.query.q,
        count: data.count
      })
    }
  })
}

/**
 * Renders a Jade file that contains a list of all sequences that
 * have been favourited by an individual.
 * 
 * @function search
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.favourites = function(req, res) {
  Favourite.find({ email: req.user.email }, 'seq -_id', function(err, docs) {
    var seq_info = []

    async.forEachOf(docs, function (doc, key, callback) {
      getFavInfo(doc.seq, function(data) {
        seq_info.push(data)
        callback()
      })
    }, function (err) {
      seq_info.sort(function(a, b){
        var a = a.number
        var b = b.number
        if(a < b) return -1;
        if(b > a) return 1;
        return 0;
      })
      res.render('./account/favourites', {
        title: 'Favourites :: OEIS Lookup',
        page: 'Favourites',
        favourites: seq_info,
        number: docs.length,
        sequenceGen: function padLeft(nr, n, str) {
          return Array(n - String(nr).length + 1).join(str || '0') + nr
        }
      })
    })
  })
}

function getFavInfo(seq, callback) {
  Sequence.findOne({ number: parseInt(seq) }).lean().exec(function(err, doc){
    callback({
      number: doc.number,
      time: doc.time,
      keyword: doc.keyword,
      name: doc.name,
      data: doc.data
    })
  })
}

/**
 * Returns a rendered Jade template to any request that matches
 * `/A:sequence/edit`.  In order to do this it checks the sequence
 * exists before organising ing  and then parsing it into markdown.
 *
 * @function editSequence
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.editSequence = function(req, res) {
  var sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) {
      sequence = '0' + sequence
    }
    res.redirect('/A' + sequence + '/edit')
    return ""
  }
  if (sequence.length != 6 || isNaN(sequence) || sequence.indexOf('e') > -1) {
    return seqNotFound(res)
  } else {
    Sequence.findOne({
      number: sequence
    }).lean().exec(function(err, doc) {
      if (!doc) {
        return seqNotFound(res)
      } else {
        [doc, unused] = toMarkdownData(organiseData(doc, true))
        res.render('edit_seq', {
          title: 'Edit A' + sequence + ' :: OEIS Lookup',
          page: 'Edit Sequence',
          data: doc,
          unused: unused,
          id: sequence,
          required: ['number', 'name', 'data', 'keyword', 'author'],
          short: ['number', 'name', 'references', 'revision', 'id', 'keyword', 'author'],
          toTitleCase: function(str) {
            return str.replace(/\w\S*/g, function(txt) {
              return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            })
          }
        })
      }
    })
  }
}

function toMarkdownData(doc) {
  var unused = []
  if (1) { console.log = function() { /* Do Nothing */ } }
  for (var i in doc) {
    if (doc[i] == "<no data>") {
      unused.push(i)
    } else {
      console.log("== Sorting out doc[" + i + "] ==")
      if (doc[i].constructor === Array) {
        console.log("It's an array")
        for (var j = 0; j < doc[i].length; j++) {
          if (typeof doc[i][j] === "string") {
            console.log("It's a string array")
            doc[i][j] = toMarkdown(doc[i][j])
            console.log("Parsing complete")
          } else {
            console.log("It's not a string, it's a: " + typeof doc[i][j])
          }
        }
      } else {
        if (typeof doc[i] === "string") {
          console.log("It's a string")
          doc[i] = toMarkdown(doc[i])
          console.log("Parsing Complete")
        } else {
          console.log("It's not a string, it's a: " + typeof doc[i])
        }
      }
    }
  }
  console.log("Returned")
  return [doc, unused]
}

/**
 * Handles any post requests to `/A:seq/edit`.
 *
 * @function postEditSequence 
 * @instance
 * @param {object} req - The request object sent by the client
 * @param {object} res - The response object to reply to the client.
 */
exports.postEditSequence = function(req, res) {
  Sequence.findOne({ number: req.body.number }, function(err, doc) {
    if (!doc) {
      res.json({ "success": false, "err": "Sequence Number Not Found..."})
    } else {
      var changes = {}
      for (var item in req.body) {
        if (req.body[item].indexOf('\n') != -1) {
          req.body[item] = req.body[item].split(/\r?\n/)
        }
        if (item == "data") {
          req.body[item] = req.body[item].split(", ").join(",")
        }
        if (req.body[item].constructor === Array) {
          changes[item] = "Unchanged"
          var check = arrayCheck(doc[item], req.body[item])
          if (!check[0]) {
            changes[item] = "Changed, " + JSON.stringify(check[1])
          }
          if (doc[item] == "" || doc[item] == [] || !doc[item]) {
            if (req.body[item] && req.body[item] != "" && req.body[item] != []) {
              changes[item] = "Created"
            }
          }
          if (doc[item] && doc[item] != "" || req.body[item] != []) {
            if (!req.body[item] && req.body[item] == "" && req.body[item] == []) {
              changes[item] = "Removed"
            }
          } 
        } else {
          changes[item] = "Unchanged"
          if (doc[item] != req.body[item]) {
            changes[item] = "Changed, " + JSON.stringify([doc[item], req.body[item]])
          }
          if (!doc[item] && req.body[item]) {
            changes[item] = "Created"
          }
          if (doc[item] && !req.body[item]) {
            changes[item] = "Removed"
          }
        }
      }
      res.json([req.body, changes])
    }
  })
}

function arrayCheck(arr1, arr2) {
  if(arr1.length !== arr2.length)
    return [false, ["length", arr1.length, arr2.length]]
  for(var i = arr1.length; i--;) {
    if(arr1[i] !== arr2[i])
      return [false, [arr1[i], arr2[i]]]
  }
  return [true, "true"];
}

exports.favourite = function(req, res) {
  var sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) {
      sequence = '0' + sequence
    }
    res.redirect('/A' + sequence + '/favourite')
    return ""
  }
  console.log(sequence)
  if (sequence.length != 6 || isNaN(sequence) || sequence.indexOf('e') > -1) {
    return seqNotFound(res)
  } else {
    Favourite.findOneAndUpdate({
      email: req.user.email,
      seq: sequence
    }, {}, {
      upsert: true
    }, function(err, docs) {
      if (err) logger.error(err)
      logger.success("[+] Favourite Email: " + req.user.email + " Seq: " + sequence)
      res.send("Favourited")
    })
  }
}

exports.unfavourite = function(req, res) {
  var sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) {
      sequence = '0' + sequence
    }
    res.redirect('/A' + sequence + '/unfavourite')
    return ""
  }
  if (sequence.length != 6 || isNaN(sequence) || sequence.indexOf('e') > -1) {
    return seqNotFound(res)
  } else {
    Favourite.remove({
      email: req.user.email,
      seq: sequence
    }, function(err) {
      if (err) logger.error(err)
      logger.success("[-] Unfavourite Email: " + req.user.email + " Seq: " + sequence)
    res.send("Unfavourited")
    })
  }
}

/**
 * Parse a query and a data response to highlight the found data points.
 *
 * @param {object} data - The data returned from the OEIS API.
 * @param {string} query - The query requested by the user.
 */
function parseSearch(data, query) {
  // We gotta go from a sequence of data points, to bolded data points.

  // Here we parse the search query
  var query = query.split(" ")
  numbers = []
  sequences = []
  for (var i = 0; i < query.length; i++) {
    if (!isNaN(query[i])) {
      numbers.push(query[i])
    } else {
      // We need to work out if it's a sequence of numbers.
      var seq = true
      var seq_query = query[i].split(",")
      for (var j = 0; j < seq_query.length; j++) {
        if (isNaN(seq_query[j])) {
          // We're afraid it isn't a sequence...
          seq = false
          break
        }
      }
      if (seq) {
        sequences.push(seq_query)
      }
    }
  }

  // Here we carry out the highlighting from the parsed search query
  for (var i = 0; i < data.results.length; i++) {
    var list_values = data.results[i].data.split(",")
      // console.log(data.results[i].data)
      // We start by highlighting the sequences:
    for (var j = 0; j < sequences.length; j++) {
      var inner = utils.findSubstring(list_values, sequences[j], 0)
      if (inner != -1) {
        list_values[inner] = "<b>" + list_values[inner]
        list_values[inner + sequences[j].length - 1] = list_values[inner + sequences[j].length - 1] + "</b>"
      }
    }
    for (var j = 0; j < list_values.length; j++) {
      for (var k = 0; k < numbers.length; k++) {
        if (numbers[k] == list_values[j]) {
          list_values[j] = "<b>" + list_values[j] + "</b>"
        }
      }
    }
    data.results[i].data = list_values.join(",")
  }
  return data
}

function parseProgram(program) {
  var transform = {
    'PARI': 'apache',
    'S/R': 'css'
  }
  var languages = []
  var currentCounter = -1
  var programNameRe = /^\(([a-zA-Z0-9\/\-. ])+\)/
  var matchAnythingRe = /^([.]+)/
  for (var i = 0; i < program.length; i++) {
    var trimmed = false
    if (programNameRe.test(program[i])) {
      var group = programNameRe.exec(program[i])[0]
      currentCounter++
      program[i] = program[i].replace(programNameRe, '').trim()
      languages[currentCounter] = [
        [group, transform[group]],
        []
      ]
      trimmed = true
    }
    var replacement = matchAnythingRe.exec(program[i])
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

function getRecentlyChanged(callback) {
  request('http://oeis.org/recent.txt', function(err, resp, body) {
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

if (old_updates == {}) {
  getRecentlyChanged(function(updates) {
    old_updates = updates
    setInterval(checkUpdate, 3600000)
  })
} else {
  setInterval(checkUpdate, 3600000)
}

function checkUpdate() {
  getRecentlyChanged(function(updates) {
    var indexToFind = utils.findSubstring(updates, old_updates.slice(0, 100), 0)
    if (indexToFind != 0) {
      for (var i = 0; i < indexToFind; i++) {
        logger.log('Updated Item: ' + updates[i])
          updateOne(parseInt(updates[i].substring(1)))
      }
    }
    old_updates = updates
    fs.writeFile('./data/updates.json', JSON.stringify(old_updates, null, 4), function(err) {
      if (err) {
        logger.error(err)
      } else {
        logger.log("Updates Saved")
      }
    })
  })
}

function linkName(text, group) {
  if (text) {
    if (text.constructor === Array) {
      for (var j in text) {
        text[j] = linkName(text[j])
      }
      return text
    }
    if (text.constructor === String) {
      text = entities.encode(text)

      text = findSeqs(text)
      text = findLinks(text)
      text = replaceNames(text)

      return text
    } else {
      return text
    }
  } else {
    return text
  }
}

function findSeqs(text) {
  // Implementation of this seems harder than expected.
  return text
}

function findLinks(text) {
  var match
  var link = /&lt;a([^>]+)&gt;(.+?)&lt;\/a&gt;/gi

  do {
      match = link.exec(text)
      if (match) {
        text = text.replace(match[0], entities.decode(match[0]))
      }
  } while (match)

  return text
}

function replaceNames(text) {
  var regex
  var names = []
  var link = new XRegExp('_([\\p{L} .-]{1,80})_', 'g')

  do {
      regex = link.exec(text)
      if (regex && regex[1].indexOf(" ") != -1) {
          names.push(regex[1])
      }
  } while (regex)

  for (var i = 0; i < names.length; i++) {
    text = text.replace(new RegExp(("_"+names[i]+"_").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), 'g'),
      "<a class='name_link' href='http://oeis.org/wiki/User:" + names[i] + "'>" + names[i] + "</a>")
  }

  return text
}

function updateItem(id, number) {
  utils.superRequest(BASE_URL + 'search?q=id:A' + id + '&fmt=json', function(data) {
    // Fix for some weird closure issues.
    var y = data
    Sequence.findOne({
      number: number
    }, function(err, seq) {
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
            } else {
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

function updateOne(id) {
  var text = ('000000' + String(id)).substring(String(id).length)
  // Some point might want to turn this to Request instead of SuperRequest
  // We don't really want caching on updating id's.
  utils.superRequest(BASE_URL + 'search?q=id:A' + text + '&fmt=json', function(newData) {
    var query = {
      number: id
    }
    if (newData && newData.results && newData.results[0]) {
      var update = newData.results[0]
      var options = {
        upsert: true,
        new: true
      }
      Sequence.findOneAndUpdate(query, update, options, function(err, result) {
        if (err) {
          logger.error(err)
          throw err
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
    setTimeout(function(i) {
      try {
        updateOne(i)
      } catch (e) {
        logger.error(e)
      }
    }, i * GRAB_INTERVAL, i)
  }
}

function updateRange(min, max) {
  for (var i = min; i <= max; i++) {
    setTimeout(function(i, min) {
      try {
        updateOne(i)
      } catch (e) {
        logger.error(e)
      }
    }, (i - min) * GRAB_INTERVAL, i, min)
  }
}

function makeNew(min, max) {
  console.log("I got called with: " + min + " " + max)
  currentTimeout = 0
  for (var i = min; i <= max; i++) {
    console.log("Tried Lookup For: " + i)
    Sequence.find({
      number: i
    }, function(err, docs) {
      if (err) {
        console.log(err)
      }
      console.log(docs)
      if (!docs || docs == []) {
        console.log("Make New Registering Update For: " + i)
        setTimeout(function(currentTimeout) {
          try {
            updateOne(i)
          } catch (e) {
            logger.error(e)
          }
        }, currentTimeout * GRAB_INTERVAL, currentTimeout, i)
        currentTimeout++
      }
    })
  }
}

function findMissing(max, callback) {
  Sequence.find({}, 'number -_id', function(err, docs) {
    var array = []
    docs.forEach(function(item) {
      array.push(item.number)
    })
    array = array.sort(function(a, b) {
      return a - b
    })
    var count = 1
    var arrayEntry = 0
    var missing = []
    while (arrayEntry != array.length && count < max) {
      if (array[arrayEntry] != count) {
        missing.push(count)
        count += 1
      } else {
        count += 1
        arrayEntry += 1
      }
    }
    while (count < max) {
      missing.push(count)
      count++
    }
    callback(missing)
  })
}

function testAndUpdate(value) {
  Sequence.find({
    number: value
  }, function(err, docs) {
    if (err) console.log(err)
    if (JSON.stringify(docs) == "[]") {
      console.log("Grabbing sequence number " + value)
    } else {
      console.log("Sequence number " + value + "exists and hasn't been grabbed")
    }
  })
}

function bootstrapFindMissing(value, multiplier) {
  if (!multiplier) multiplier = 1
  findMissing(value, function(missing) {
    currentTimeout = 0
    for (var i = 0; i < missing.length; i++) {
      setTimeout(function(currentTimeout, j, multiplier) {
        try {
          updateOne(j)
        } catch (e) {
          logger.error(e)
        }
      }, currentTimeout * GRAB_INTERVAL * multiplier, currentTimeout, missing[i], multiplier)
      currentTimeout++
    }
  })
}

// bootstrapFindMissing(100000, 30)
// bootstrapFindMissing(100000, 20)