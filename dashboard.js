if (process.platform === 'win32') {
  process.env.TERM = 'windows-ansi'
}

const blessed = require('blessed')
const contrib = require('blessed-contrib')
const pusage = require('pidusage')
const _ = require('lodash')
const ps = require('current-processes')
const WebSocketServer = require('ws');

// web Socket Initiation
var wss = new WebSocketServer.Server({ port: 8080 });

const screen = blessed.screen()

//create layout and widgets

var grid = new contrib.grid({rows: 12, cols: 12, screen: screen})

/**
 * Donut Options
  self.options.radius = options.radius || 14; // how wide is it? over 5 is best
  self.options.arcWidth = options.arcWidth || 4; //width of the donut
  self.options.yPadding = options.yPadding || 2; //padding from the top
 */
var donut = grid.set(8, 9.95, 4, 2, contrib.donut, 
  {
  label: 'CPU Usage',
  radius: 16,
  arcWidth: 4,
  yPadding: 2,
  data: [{label: 'CPU Usage', percent: 0}]
})

// var latencyLine = grid.set(8, 8, 4, 2, contrib.line, 
//   { style: 
//     { line: "yellow"
//     , text: "green"
//     , baseline: "black"}
//   , xLabelPadding: 3
//   , xPadding: 5
//   , label: 'Network Latency (sec)'})

var gauge_two = grid.set(2, 9, 2, 3, contrib.gauge, {label: 'Deployment Progress', percent: 80})

/*
var sparkline = grid.set(10, 10, 2, 2, contrib.sparkline, 
  { label: 'Throughput (bits/sec)'
  , tags: true
  , style: { fg: 'blue', titleFg: 'white' }})
*/

var bar = grid.set(4, 6, 4, 3, contrib.bar, 
  { label: 'Server Utilization (%)'
  , barWidth: 4
  , barSpacing: 6
  , xOffset: 2
  , maxHeight: 9})

var table =  grid.set(4, 9, 4, 3, contrib.table, 
  { keys: true
  , fg: 'green'
  , label: 'Active Processes'
  , columnSpacing: 1
  , columnWidth: [24, 10, 10]})

/*
 *
 * LCD Options
//these options need to be modified epending on the resulting positioning/size
  options.segmentWidth = options.segmentWidth || 0.06; // how wide are the segments in % so 50% = 0.5
  options.segmentInterval = options.segmentInterval || 0.11; // spacing between the segments in % so 50% = 0.5
  options.strokeWidth = options.strokeWidth || 0.11; // spacing between the segments in % so 50% = 0.5
//default display settings
  options.elements = options.elements || 3; // how many elements in the display. or how many characters can be displayed.
  options.display = options.display || 321; // what should be displayed before anything is set
  options.elementSpacing = options.spacing || 4; // spacing between each element
  options.elementPadding = options.padding || 2; // how far away from the edges to put the elements
//coloring
  options.color = options.color || "white";
*/
var lcdLineOne = grid.set(0,9,2,3, contrib.lcd,
  {
    label: "LCD Test",
    segmentWidth: 0.06,
    segmentInterval: 0.11,
    strokeWidth: 0.1,
    elements: 5,
    display: 3210,
    elementSpacing: 4,
    elementPadding: 2
  }
);

var memoryLine = grid.set(0, 6, 4, 3, contrib.line, 
  { style: 
    { line: "green"
    , text: "white"
    , baseline: "black"}
  , label: 'Errors Rate'
  , maxY: 8
  , showLegend: true })

var transactionsLine = grid.set(0, 0, 6, 6, contrib.line, 
          { showNthLabel: 5
          , maxY: 100
          , label: 'Total Transactions'
          , showLegend: true
          , legend: {width: 10}})

var map = grid.set(6, 0, 6, 6, contrib.map, {label: 'Servers Location'})

var log = grid.set(8, 6, 4, 3.95, contrib.log, 
  { fg: "green"
  , selectedFg: "green"
  , label: 'Server Log'})


//dummy data
var servers = ['US1', 'US2', 'EU1', 'AU1', 'AS1', 'JP1']
var commands = ['grep', 'node', 'java', 'timer', '~/ls -l', 'netns', 'watchdog', 'gulp', 'tar -xvf', 'awk', 'npm install']


var gauge_percent_two = 0
setInterval(function() {
  gauge_two.setData(gauge_percent_two);
  gauge_percent_two++;
  if (gauge_percent_two>=100) gauge_percent_two = 0  
}, 200);


//set dummy data on bar chart
function fillBar() {
  var arr = []
  for (var i=0; i<servers.length; i++) {
    arr.push(Math.round(Math.random()*10))
  }
  bar.setData({titles: servers, data: arr})
}
fillBar()
setInterval(fillBar, 2000)


function generateTable() {
  var data = []
  ps.get(function(err, processes) {
    const sorted = _.sortBy(processes, 'cpu').reverse().splice(0, 30)
    for (var i = 0; i < sorted.length; i++) {
      var row = []
      row.push(sorted[i].name)
      row.push(sorted[i].cpu)
      row.push(parseFloat(sorted[i].mem.usage).toFixed(2))
      data.push(row)
    }
    table.setData({headers: ['Process', 'CPU (%)', 'Memory (%)'], data: data})
  })
}

generateTable()
table.focus()
setInterval(generateTable, 5000)


wss.on('connection', function connection(ws) {
  var location = ws.upgradeReq.headers['x-forwarded-for'] || ws.upgradeReq.connection.remoteAddress
  log.log("Connection from " + location)
  ws.on('message', function incoming(message) {
    msg = JSON.parse(message)
    if (msg[0] == "msg") {
      log.log(msg[1])
    }
    if (msg[0] == "loc") {
      console.log(msg[1])
    }
  })
})

//set map dummy markers
var marker = true
setInterval(function() {
   if (marker) {
    map.addMarker({"lon" : "-79.0000", "lat" : "37.5000", color: 'yellow', char: 'X' })
    map.addMarker({"lon" : "-122.6819", "lat" : "45.5200" })
    map.addMarker({"lon" : "-6.2597", "lat" : "53.3478" })
    map.addMarker({"lon" : "103.8000", "lat" : "1.3000" })
   }
   else {
    map.clearMarkers()
   }
   marker =! marker
   screen.render()
}, 1000)

//set line charts dummy data

var transactionsData = {
   title: 'USA',
   style: {line: 'red'},
   x: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:30', '00:40', '00:50', '01:00', '01:10', '01:20', '01:30', '01:40', '01:50', '02:00', '02:10', '02:20', '02:30', '02:40', '02:50', '03:00', '03:10', '03:20', '03:30', '03:40', '03:50', '04:00', '04:10', '04:20', '04:30'],
   y: [0, 20, 40, 45, 45, 50, 55, 70, 65, 58, 50, 55, 60, 65, 70, 80, 70, 50, 40, 50, 60, 70, 82, 88, 89, 89, 89, 80, 72, 70]
}

var transactionsData1 = {
   title: 'Europe',
   style: {line: 'yellow'},
   x: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:30', '00:40', '00:50', '01:00', '01:10', '01:20', '01:30', '01:40', '01:50', '02:00', '02:10', '02:20', '02:30', '02:40', '02:50', '03:00', '03:10', '03:20', '03:30', '03:40', '03:50', '04:00', '04:10', '04:20', '04:30'],
   y: [0, 5, 5, 10, 10, 15, 20, 30, 25, 30, 30, 20, 20, 30, 30, 20, 15, 15, 19, 25, 30, 25, 25, 20, 25, 30, 35, 35, 30, 30]
}

var errorsData = {
   title: 'server 1',
   x: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:25'],
   y: [30, 50, 70, 40, 50, 20]
}

var latencyData = {
   x: ['t1', 't2', 't3', 't4'],
   y: [5, 1, 7, 5]
}

setLineData([transactionsData, transactionsData1], transactionsLine)
setLineData([errorsData], memoryLine)
// setLineData([latencyData], latencyLine)

setInterval(function() {
   setLineData([transactionsData, transactionsData1], transactionsLine)
   screen.render()
}, 500)

setInterval(function() {   
    setLineData([errorsData], memoryLine)
}, 5000)

setInterval(function(){
  var colors = ['green','magenta','cyan','red','blue'];
  var text = ['A','B','C','D','E','F','G','H','I','J','K','L'];

  var value = Math.round(Math.random() * 100);
  lcdLineOne.setDisplay(value + text[value%12]);
  lcdLineOne.setOptions({
    color: colors[value%5],
    elementPadding: 4
  });
  screen.render()
}, 1500);

setInterval(function() {pusage.stat(process.pid, function(err, stat) {
  if (stat.cpu > 100) stat.cpu = 0
  let color = "green"
  if (stat.cpu >= 25) color = "cyan"
  if (stat.cpu >= 50) color = "yellow"
  if (stat.cpu >= 75) color = "red"
  donut.setData([{
    percent: parseFloat(stat.cpu/100).toFixed(2),
    label: 'CPU Usage',
    color: color
  }])
  screen.render()
  // console.log('Mem: %s', stat.memory) //those are bytes
})}, 1000)

function setLineData(mockData, line) {
  for (var i=0; i<mockData.length; i++) {
    var last = mockData[i].y[mockData[i].y.length-1]
    mockData[i].y.shift()
    var num = Math.max(last + Math.round(Math.random()*10) - 5, 10)    
    mockData[i].y.push(num)  
  }
  
  line.setData(mockData)
}


screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render()