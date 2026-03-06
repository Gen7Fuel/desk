const mongoose = require('mongoose')

const DeviceKindSchema = new mongoose.Schema({
  // Human-readable device type name, e.g. "Laptop", "POS Terminal"
  name: { type: String, required: true, unique: true },
})

module.exports = mongoose.model('DeviceKind', DeviceKindSchema)
