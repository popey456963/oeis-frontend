var request = require('supertest')
var server = require('../../server')

describe('GET /welcome', function() {
  it('should render ok', function(done) {
    request(server)
      .get('/welcome')
      .expect(200, done)
  })
})