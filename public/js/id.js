$(function() {
  $("#favourite").on("click", function(e) {
    e.preventDefault()
    $.post(this.href, function(data) {
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
    })
  })
})