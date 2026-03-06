const mongoose = require('mongoose')

const ResourceSchema = new mongoose.Schema({
  type: { type: String, required: true },
  identifier: { type: String, required: true }
}, { _id: false })

const DeviceSchema = new mongoose.Schema({
  type: { type: String, required: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  identifier: { type: String, required: true },
  location: { type: String, default: '' }
}, { _id: false })

const PersonnelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  resources: { type: [ResourceSchema], default: [] },
  devices: { type: [DeviceSchema], default: [] },
}, { timestamps: true })

module.exports = mongoose.model('Personnel', PersonnelSchema)
