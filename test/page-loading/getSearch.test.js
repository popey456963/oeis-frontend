var request = require('supertest')
var server = require('../../server')

describe('GET /search', function() {
  it('should render ok', function(done) {
    request(server)
      .get('/search?q=2,3,5,6,7,8,10')
      .expect(200, done)
  })
})
