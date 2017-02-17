// Variable to store search regular expression
var qsRegex

// Inititialise Isotope
var $grid = $('.grid').isotope({
  itemSelector: '.grid-item',
  layoutMode: 'fitRows',
  filter: function() {
    return qsRegex ? $(this).text().match( qsRegex ) : true
  }
})

// Use value of search field to search
var $quicksearch = $('.quicksearch').keyup( debounce( function() {
  qsRegex = new RegExp( $quicksearch.val(), 'gi' )
  $grid.isotope()
}, 200 ) )

// Debounce so filtering doesn't happen every millisecond
function debounce( fn, threshold ) {
  var timeout
  return function debounced() {
    if ( timeout ) {
      clearTimeout( timeout )
    }
    function delayed() {
      fn()
      timeout = null
    }
    timeout = setTimeout( delayed, threshold || 100 )
  }
}
