var mongoose = require('mongoose')
var mongoosastic = require('mongoosastic')


var schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true
  },
  autoIndex: false
};

var seqSchema = new mongoose.Schema({
  number: { type: Number, unique: true, es_boost: 5.0},
  id: { type: String, unique: false, es_boost: 4.0},
  data: { type: String, unique: false, es_boost: 3.0},
  name: { type: String, unique: false, es_boost: 4.0},
  comment: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  reference: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  link: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  formula: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  example: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  maple: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  mathematica: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  program: { type: Array, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  xref: { type: Array, unique: false, es_boost: 1.0},
  keyword: { type: String, unique: false, es_boost: 1.0},
  offset: { type: String, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  author: { type: String, unique: false, es_boost: 2.0},
  references: { type: Number, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  revision: { type: Number, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  time: { type: Date, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0},
  created: { type: Date, unique: false, index: false, ensureIndex: true, index: 'hashed', es_boost: 1.0}
}, schemaOptions)

seqSchema.index({
    id: 'text', 
    number: 'text', 
    name: 'text', 
    comment: 'text',
    link: 'text',
    reference: 'text',
    keyword: 'text'
  }, {
    name: 'Weighting of Schema', 
    weights: {
      id: 10, 
      number: 10, 
      name: 5, 
      keyword: 5,
      comment: 3,
      link: 3,
      reference: 3,
    }
  }
)

seqSchema.set('autoindex', false)

seqSchema.plugin(mongoosastic)
var Sequence = mongoose.model('Sequence', seqSchema)
module.exports = Sequence