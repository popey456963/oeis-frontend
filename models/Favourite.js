/*
 - Allow user to add seq to favourites through /A page
 - Show if seq is fav on /A:id page
 - Favourites page to list all user favourites
 - Stats page add most favourited sequence
*/

var mongoose = require('mongoose')

var schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true
  }
};

var favouriteSchema = new mongoose.Schema({
  email: { type: String, unique: false },
  seq: { type: String, unique: false },
}, schemaOptions)

var Favourite = mongoose.model('Favourite', favouriteSchema)

module.exports = Favourite