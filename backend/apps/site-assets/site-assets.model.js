const mongoose = require('mongoose')

const SiteAssetSchema = new mongoose.Schema({
  site: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: ['Bulloch Paypoint', 'Infonet Paypoint', 'PetroSoft', 'Tablet'],
  },
  deviceType: { type: String, required: true },
  label: { type: String, required: true },
  serialNumber: { type: String, default: '' },
  photo: { type: String, default: '' },
}, { timestamps: true })

module.exports = mongoose.model('SiteAsset', SiteAssetSchema)
