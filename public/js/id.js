$(function() {
  $("#favourite").on("click", function(e) {
    e.preventDefault()
    $.post(this.href).done(function(data) {
      console.log(data)
      if (data == "Favourited") {
      	// Favourited
        $("#heart").css("color", "red")
        $("#favtext").text(" Unfavourite")
        $("#favourite").attr("href", location.pathname + "/unfavourite")
        toastr.success('Favourited', '')
      }
      if (data == "Unfavourited") {
        // Unfavourited
        $("#heart").css("color", "#333333")
        $("#favtext").text(" Favourite")
        $("#favourite").attr("href", location.pathname + "/favourite")
        toastr.info('Unfavourited', '')
      }
    }).fail(function(xhr, status, err) {
      if (err == 'Unauthorized') toastr.error('Are you logged in?', 'Unauthorized!')
      else {
        toastr.error('Unknown Error...', '')
      }
    })
  })
})