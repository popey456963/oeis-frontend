const chalk = require('chalk')
const stacktrace = require('stack-trace')
const path = require('path')

let defaults = {
  'logLevel': 4,
  'status': true,
  'locLength': 12,
  'dateFormat': '[hh:mm:ss]',
  'client': typeof window !== 'undefined',
  'detectFunctions': true,
  'customName': false,
  'colour': {
    error:    chalk.red,    // (0)
    warning:  chalk.yellow, // (1)
    success:  chalk.green,  // (2)
    log:      chalk.gray,   // (3)
    info:     chalk.gray,   // (4)
    date:     chalk.cyan,
    file:     chalk.yellow,
    function: chalk.green
  }
}

function Logger(options) {
  options = options || {}

  for (let option in defaults) {
    this[option] = options[option] ||  defaults[option]
  }

  if (options.customName) this.customName = this.pad(options.customName)
}

Logger.prototype.pad = function(name) {
  while (name.length < this.locLength) name += ' '
  return name
}

Logger.prototype.date = function() {
  let date = new Date()
  let parts = {
    hh: String('00' + date.getHours()).slice(-2),
    mm: String('00' + date.getMinutes()).slice(-2),
    ss: String('00' + date.getSeconds()).slice(-2),
    dd: String('00' + date.getDate()).slice(-2),
    yyyy: String('0000' + date.getFullYear()).slice(-4),
    MM: String('00' + (date.getMonth() + 1)).slice(-2),
  }
  let keys = Object.keys(parts)
  let format = this.dateFormat

  for (let i = 0; i < keys.length; i++) {
    format = format.replace(keys[i], parts[keys[i]])
  }

  return format
}

Logger.prototype.capitalise = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

Logger.prototype.error   = function() { if (this.logLevel >= 0) this.print(arguments, 'error')   }
Logger.prototype.warning = function() { if (this.logLevel >= 1) this.print(arguments, 'warning') }
Logger.prototype.success = function() { if (this.logLevel >= 2) this.print(arguments, 'success') }
Logger.prototype.log     = function() { if (this.logLevel >= 3) this.print(arguments, 'log')     }
Logger.prototype.info    = function() { if (this.logLevel >= 4) this.print(arguments, 'info')    }

Logger.prototype.print = function(args, level) {
  let date = this.date()

  args = Object.values(args)
  let message = []

  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === 'string' || typeof args[i] === 'number') {
      message.push(args[i])
    } else {
      message.push('\n' + JSON.stringify(args[i], null, 4))
    }
  }

  message = message.join(' ')
  if (message.charAt(0) == '\n') message = message.slice(1)

  if (this.client) {
    console.log(`${date} ${message}`)
    return
  }

  let func, file

  if (this.customName) {
    let file = this.customName
  } else {
    let stack = stacktrace.get()[2]
    if (stack.getFunctionName()) {
      func = this.pad(stack.getFunctionName() + '()')
    } else {
      file = this.pad(path.basename(stack.getFileName()))
    }
  }

  let msg = `${this.colour.date(date)} [${func ? this.colour.function(func) : this.colour.file(file)}] ${this.colour[level](message)}`

  console.log(msg)

  if (!global.wserror) {
    try {
      global.ws.send(JSON.stringify(['msg', msg]))
    } catch(e) {
      global.wserror = true
      this.print({ 0: "A websocket error ocurred...", 1: e }, "error")
    }
  }
}

module.exports = function(options) { return new Logger(options) };