const mongoose = require('mongoose')

const LocationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
}, { timestamps: true })

module.exports = mongoose.model('Location', LocationSchema)
