var request = require('request')
var cachedRequest = require('cached-request')(request)

/**
 * GET /
 */
exports.index = function(req, res) {
  res.render('search', {
    title: 'Search :: OEIS Lookup'
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
          data.results[0].program = parseProgram(data.results[0].program)
          res.render('id', {
            title: 'A' + sequence + ' :: OEIS Lookup',
            data: data.results[0],
            toTitleCase: function(str){return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});},
            sequenceName: 'A' + sequence
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
      title: "Search Results",
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

function parseProgram(program) {
  var languages = []
  var currentCounter = -1
  var re = /^\([a-zA-Z0-9]+\)/
  var re2 = /^\(([a-zA-Z0-9]+)\)/
  var re3 = /^([.]+)/
  for (var i = 0; i < program.length; i++) {
    if (re.test(program[i])) {
      var group = re2.exec(program[i])[1]
      currentCounter++
      // console.log(group + ": " + program[i].replace(re, '').trim())
      program[i] = program[i].replace(re, '').trim()
      languages[currentCounter] = [group, []]
    }
    var replacement = re3.exec(program[i])
    if (replacement && replacement.length > 0) {
      program[i] = program[i].replace(replacement[1], new Array(replacement[1].length + 1).join(" "))
    }
    if (currentCounter != -1) {
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
      console.log(e)
      if (ttl == 0) {
        request(url, function(err, resp, body) {
          try {
            callback(JSON.parse(body))
          } catch(e) {
            callback(false)
          }
        })
      } else {
        superRequest(url, callback, 0)
      }
    }
  })
}

function getRecentlyChanged() {
  request('https://oeis.org/recent.txt', function(err, resp, body) {
    console.log("Got /recent.txt successfully")
    var text = body.split("\n")
    var updates = []
    for (var i = 0; i < text.length; i++) {
      if (text[i].substring(0, 2) == '%I') {
        updates.push(text[i].split(" ")[1])
      }
    }
    console.log(JSON.stringify(updates))
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