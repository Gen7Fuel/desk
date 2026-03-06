const mongoose = require('mongoose')

const SubscriptionSchema = new mongoose.Schema({
  category: { type: String, required: true },
  identifier: { type: String, required: true },
  price: { type: Number, required: true },
  billing_cycle: { type: String, enum: ['monthly', 'yearly'], required: true },
  end_date: { type: Date, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Subscription', SubscriptionSchema)
