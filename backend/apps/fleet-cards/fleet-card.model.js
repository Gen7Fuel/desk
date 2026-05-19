const mongoose = require('mongoose')

const FleetCardSchema = new mongoose.Schema(
  {
    cardNumber: { type: String, required: true, unique: true, match: /^\d{16}$/ },
    accountName: { type: String, required: true },
    driverName: { type: String, default: '' },
    numberPlate: { type: String, default: '' },
    makeModel: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'inactive', 'lost', 'cancelled'],
      default: 'active',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
)

module.exports = mongoose.model('FleetCard', FleetCardSchema)
