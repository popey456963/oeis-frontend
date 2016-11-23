$(function() {
  if (hljs) {
    hljs.initHighlightingOnLoad()    
  }
  if ($('.floating-button').length) {
    $('.floating-button').on('click', function(event) {
      event.preventDefault()
      randomSequence()
    });
    if (getParameterByName('random', location.href) == "1") {
      $('.floating-button').css('display', '')
    }
  }
})

Number.prototype.pad = function(n) {
    return new Array(n).join('0').slice((n || 2) * -1) + this;
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

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
  document.getElementById('sequence-loading').style.display = '';
  document.getElementById('loading-space').style.display = 'inline-block';
  document.getElementById('lookup-sequence').innerHTML = 'Looking Up...';

  document.getElementById('error').className = 'hidden alert alert-danger'
  var error = ''
  var sequence = document.getElementById('sequence').value

  if (sequence == '') {
    sequence = document.getElementById('sequence').getAttribute('placeholder');
    document.getElementById('sequence').value = sequence
  }

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
      document.getElementById('sequence-loading').style.display = 'none';
      document.getElementById('loading-space').style.display = 'none';
      document.getElementById('lookup-sequence').innerHTML = 'Lookup Sequence';
    }
    console.log(data)
  })
}

function randomSequence() {
  var number = String(Math.floor((Math.random() * 276037) + 1))
  while (number.length < 6) {
    number = "0" + number
  }
  console.log("Heading too A" + number)
  window.location.href = "/A" + number + "?random=1"
}