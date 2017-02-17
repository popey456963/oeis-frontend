const Sequence = require('../models/Sequence')
const logger = require('./logger')()

/**
 * Handles any get requests to `/search`.  This program responds to the user with a
 * a JSON file which conatins search information results
 * 
 * @function search
 * @instance
 * @param {object} req - The request object sent by the client.
 * @param {object} res - The response object to reply to the client.
 */
exports.search = function(req, res) {
	if (req.query.fmt == 'json') {
		let items = []
		let query = req.query.q.split('"')
		// Odd numbered sequences go straight to items.
		// Even numbered sequences get split then go to items.
		for (let i = 0; i < query.length; i++) {
			if (i % 2) {
				items.push(query[i])
			} else {
				items.push(query[i].split(" "))
			}
		}
		items = [].concat.apply([], items).filter(function(n){ return n != "" })

		let search = parse(items, []).sort(weightSort)

		let values = searchDB(search)

		res.send(JSON.stringify({
			query: decodeURIComponent(req.query.q),
			parse: search
		}))
	} else {
		res.json({error: 1, msg: 'This format is currently not supported, sorry.'})
	}

  logger.log('Someone called search...')
}

function searchDB(tree) {
	for (let i = 0; i < tree.length; i++) {
		sortOptions(tree[i], function(results) {
			console.log(tree[i].type + ": " + results.length)
		})
	}
}

function sortOptions(sort, callback) {
	switch(sort.type) {
		case 'number':
			find({ 'data': new RegExp('\,' + sort.value + '\,|^' + sort.value + '\,|\,' + sort.value + '$') }, function(results) {
				callback(results)
			})
			break
		case 'sequence':
			find({ 'data': new RegExp(sort.value.join(','))}, function(results) {
				callback(results)
			})
			break
		case 'or':
			// Maybe some unification of results required here?
			searchDB(sort.value, function() { callback() })
			break
		case 'phrase':
			// Add in phrase searching
			break
		default:
			logger.error("Unknown type? " + sort.type)
	}
}

function find(search, callback) {
	Sequence.find(search, { 'number': 1, '_id': 0 }, function(err, docs) {
		if (err) throw err
		else {
			callback(docs)
		}
	})
}

function weightSort(a, b) {
  if (a.weight < b.weight) return 1
  if (a.weight > b.weight) return -1
  return 0
}

function parse(items, search) {
	let item = items.pop(0)
	if (item.split('|').length > 1) {
		let subsearch = parse(item.split('|'), [])
		let highest = 0
		for (let i = 0; i < subsearch.length; i++) {
			if (subsearch[i].weight > highest) {
				highest = subsearch[i].weight
			}
		}
		search.push({
			type: 'or',
			value: subsearch,
			weight: highest
		})
	}
	else if (item.indexOf(':') != -1) {
		// It looks like author:McJule
		// OR author:McJule|author:Euler
		let isNot = false
		if (item.charAt(0) == '-') {
			isNot = true
			item = item.substring(1)
		}
		search.push({
			type: item.split(':')[0],
			value: item.split(':')[1],
			inverse: isNot,
			weight: 30 
		})
	}
	else if (!isNaN(item)) {
		// It looks like 1 4 8
		search.push({
			type: 'number',
			value: item,
			weight: 10
		})
	}
	else if (item.split(',').length > 1) {
		let allNumbers = true
		let splitNumbers = item.split(',')
		for (let j = 0; j < splitNumbers; j++) {
			if (isNaN(splitNumbers[j])) {
				allNumbers = false
				break
			}
		}
		if (allNumbers) {
			// It looks like 1,4,8,9...
			search.push({
				type: 'sequence',
				value: item.split(',').map(Number),
				weight: 100
			})
		}
	} else {
		search.push({
			type: 'phrase',
			value: item,
			weight: 20
		})
	}
	if (items.length > 0) {
		return parse(items, search)
	} else {
		return search
	}
}