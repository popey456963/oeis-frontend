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
  req.assert('sequence', 'Sequence must not be blank.').notEmpty()
  var errors = req.validationErrors()

  if (errors) {
    res.send(errors[0].msg)
  } else {
    attemptRequest(sequence, 1000 * 60 * 60 * 24, "", "&start=" + ((parseInt(req.query.page)-1)*10), function(json) {
      if (json != false) {
        parseJSON(res, json, sequence)
      } else {
        console.log("Initial cached response did not work.")
        attemptRequest(sequence, 0, "", "&start=" + ((parseInt(req.query.page)-1)*10), function(json) {
          if (json != false) {
            parseJSON(res, json, sequence)
          } else {
            console.log("Uncached response did not appear to work either.")
            attemptNormalRequest(sequence, "", "&start=" + ((parseInt(req.query.page)-1)*10), function(json) {
              if (json != false) {
                parseJSON(res, json, sequence)
              } else {
                console.log("Oh dear, even our normal request doesn't appear to be working.")
                res.send("OEIS didn't provide a good response, despite multiple attempts.  Please check their website, if it appears up, please contact us.")
              }
            })
          }
        })
      }
    })
  }
}

exports.id = function(req, res) {
  var sequence = req.params.id
  if (sequence.length != 6 || isNaN(sequence) || sequence.indexOf('e') > -1) {
    res.render('not_found', {
      title: 'ID Not Found :: OEIS Lookup'
    })
  } else {
    attemptRequest(sequence, 1000 * 60 * 60 * 24, "id:A", "", function(json) {
      if (json != false) {
        parseResponse(res, json, sequence)
      } else {
        console.log("Initial cached response did not work.")
        attemptRequest(sequence, 0, "id:A", "", function(json) {
          if (json != false) {
            parseResponse(res, json, sequence)
          } else {
            console.log("Uncached response did not appear to work either.")
            attemptNormalRequest(sequence, "id:A", "", function(json) {
              if (json != false) {
                parseResponse(res, json, sequence)
              } else {
                console.log("Oh dear, even our normal request doesn't appear to be working.")
                res.send("OEIS didn't provide a good response, despite multiple attempts.  Please check their website, if it appears up, please contact us.")
              }
            })
          }
        })
      }
    })
  }
}

exports.search = function(req, res) {
  var sequence = decodeURIComponent(req.query.q);
  attemptRequest(sequence, 1000 * 60 * 60 * 24, "", "&start=" + ((parseInt(req.query.page)-1)*10), function(json) {
    if (json != false) {
      parseSearch(req, res, json)
    } else {
      console.log("Initial cached response did not work.")
      attemptRequest(sequence, 0, "", "&start=" + ((parseInt(req.query.page)-1)*10), function(json) {
        if (json != false) {
          parseSearch(req, res, json)
        } else {
          console.log("Uncached response did not appear to work either.")
          attemptNormalRequest(sequence, "", "&start=" + ((parseInt(req.query.page)-1)*10), function(json) {
            if (json != false) {
              parseSearch(req, res, json)
            } else {
              console.log("Oh dear, even our normal request doesn't appear to be working.")
              res.send("OEIS didn't provide a good response, despite multiple attempts.  Please check their website, if it appears up, please contact us.")
            }
          })
        }
      })
    }
  })
}

function parseSearch(req, res, json) {
  res.render('./search_results/search_results', {
    title: "Search Results",
    query: req.query.q,
    data: json.results,
    sequenceGen: function padLeft(nr, n, str){
      return Array(n-String(nr).length+1).join(str||'0')+nr;
    },
    numResults: json.count,
    currentPage: json.start / 10,
    maxPage: Math.ceil(json.count / 10)
  })
}

function parseJSON(res, json) {
  if (json.count != 0 && json.results == null) {
    res.send("Too many results.")
  } else if (json.results == null) {
    res.send("No results.")
  } else if (json.count == 1) {
    res.send("1 " + json.results[0].number)
  } else {
    res.send("")
  }
}

function attemptRequest(sequence, ttl, id, extra, callback) {
  var options = {
    url: 'https://oeis.org/search?fmt=json&q=' + id + sequence + extra,
    ttl: ttl
  }
  var json;
  cachedRequest(options, function(err, resp, body) {
    try {
      var json = JSON.parse(body)
      callback(json)
    } catch(e) {
      callback(false)
    }
  })
}

function attemptNormalRequest(sequence, id, extra, callback) {
  request('https://oeis.org/search?fmt=json&q=' + id + sequence + extra, function(err, resp, body) {
    try {
      var json = JSON.parse(body)
      callback(json)
    } catch(e) {
      callback(false)
    }
  })
}

function parseResponse(res, json, sequence) {
  if (json.count == 0 || json.results == null) {
    res.render('not_found', {
      title: 'ID Not Found :: OEIS Lookup'
    })
  } else {
    res.render('id', {
      title: 'A' + sequence + ' :: OEIS Lookup',
      data: json.results[0],
      sequenceName: 'A' + sequence
    })
  }
}