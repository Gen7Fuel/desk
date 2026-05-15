const mongoose = require('mongoose')

const FleetCardSchema = new mongoose.Schema(
  {
    cardNumber: { type: String, required: true, unique: true, match: /^\d{16}$/ },
    accountName: { type: String, required: true },
    driverName: { type: String, required: true },
    numberPlate: { type: String, required: true },
    makeModel: { type: String, required: true },
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
