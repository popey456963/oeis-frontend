const Sequence = require('../models/Sequence')
const logger = require('./logger')()
// const Promise = require('bluebird')

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
		let time = +new Date()
		let items = []

		let query = req.query.q.split('"')
		let start = req.query.start || (req.query.page - 1) * 10 || 0
		let limit = req.query.limit || 10

		start = isNaN(parseInt(start)) ? 0 : parseInt(start)
		limit = isNaN(parseInt(limit)) ? 10 : parseInt(limit)

		if (limit > 100) { limit = 100 }
		if (limit < 1) { limit = 1 }

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

		let values = searchDB(search).then(function(result) {
			topResults = Object.keys(result).sort(function(a,b){ return result[b] - result[a] || a - b })
			count = topResults.length
			topResults = topResults.slice(start, start + limit)

			getItems(topResults).then(function(documents) {
				res.json({
					greeting: "Greetings from the OEIS! http://oeis.org/",
					query: decodeURIComponent(req.query.q),
					time: +new Date() - time,
					count: count,
					start: start,
					parse: search,
					results: documents,
				})
			})
		})
	} else {
		res.json({error: 1, msg: 'This format is currently not supported, sorry.'})
	}

  logger.log('Someone called search...')
}

function getItems(items) {
	let promises = []

	for (let i = 0; i < items.length; i++) {
		promises.push(getItem(items[i]))
	}

	return Promise.all(promises).then(function(results) {
		let mapped = results.map(function(item) { return item[0] })
		return mapped
	})
}

function getItem(item) {
	return new Promise(function(resolve, reject) {
		Sequence.find({ 'number': item }, { '_id': 0, '__v': 0, 'createdAt': 0, 'updatedAt': 0 }, function(err, docs) {
			if (err) throw err
			else {
				resolve(docs)
			}
		})
	})
}

function searchDB(tree) {
	let time = +new Date()
	let promises = []

	for (let i = 0; i < tree.length; i++) {
		promises.push(sortOptions(tree[i], tree[i].weight))
	}

	return Promise.all(promises).then(function(result) {
		let best = {}
		for (let i = 0; i < result.length; i++) {
			for (var j in result[i]) {
				if (best[j]) {
					best[j] += result[i][j]
				} else {
					best[j] = result[i][j]
				}
			}
		}
		return best
	})
}

function sortOptions(sort, weight) {
	return new Promise(function(resolve, reject) {
		switch(sort.type) {
			case 'number':
				find({ 'data': new RegExp('\,' + sort.value + '\,|^' + sort.value + '\,|\,' + sort.value + '$') }, function(results) {
					let value = {}
					for (let i = 0; i < results.length; i++) {
						value[results[i].number] = weight
					}
					resolve(value)
				})
				break
			case 'sequence':
				find({ 'data': new RegExp(sort.value.join(','))}, function(results) {
					let value = {}
					for (let i = 0; i < results.length; i++) {
						value[results[i].number] = weight
					}
					resolve(value)
				})
				break
			case 'or':
				// Maybe some unification of results required here?
				let or = searchDB(sort.value, true).then(function(results) {
					resolve(results)
				})
				break
			case 'phrase':
				// Add in phrase searching
				resolve({})
				break
			case 'keyword':
				find({ 'keyword': { "$regex": sort.value } }, function(results) {
					let value = {}
					for (let i = 0; i < results.length; i++) {
						value[results[i].number] = weight
					}
					resolve(value)
				})
				break
			case 'id':
				if (sort.value.charAt(0) == 'A') {
					sort.value = sort.value.slice(1)
				}
				sort.value = parseInt(sort.value)
				if (isNaN(sort.value)) resolve({}); return
				find({ 'number': sort.value }, function(results) {
					let value = {}
					for (let i = 0; i < results.length; i++) {
						value[results[i].number] = weight
					}
					resolve(value)
				})
				break
			default:
				logger.error("Unknown type? " + sort.type)
				resolve({})
		}
	})

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