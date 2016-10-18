/*
 * GET /langtest
 */
exports.langtest = function(req, res) {
  res.render('./test_lang', {
    page: 'Test-Lang',
    title: 'Lang Test :: OEIS Lookup'
  })
}