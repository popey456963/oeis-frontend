console.log("Loaded Edit.js")

$.fn.serializeObject = function()
{
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

$('#submitedit').click(function(e) {
  
  var data = $('form').serializeObject()
  console.log(data)

  console.log("Submitting Edit...")

  $.post("edit", data, function(data) {
    console.log(data)
  })

  e.preventDefault()

})