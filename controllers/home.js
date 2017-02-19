const XRegExp = require('xregexp')
const toMarkdown = require('to-markdown')
const async = require('async')
const request = require('request')
const entities = new (require('html-entities').XmlEntities)()
const fs = require('fs')
const logger = require('./logger')()
const User = require('../models/User')
const Sequence = require('../models/Sequence')
const Favourite = require('../models/Favourite')
const utils = require('../controllers/utils')
let old_updates = require('../data/updates')
let seq_list = require('../config/sequences')

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
 * @param {object} req - The request object sent by the client.
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
 * Handles any get requests to `/welcome`.  This program responds to the user
 * with a rendered Jade template of the welcome page, a static page that can
 * be heavily cached.
 *
 * @function welcome
 * @instance
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.welcome = function(req, res) {
  res.render('welcome', {
    title: 'Welcome :: OEIS Lookup',
    page: 'Welcome'
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
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.test = function(req, res) {
  const sequence = req.body.sequence
  const url = BASE_URL + 'search?fmt=json&q=' + encodeURIComponent(sequence)

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
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.id = function(req, res) {
  let sequence = req.params.sequence
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
          updateOne(parseInt(sequence), function() {
            exports.id(req, res)
          })
        }
        // return seqNotFound(res)
      } else {
        if (doc.program) {
          // logger.log("Parsing Program")
          doc.program = parseProgram(doc.program)
        }
        for (let i in doc) {
          // logger.log("Linking Names")
          doc[i] = linkName(doc[i])
          // logger.log("Finished Linking Names")
        }
        if (req.user) {
          logger.log("User Found")
          Favourite.find({ email: req.user.email, seq: sequence }, function(err, docs) {
            let isFavourite = false
            if (docs.length > 0) {
              logger.log(docs)
              isFavourite = true
              logger.log("Favourite: " + isFavourite + ", Rendering.")
            }
            finalRender(sequence, isFavourite, doc, res)
          })
        } else {
          logger.log("No User Found, Rendering")
          finalRender(sequence, false, doc, res)
        }
      }
    })
  }
}

/**
 * Handles the actaul rendering of the `id` page, including passing the required
 * data to the Jade rendered and sending the response to the client specified.
 * It organises the data properly, given a Mongoose document (or any similarly
 * structured object).
 *
 * @function finalRender
 * @instance
 * @param {int} sequence - A 1-6 digit number containing the rendered sequence number.
 * @param {boolean} isFavourite - Whether the user has favourited this sequence or not.
 * @param {object} doc - Mongoose-like object containing information on the sequence.
 * @param {object} res - The response object to reply to the client.
 */
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
  for (let i = 0; i < headers.length; i++) {
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
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.search = function(req, res) {
  const sequence = decodeURIComponent(req.query.q)
  const page = (typeof req.query.page === 'undefined') ? 0 : parseInt(req.query.page) - 1
  const url = BASE_URL + 'search?fmt=json&q=' + sequence + '&start=' + (page * 10)

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
        title: (req.query.q ? 'Too Many Results ' : 'No Results') + ':: OEIS Lookup',
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
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.favourites = function(req, res) {
  Favourite.find({ email: req.user.email }, 'seq -_id', function(err, docs) {
    let seq_info = []

    async.forEachOf(docs, function (doc, key, callback) {
      getFavInfo(doc.seq, function(err, data) {
        seq_info.push(data)
        callback()
      })
    }, function (err) {
      seq_info.sort(function(a, b){
        if(a.number < b.number) return -1;
        if(b.number > a.number) return 1;
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

/**
 * Gathers a very small portion of the sequence data in order to display
 * on the favourites page.  Returns the `number`, `time`, `keyword`,
 * `name` and `data` fields in the callback, as an object.
 * 
 * @function getFavInfo
 * @instance
 * @param {object} seq - The numerical value of the sequence to grab.
 * @param {function} callback - A function called when the DB call has succeeded.
 */
function getFavInfo(seq, callback) {
  Sequence.findOne({ number: parseInt(seq) }).lean().exec(function(err, doc){
    if (err) callback(err, null)
    else {
      callback(null, {
        number: doc.number,
        time: doc.time,
        keyword: doc.keyword,
        name: doc.name,
        data: doc.data
      })
    }
  })
}

/**
 * Returns a rendered Jade template to any request that matches
 * `/A:sequence/edit`.  In order to do this it checks the sequence
 * exists before organising it and then parsing it into markdown.
 *
 * @function editSequence
 * @instance
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.editSequence = function(req, res) {
  const sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) {
      sequence = '0' + sequence
    }
    res.redirect('/A' + sequence + '/edit')
    return null
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

/**
 * Parses a Mongoose-like object (which may either be straight from
 * the database or generated manually), converting any strings to markdown
 * and returning an array of both the new document (again in Mongoose-like
 * form) and a list of items that weren't filled in at the time.
 *
 * @function editSequence
 * @instance
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
function toMarkdownData(doc) {
  let unused = []
  if (1) { logger.log = function() { /* Do Nothing */ } }
  for (let i in doc) {
    if (doc[i] == "<no data>") {
      unused.push(i)
    } else {
      logger.log("== Sorting out doc[" + i + "] ==")
      if (doc[i].constructor === Array) {
        logger.log("It's an array")
        for (let j = 0; j < doc[i].length; j++) {
          if (typeof doc[i][j] === "string") {
            logger.log("It's a string array")
            doc[i][j] = toMarkdown(doc[i][j])
            logger.log("Parsing complete")
          } else {
            logger.log("It's not a string, it's a: " + typeof doc[i][j])
          }
        }
      } else {
        if (typeof doc[i] === "string") {
          logger.log("It's a string")
          doc[i] = toMarkdown(doc[i])
          logger.log("Parsing Complete")
        } else {
          logger.log("It's not a string, it's a: " + typeof doc[i])
        }
      }
    }
  }
  logger.log("Returned")
  return [doc, unused]
}

/**
 * Handles any post requests to `/A:seq/edit`.  This function cannot do
 * any `logger.log()` or `console.log()` functions for an unknown reason,
 * but does function well otherwise.
 *
 * @function postEditSequence 
 * @instance
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.postEditSequence = function(req, res) {
  handleNewEditSequence(req, res)
}

/**
 * An interesting fix to a problem causing errors when displaying text.  This
 * function is identical to the functionality proposed in `postEditSequence()`.
 *
 * @function handleNewEditSequence 
 * @instance
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
function handleNewEditSequence(req, res) {
  Sequence.findOne({ number: req.body.number }, function(err, doc) {
    if (!doc) {
      res.json({ "success": false, "err": "Sequence Number Not Found..."})
    } else {
      let changes = {}

      res.json(JSON.stringify(findRecursiveChanges(req.body, doc)))
    }
  })
}

/**
 * This function returns the deep differences between an array and a
 * Mongoose document.
 *
 * @function handleNewEditSequence 
 * @instance
 * @param {object} item1 - The given array.
 * @param {object} item2 - The given Mongoose document.
 */
function findRecursiveChanges(item1, item2) {
  // This function can deal with objects, arrays and strings.
  // Arr1 should be the given array, Arr2 should be the Mongoose doc
  
  let changes = {}

  if (item1 !== null && typeof item1 === 'object') {
    for (let item in item1) {
      changes[item] = findRecursiveChanges(item1[item], item2[item])
      logger.log(JSON.stringify(changes[item]))
    }
    return changes
  } else if (typeof item1 === 'array') {
    changes = []
    for (var i = 0; i < item1.length; i++) {
      if (!item1[i].replace(/\s/g, '').length) {
        logger.log("Removed empty: " + JSON.stringify(item1[i]))
        item1 = item1.splice(i, 1)
      }
    }
    for (var i = 0; i < item1.length; i++) {
      changes[i] = findRecursiveChanges(item1[i], item2[i])
      logger.log(JSON.stringify(changes[i]))
    }
    return changes
  } else if (typeof item1 === 'string') {
    logger.log(JSON.stringify(item1), JSON.stringify(item2))
    if (item1 === item2) {
      return "unchanged"
    } else {
      if (!item1) {
        return "created"
      } else if (!item2) {
        return "removed"
      } else {
        return "changed"
      }
    }
  } else {
    logger.log(item1)
    throw "Error!  Type not recognised."
  }
}

function handleEditSequence(req, res) {
  Sequence.findOne({ number: req.body.number }, function(err, doc) {
    if (!doc) {
      res.json({ "success": false, "err": "Sequence Number Not Found..."})
    } else {
      let changes = {}
      for (let item in req.body) {
        if (req.body[item].indexOf('\n') != -1) {
          req.body[item] = req.body[item].split(/\r?\n/)
        }
        if (item == "data") {
          if (req.body[item].constructor === Array) {
            req.body[item] = req.body[item][0].split(", ").join(",")
          } else {
            req.body[item] = req.body[item].split(", ").join(",")
          }
        }
        if (req.body[item].constructor === Array) {
          for (let i = 0; i < req.body[item].length; i++) {
            req.body[item][i] = req.body[item][i].replace(/\\./g, '.')
            if (req.body[item].constructor === String && !req.body[item].replace(/\s/g, '').length) {
              req.body[item] = req.body[item].splice(i, 1)
            }
          }
          changes[item] = "Unchanged"
          let check = arrayCheck(doc[item], req.body[item])
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
          if (req.body[item].constructor === String) {
            req.body[item] = req.body[item].replace(/\\./g, '.')            
          }
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

/**
 * Takes two one-dimensional arrays and checks whether the contents
 * are identical.
 *
 * @function arrayCheck
 * @instance
 * @param {array} arr1 - First array to check equivalence of.
 * @param {array} arr2 - Second array to check equivalence of.
 */
function arrayCheck(arr1, arr2) {
  if(arr1.length !== arr2.length)
    logger.log(arr1, arr2)
    return [false, ["length", arr1.length, arr2.length]]
  for(let i = arr1.length; i--;) {
    if(arr1[i] !== arr2[i])
      return [false, [arr1[i], arr2[i]]]
  }
  return [true, "true"];
}

exports.favourite = function(req, res) {
  const sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) {
      sequence = '0' + sequence
    }
    res.redirect('/A' + sequence + '/favourite')
    return null
  }
  logger.log(sequence)
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
  const sequence = req.params.sequence
  if (sequence.length < 6 && !isNaN(sequence)) {
    while (sequence.length < 6) {
      sequence = '0' + sequence
    }
    res.redirect('/A' + sequence + '/unfavourite')
    return null
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
  query = query.split(" ")
  let numbers = []
  let sequences = []
  for (let i = 0; i < query.length; i++) {
    if (!isNaN(query[i])) {
      numbers.push(query[i])
    } else {
      // We need to work out if it's a sequence of numbers.
      let seq = true
      const seq_query = query[i].split(",")
      for (let j = 0; j < seq_query.length; j++) {
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
  for (let i = 0; i < data.results.length; i++) {
    let list_values = data.results[i].data.split(",")
      // logger.log(data.results[i].data)
      // We start by highlighting the sequences:
    for (let j = 0; j < sequences.length; j++) {
      const inner = utils.findSubstring(list_values, sequences[j], 0)
      if (inner != -1) {
        list_values[inner] = "<b>" + list_values[inner]
        list_values[inner + sequences[j].length - 1] = list_values[inner + sequences[j].length - 1] + "</b>"
      }
    }
    for (let j = 0; j < list_values.length; j++) {
      for (let k = 0; k < numbers.length; k++) {
        if (numbers[k] == list_values[j]) {
          list_values[j] = "<b>" + list_values[j] + "</b>"
        }
      }
    }
    data.results[i].data = list_values.join(",")
  }
  return data
}

/**
 * Given some string of programming languages and their respective
 * programs, tries to identify them.  Returns an array of these
 * identified languages.
 *
 * Also converts syntaxes from unknown languages to ones with a similar
 * syntax.
 *
 * @param {object} data - The data returned from the OEIS API.
 * @param {string} query - The query requested by the user.
 */
function parseProgram(program) {
  const transform = {
    'PARI': 'apache',
    'S/R': 'css'
  }
  const programNameRe = /^\(([a-zA-Z0-9\/\-. ])+\)/
  const matchAnythingRe = /^([.]+)/
  let languages = []
  let currentCounter = -1
  for (let i = 0; i < program.length; i++) {
    let trimmed = false
    if (programNameRe.test(program[i])) {
      let group = programNameRe.exec(program[i])[0].slice(1, -1)
      // logger.log("Found Language: " + group)
      currentCounter++
      program[i] = program[i].replace(programNameRe, '').trim()
      languages[currentCounter] = [
        [group, transform[group]],
        []
      ]
      trimmed = true
    }
    const replacement = matchAnythingRe.exec(program[i])
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
  request(BASE_URL + 'recent.txt', function(err, resp, body) {
    if (body) {
      logger.success('Got /recent.txt successfully')
      const text = body.split('\n')
      let updates = []
      for (let i = 0; i < text.length; i++) {
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
    const indexToFind = utils.findSubstring(updates, old_updates.slice(0, 100), 0)
    if (indexToFind != 0) {
      for (let i = 0; i < indexToFind; i++) {
        logger.log('Updated Item: ' + updates[i])
          updateOne(parseInt(updates[i].substring(1)))
      }
    }
    old_updates = updates
    fs.writeFile('./data/updates.json', JSON.stringify(old_updates, null, 4), function(err) {
      if (err) {
        logegr.error(err)
      } else {
        logger.log("Updates Saved")
      }
    })
  })
}

function linkName(text, group) {
  if (text) {
    if (text.constructor === Array) {
      for (let j in text) {
        text[j] = linkName(text[j])
      }
      return text
    }
    if (text.constructor === String) {
      text = entities.encode(text)

      // logger.log("Finding Seqs")
      text = findSeqs(text)
      // logger.log("Finding Links")
      text = findLinks(text)
      // logger.log("Replacing Names")
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
  let match 
  const link = /&lt;a([^>]+)&gt;(.+?)&lt;\/a&gt;/gi

  do {
      match = link.exec(text)
      if (match) {
        text = text.replace(match[0], entities.decode(match[0]))
      }
  } while (match)

  return text
}

function replaceNames(text) {
  let regex
  let names = []
  const link = new XRegExp('_([\\p{L} .-]{1,80})_', 'g')

  do {
      regex = link.exec(text)
      if (regex && regex[1].indexOf(" ") != -1) {
          names.push(regex[1])
      }
  } while (regex)

  for (let i = 0; i < names.length; i++) {
    text = text.replace(new RegExp(("_"+names[i]+"_").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), 'g'),
      "<a class='name_link' href='" + BASE_URL + "wiki/User:" + names[i] + "'>" + names[i] + "</a>")
  }

  return text
}

function updateItem(id, number) {
  utils.superRequest(BASE_URL + 'search?q=id:A' + id + '&fmt=json', function(data) {
    // Fix for some weird closure issues.
    const y = data
    Sequence.findOne({
      number: number
    }, function(err, seq) {
      const data = y
      if (err) logger.error(err)
      else {
        if (seq === null) {
          logger.log('Sequence Not Found... Creating... ')
          let itemID = new Sequence(data.results[0])
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
          for (let i in data.results[0]) {
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

function updateOne(id, callback) {
  const text = ('000000' + String(id)).substring(String(id).length)
  // Some point might want to turn this to Request instead of SuperRequest
  // We don't really want caching on updating id's.
  utils.superRequest(BASE_URL + 'search?q=id:A' + text + '&fmt=json', function(newData) {
    const query = {
      number: id
    }
    if (newData && newData.results && newData.results[0]) {
      const update = newData.results[0]
      const options = {
        upsert: true,
        new: true
      }
      Sequence.findOneAndUpdate(query, update, options, function(err, result) {
        if (err) {
          logger.error(err)
          throw err
        }
        logger.success(text + ' was updated successfully!')
        if (callback) {
          callback()
        }
      })
    } else {
      logger.error('Request returned something wrong when trying to update one...')
    }
  })
}

function updateAll(max) {
  for (let i = 1; i <= max; i++) {
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
  for (let i = min; i <= max; i++) {
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
  logger.log("I got called with: " + min + " " + max)
  currentTimeout = 0
  for (let i = min; i <= max; i++) {
    logger.log("Tried Lookup For: " + i)
    Sequence.find({
      number: i
    }, function(err, docs) {
      if (err) {
        logger.log(err)
      }
      logger.log(docs)
      if (!docs || docs == []) {
        logger.log("Make New Registering Update For: " + i)
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
    let array = []
    docs.forEach(function(item) {
      array.push(item.number)
    })
    array = array.sort(function(a, b) {
      return a - b
    })
    let count = 1
    let arrayEntry = 0
    let missing = []
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
    if (err) logger.log(err)
    if (JSON.stringify(docs) == "[]") {
      logger.log("Grabbing sequence number " + value)
    } else {
      logger.log("Sequence number " + value + "exists and hasn't been grabbed")
    }
  })
}

function bootstrapFindMissing(value, multiplier) {
  if (!multiplier) multiplier = 1
  findMissing(value, function(missing) {
    currentTimeout = 0
    for (let i = 0; i < missing.length; i++) {
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