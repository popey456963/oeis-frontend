var mongoose = require('mongoose')
var ttl = require('mongoose-ttl')

const MILLISECONDS = 1000

var schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true
  }
};

var pageViewSchema = new mongoose.Schema({
  page: { type: String, unique: true},
  totalViews: { type: Number, unique: false },
}, schemaOptions)

var hourViewSchema = new mongoose.Schema({
  page: { type: String, unique: false}
}, schemaOptions)

var dayViewSchema = new mongoose.Schema({
  page: { type: String, unique: false}
}, schemaOptions)

var weekViewSchema = new mongoose.Schema({
  page: { type: String, unique: false}
}, schemaOptions)

var activeUserSchema = new mongoose.Schema({
  email: { type: String, unique: true},
  name: { type: String, unique: true }
}, schemaOptions)

hourViewSchema.plugin(ttl, { ttl: 3600 * MILLISECONDS })
dayViewSchema.plugin(ttl, { ttl: 86400 * MILLISECONDS })
weekViewSchema.plugin(ttl, { ttl: 604800 * MILLISECONDS })
activeUserSchema.plugin(ttl, { ttl: 900 * MILLISECONDS })

var PageViews = mongoose.model('PageViews', pageViewSchema)
var HourViews = mongoose.model('HourViews', hourViewSchema)
var DayViews = mongoose.model('DayViews', dayViewSchema)
var WeekViews = mongoose.model('WeekViews', weekViewSchema)
var ActiveUsers = mongoose.model('ActiveUsers', activeUserSchema)

module.exports = {
  PageViews: PageViews,
  HourViews: HourViews,
  DayViews: DayViews,
  WeekViews: WeekViews,
  ActiveUsers: ActiveUsers
}