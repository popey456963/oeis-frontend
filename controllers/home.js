var request = require('request')
var cachedRequest = require('cached-request')(request)
var User = require('../models/User.js')
var Sequence = require('../models/Sequence.js')
var moment = require('moment')
var old_updates = require('../updates.json')
var seq_list = require('../sequences.json')

/**
 * GET /
 */
exports.index = function(req, res) {
  res.render('search', {
    page: "Search",
    title: 'Search :: OEIS Lookup',
    sequence: seq_list[Math.floor(Math.random() * seq_list.length)]
  })
}

/**
 * GET /welcome
 */
exports.welcome = function(req, res) {
  res.render('welcome', {
    title: 'Welcome :: OEIS Lookup'
  })
}

/**
 * POST /test
 */
exports.test = function(req, res) {
  var sequence = req.body.sequence  
  var url = "https://oeis.org/search?fmt=json&q=" + encodeURIComponent(sequence)

  if (sequence == "") {
    res.send('Sequence must not be blank')
  } else {
    superRequest(url, function(data) {
      if (data) {
        if (data.count != 0 && data.results == null) {
          res.send("Too many results.")
        } else if (data.results == null) {
          res.send("No results.")
        } else if (data.count == 1) {
          res.send("1 " + data.results[0].number)
        } else {
          res.send("")
        }
      } else {
        res.send("OEIS didn't provide a good response, despite multiple attempts.  Check their website, or contact us.")
      }
    })
  }
}

/*
 * GET /A******
 */
exports.id = function(req, res) {
  console.log("Hi, I'm here.")
  var sequence = req.params.sequence
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
            page: "A-Page",
            title: 'A' + sequence + ' :: OEIS Lookup',
            data: data.results[0],
            toTitleCase: function(str){return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});},
            sequenceName: 'A' + sequence,
            id_page: true
          })
        }
      } else {
        res.send("OEIS didn't provide a good response, despite multiple attempts.  Check their website, or contact us.")
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
      title: "Search Results :: OEIS Lookup",
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
    page: "Test-Lang",
    title: "Lang Test :: OEIS Lookup"
  })
}

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
      page: "User-List",
      title: "User List :: OEIS Lookup",
      users: listOfUsers,
      adminNumToWord: adminNumToWord
    })
  })
}

function adminNumToWord(number) {
  perms = String("000" + (number >>> 0).toString(2)).slice(-3)
  roles = []
  if (perms.charAt(0) == "1") roles.push("Perm A")
  if (perms.charAt(1) == "1") roles.push("Perm B")
  if (perms.charAt(2) == "1") roles.push("Perm C")
  return roles.join(",")
}

function parseProgram(program) {
  var transform = {
    "PARI": "apache",
    "S/R": "css"
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
      // console.log(group + ": " + program[i].replace(re, '').trim())
      program[i] = program[i].replace(re, '').trim()
      languages[currentCounter] = [[group, transform[group]], []]
      console.log("Found Group: " + group)
      trimmed = true
    }
    var replacement = re3.exec(program[i])
    if (replacement && replacement.length > 0) {
      program[i] = program[i].replace(replacement[1], new Array(replacement[1].length + 1).join(" "))
    }
    if (currentCounter != -1 && !(trimmed && program[i].length == 0)) {
      languages[currentCounter][1].push(program[i])
    }
  }
  // console.log(languages)
  return languages
}

function superRequest(url, callback, ttl) {
  ttl = (typeof ttl === 'undefined') ? 1000 * 60 * 60 * 24 : ttl
  var options = { url: url, ttl: ttl }
  console.log(options)
  cachedRequest(options, function(err, resp, body) {
    try {
      callback(JSON.parse(body))
    } catch(e) {
      // console.log(e)
      if (ttl == 0) {
        request(url, function(err, resp, body) {
          try {
            callback(JSON.parse(body))
          } catch(e) {
            // console.log(e)
            callback(false)
          }
        })
      } else {
        superRequest(url, callback, 0)
      }
    }
  })
}

function getRecentlyChanged(callback) {
  request('https://oeis.org/recent.txt', function(err, resp, body) {
    console.log("Got /recent.txt successfully")
    var text = body.split("\n")
    var updates = []
    for (var i = 0; i < text.length; i++) {
      if (text[i].substring(0, 2) == '%I') {
        updates.push(text[i].split(" ")[1])
      }
    }
    callback(updates)
  })
}

function find_csa(arr, subarr, from_index) {
    var i = from_index >>> 0,
        sl = subarr.length,
        l = arr.length + 1 - sl;

    loop: for (; i<l; i++) {
        for (var j=0; j<sl; j++)
            if (arr[i+j] !== subarr[j])
                continue loop;
        return i;
    }
    return -1;
}

function makeAdmin(email) {
  User.findOne({ email: email }, function(err, user) {
    if (err) console.log(err)
    if (user && !err) {
      user.admin = 7
      user.save(function(err, updatedUser) {
        if (err) console.log(err)
        console.log(updatedUser)
      })
    } else {
      console.log("No User Found (Or Error Found)")
    }
  })
}

makeAdmin('popey@debenclipper.com')

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
    var indexToFind = find_csa(updates, old_updates.slice(0, 100), 0)
    if (indexToFind != 0) {
      for (var i = 0; i < indexToFind; i++) {
        console.log("Updated Item: " + updates[i])
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
      console.log(text)
      console.log(text.constructor)
      var html = text.replace(link, '<a href="http://oeis.org/wiki/User:$1">$1</a>');
      return html
    } else {
      console.log(text)
      return text
    }
  } else {
    return text
  }
}

function updateItem(id) {
  superRequest('https://oeis.org/search?q=id:A' + id + '&fmt=json', function(data) {
    // Fix for some weird closure issues.
    var y = data
    Sequence.findOne({number: id}, function(err, seq) {
      var data = y
      if (err) console.log(err)
      else {
        // console.log(seq)
        if (seq === null) {
          console.log("Sequence Not Found... Creating... ")
          var itemID = new Sequence(data.results[0])
          itemID.data = itemID.data.split(",")
          itemID.save(function(err) {
            if (err) {
              console.log(err)
              console.log(itemID)
            }
            else {
              console.log("Created New Item: " + id)
            }
          })
        } else {
          console.log("Sequence Found... Updating... ")
          for (var i in data.results[0]) {
            seq[i] = data.results[0][i]
          }
          seq.save(function(err) {
            if (err) console.log(err)
            else {
              console.log("Item Found... Updated!")
            }
          })
        }
      }
    })
  })
}

function listItems() {
  Sequence.find({}, function(err, docs) {
    console.log(err)
    console.log(docs)
  })
}

// Sequence.remove({}, function(err) { if (!err) console.log("Collection Removed.") })

function updateAll(max) {
  for (var i = 1; i <= max; i++) {
    updateItem(('000000' + String(i)).substring(String(i).length))
  }
}

// updateItem("000011")

// updateAll(100)