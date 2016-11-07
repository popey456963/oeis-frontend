console.log("Loaded Edit.js")
$('#submitedit').click(function() {
  console.log("Submitting Edit...")
  $.post("edit", { func: "getNameAndTime" }, function(data) {
    console.log( data.name ); // John
    console.log( data.time ); // 2pm
  }, "json");
})
