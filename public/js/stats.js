$(function() {
	$('#hourselect').on('click', function() {
		hideOthers('hour')
	})

	$('#dayselect').on('click', function() {
    hideOthers('day')
	})

	$('#weekselect').on('click', function() {
    hideOthers('week')
	})
})

function hideOthers(name) {
  var groups = ['hour', 'day', 'week']
  for (var i = 0; i < groups.length; i++) {
    $('#' + groups[i] + 'title').css('display', groups[i] == name ? '' : 'none')
    $('#' + groups[i] + 'top').css('display', groups[i] == name ? '' : 'none')
  }
}