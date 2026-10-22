const mongoose = require('mongoose')
const { Schema } = mongoose

const siteSchema = new Schema({
  site: { type: String, required: true, unique: true },
  tradogramLocation: { type: String, default: '' },
  sageLocationId: { type: String, default: '' },
  loanAccountId: { type: String, default: '' },
  inventoryAccountId: { type: String, default: '' },
  updatedBy: String,
}, { timestamps: true })

const draftSchema = new Schema({
  deliveryCode: { type: String, required: true, unique: true },
  site: { type: String, default: '' }, vendorId: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' }, notes: { type: String, default: '' },
  lines: [{ _id: false, id: { type: String, required: true }, accountType: { type: String, enum: ['', 'loan', 'inventory'], default: '' }, glAccountCode: { type: String, default: '' } }],
  status: { type: String, enum: ['draft', 'ready'], default: 'draft' },
  sourceHash: String, configHash: String,
  snapshot: Schema.Types.Mixed,
  revision: { type: Number, default: 1 }, updatedBy: String,
  // Reserved for the future posting implementation; never writable through draft routes.
  intacctBillKey: { type: String, default: '' },
}, { timestamps: true })

module.exports = {
  SiteAccount: mongoose.model('TradogramSiteAccount', siteSchema),
  DeliveryDraft: mongoose.model('TradogramDeliveryDraft', draftSchema),
}
