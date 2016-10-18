# OEIS Lookup

This project provides a graphical interface to accessing the OEIS database of integers.  It aims to be more user-friendly and faster than the official OEIS.org website from which this gets it's data.

One should note this project is going through massive changes at the moment, as it is in *Alpha*.  The website is often 2-3 weeks behind this master branch and should definitely not be taken as a "finished product".

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisities

To run this project, you will need the following items setup:

- Mongo Database
- Elastisearch Server
- Node (preferably v.4.x.x)
- NPM
- Gulp


### Installing

This is a step-by-step guide of how to get a dev environment up and running.  Start by cloning the repo and navigating to that directory:

```
git clone https://github.com/popey456963/oeis-frontend
cd oeis-frontend
```

Install all required modules, and build all the .scss files

```
gulp build
npm i
```

Ensure the elastisearch and mongo database is running, then start the server using node:

```
node server.js
```

If all works, you should be able to navigate to localhost:3005 and see the OEIS Lookup website.

## Running the tests

All tests are made using mocha, which can be installed via `npm i -g mocha`.  Once installed, you can run `mocha --recursive` or `npm test` in the OEIS-Frontend directory to run the test suite.

### Creating Tests

Tests are organised into sections based on what they are testing, these sections are as follows:

- `page-loading` - For testing entire pages

If you want to create a test, navigate to the desired section, duplicate the `_template.test.js` file and rename it to `testName.test.js`.  You can then fill the file with the test of your choice, an example for verifying whether `/` renders:

```javascript
var request = require('supertest');
var server = require('../../server');

describe('GET /', function() {
  it('should render ok', function(done) {
    request(server)
      .get('/')
      .expect(200, done);
  });
});
```

If you feel that there is a whole section of tests that don't fit anywhere, feel free to create a new directory with a name signifying what the tests do.

### Coding Style Tests

We enforce several code standards in order to keep the codebase maintainable, the full list can be found [here](http://standardjs.com/rules.html) but the key points are:

- We use two spaces for indentation.
- Always handle errors.
- Never have unused variables.
- Don't define multiple variables in one statement
- No semicolons at the end of lines

## Deployment

Deployment on a production server is identical to deployment on a development server apart from running `gulp build --production` instead of it's counterpart.

## Built With

* Node
* Express
* Elasticsearch
* Mongo

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/popey456963/oeis-frontend/tags). 

## Authors

* **Alexander Craggs** - *Initial work* - [Codefined](http://codefined.xyz)

See also the list of [contributors](https://github.com/popey456963/oeis-frontend/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* Several amazing individuals helped provide me with the motivation and skills in order to complete this project, including Developius and Polarlemniscate.
