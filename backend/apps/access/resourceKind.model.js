const mongoose = require('mongoose')


const ResourceKindSchema = new mongoose.Schema({
  // Human-readable resource type name, e.g. "Key Card", "Email"
  name: { type: String, required: true, unique: true },
})

module.exports = mongoose.model('ResourceKind', ResourceKindSchema)
