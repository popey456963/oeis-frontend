var mongoose = require('mongoose')

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
  page: { type: String, unique: false},
  createdAt: { type: Date, expires: '1h' }
}, schemaOptions)

var dayViewSchema = new mongoose.Schema({
  page: { type: String, unique: false},
  createdAt: { type: Date, expires: '1d' }
}, schemaOptions)

var weekViewSchema = new mongoose.Schema({
  page: { type: String, unique: false},
  createdAt: { type: Date, expires: '1w' }
}, schemaOptions)

var activeUserSchema = new mongoose.Schema({
  user: { type: String, unique: true},
  createdAt: { type: Date, expires: '15m' }
}, schemaOptions)

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