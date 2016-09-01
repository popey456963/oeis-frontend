$(function() {
  hljs.initHighlightingOnLoad()
  $('.selectpicker').selectpicker()
})

function leftpad (str, len, ch) {
  str = String(str)
  var i = -1
  if (!ch && ch !== 0) ch = ' '
  len = len - str.length
  while (++i < len) {
    str = ch + str
  }
  return str
}

$('#sequence').keypress(function (e) {
  if (e.which == 13) {
    lookupSequence()
  }
});

function lookupSequence() {
  document.getElementById('error').className = 'hidden alert alert-danger'
  var error = ''
  var sequence = document.getElementById('sequence').value

  console.log('Testing Sequence: ' + sequence)

  $.post( './test', {'sequence': sequence}, function(data) {
    if (data == '') {
      window.location.href = window.location.origin + '/search?q=' + encodeURI(sequence)
    } else if (data.split(" ")[0] == '1') {
      var id = leftpad(data.split(" ")[1], 6, "0")
      window.location.href = window.location.origin + '/A' + id
    } else {
      document.getElementById('error').innerHTML = data
      document.getElementById('error').className = 'alert alert-danger'
    }
    console.log(data)
  })
}