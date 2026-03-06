// Cipher model (example for mongoose)
const mongoose = require('mongoose')

const CipherSchema = new mongoose.Schema({
  encrypted: { type: String, required: true },
  iv: { type: String, required: true },
  tag: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Cipher', CipherSchema)
