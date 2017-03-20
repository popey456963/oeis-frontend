const mongoose = require('mongoose')

const schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true
  }
}

const favouriteSchema = new mongoose.Schema({
  email: { type: String, unique: false },
  seq: { type: String, unique: false },
}, schemaOptions)

const Favourite = mongoose.model('Favourite', favouriteSchema)

module.exports = Favourite