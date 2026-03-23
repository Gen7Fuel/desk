const mongoose = require('mongoose')

const KardpollSchema = new mongoose.Schema({
  site: { type: String, required: true },
  date: { type: String, required: true },
  totalSales: { type: String, required: true },
  totalLitres: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Kardpoll', KardpollSchema)
