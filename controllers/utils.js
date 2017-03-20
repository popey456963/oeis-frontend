var request = require('request')
var cachedRequest = require('cached-request')(request)
var logger = require('./logger')()

cachedRequest.setCacheDirectory('./tmp/cache')

exports.superRequest = function(url, callback, ttl) {
  ttl = (typeof ttl === 'undefined') ? 1000 * 60 * 60 * 24 : ttl
  var options = {
      url: url,
      ttl: ttl
    }
    // logger.log('Super Request Options: ' + options)
  try {
    cachedRequest(options, function(err, resp, body) {
      try {
        callback(JSON.parse(body))
      } catch (e) {
        logger.error(e)
        if (ttl == 0) {
          request(url, function(err, resp, body) {
            try {
              callback(JSON.parse(body))
            } catch (e) {
              logger.error(e)
              logger.warning("We were forced to return false...")
              callback(false)
            }
          })
        } else {
          exports.superRequest(url, callback, 0)
        }
      }
    })
  } catch (e) {
    logger.error("Cached Request had a fatal error whilst handling: " + url)
    logger.error(e)
    request(url, function(err, resp, body) {
      try {
        callback(JSON.parse(body))
      } catch (e) {
        logger.error(e)
        callback(false)
      }
    })
  }
}

exports.findSubstring = function(arr, subarr, fromIndex) {
  var i = fromIndex >>> 0
  var sl = subarr.length
  var l = arr.length + 1 - sl

  loop: for (; i < l; i++) {
    for (var j = 0; j < sl; j++)
      if (arr[i + j] !== subarr[j])
        continue loop
    return i
  }
  return -1
}