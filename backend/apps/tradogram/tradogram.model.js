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
  vendorReference: { type: new Schema({ id: String, key: String, name: String, status: String, entityId: String }, { _id: false }), default: null },
  invoiceNumber: { type: String, default: '' }, notes: { type: String, default: '' },
  lines: [{ _id: false, id: { type: String, required: true }, accountType: { type: String, enum: ['', 'loan', 'inventory'], default: '' }, glAccountCode: { type: String, default: '' } }],
  status: { type: String, enum: ['draft', 'ready'], default: 'draft' },
  sourceHash: String, configHash: String,
  snapshot: Schema.Types.Mixed,
  revision: { type: Number, default: 1 }, updatedBy: String,
  // Written only by the Intacct draft creation workflow.
  intacctBillKey: { type: String, default: '' },
  intacctEntityId: String, intacctVendorId: String, intacctBillNumber: String, intacctBillNumberKey: String,
  intacctCreationState: { type: String, enum: ['', 'creating', 'created', 'failed', 'uncertain'], default: '' },
  intacctPreviewHash: String, intacctCreatedBy: String,
}, { timestamps: true })
// Reserve vendor/bill numbers across deliveries, including concurrent requests.
draftSchema.index({ intacctEntityId: 1, intacctVendorId: 1, intacctBillNumberKey: 1 }, {
  unique: true, partialFilterExpression: { intacctBillNumberKey: { $type: 'string' } },
})

module.exports = {
  SiteAccount: mongoose.model('TradogramSiteAccount', siteSchema),
  DeliveryDraft: mongoose.model('TradogramDeliveryDraft', draftSchema),
}
