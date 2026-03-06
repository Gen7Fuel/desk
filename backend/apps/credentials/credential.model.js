const mongoose = require('mongoose')

const CredentialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  url: { type: String },
  username: { type: String, required: true },
  password: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Credential', CredentialSchema)
