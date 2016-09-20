const chalk = require('chalk')
const stackTrace = require('stack-trace')
const path = require('path')

var logger = function(m, n){
  if (n === false) { this.useFunctionNameBool = false } 
  else { this.useFunctionNameBool = true }
  this.givenName = m
  m = m || module.parent.filename.replace(/^.*[\\\/]/, '')
  this.normalName = m
  this.moduleName = ' [' + m
  while (this.moduleName.length < 8) { this.moduleName += ' ' }
  this.moduleName += '] '

  this.l = {
    error:   chalk.red,    // (0)
    warning: chalk.yellow, // (1)
    success: chalk.green,  // (2)
    log:     chalk.gray,   // (3)
    info:    chalk.gray,   // (4)
    date:    chalk.cyan
  }

  this.logLevel = 4
  this.status = true
  this.dateFormat = "[hh:mm:ss]"
}

logger.prototype.changeLength = function(length) {
  this.moduleName = ' [' + this.normalName
  while (this.moduleName.length < length) { this.moduleName += ' ' }
  this.moduleName += '] '
}

logger.prototype.useFunctionName = function(useFunctionNameBool) {
  this.useFunctionNameBool = useFunctionNameBool
}

logger.prototype.date = function () {
  var date = new Date()
  var individual = {
    hh: String('00' + date.getHours()).slice(-2),
    mm: String('00' + date.getMinutes()).slice(-2),
    ss: String('00' + date.getSeconds()).slice(-2),
    dd: String('00' + date.getDate()).slice(-2),
    yyyy: String('0000' + date.getFullYear()).slice(-4),
    MM: String('00' + (date.getMonth() + 1)).slice(-2),
  }
  var keys = Object.keys(individual)
  var string = this.dateFormat
  for (i=0; i < keys.length; i++) {
    string = string.replace(keys[i], individual[keys[i]])
  }

  return this.l.date(string)
}

logger.prototype.capitalise = function(string) { return string.charAt(0).toUpperCase() + string.slice(1) }

logger.prototype.error   = function (/**/) { if (this.logLevel >= 0) this.print(arguments, "error")   }
logger.prototype.warning = function (/**/) { if (this.logLevel >= 1) this.print(arguments, "warning") }
logger.prototype.success = function (/**/) { if (this.logLevel >= 2) this.print(arguments, "success") }
logger.prototype.log     = function (/**/) { if (this.logLevel >= 3) this.print(arguments, "log")     }
logger.prototype.info    = function (/**/) { if (this.logLevel >= 4) this.print(arguments, "info")    }

logger.prototype.print   = function(msg, code) {
  var args = Array.prototype.slice.call(arguments);
  args.pop()
  args.pop()
  if (this.status) {
    fullMessage = []
    for (i = 0; i < msg.length; i++) {
      fullMessage.push(msg[i])
    }
    if (!this.useFunctionNameBool) {
      console.log(this.date() + this.moduleName + this.l[code](fullMessage.join(" ")))
    } else {
      var stack = stackTrace.get()[2]
      var fileName = path.basename(stack.getFileName())
      /*for (var i = 0; i < stackTrace.get().length; i++) {
        console.log(stackTrace.get()[i].getFunctionName())
      }*/
      if (stack.getFunctionName()) {
        var locName = this.capitalise(stack.getFunctionName()) + '()'
      } else {
        var locName = this.capitalise(fileName)
      }
      while (locName.length < 8) { locName += ' ' }
      console.log(this.date() + ' [' + locName + '] ' + this.l[code](fullMessage.join(" ")))      
    }
  }
}


module.exports = function(m, n){ return new logger(m, n) };