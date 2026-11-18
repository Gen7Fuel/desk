const mongoose = require('mongoose')
const { Schema } = mongoose

const mappingSchema = new Schema({
  sourceKey: { type: String, required: true }, entityId: { type: String, required: true },
  vendorCode: { type: String, required: true }, vendorId: { type: String, required: true }, vendorName: String, updatedBy: String,
}, { timestamps: true })
mappingSchema.index({ sourceKey: 1, entityId: 1, vendorCode: 1 }, { unique: true })

const entrySchema = new Schema({
  sourceKey: { type: String, required: true }, entityId: { type: String, required: true }, invoiceId: { type: Number, required: true },
  invoiceNumber: String, vendorId: String, cogsType: String, previewHash: String,
  status: { type: String, enum: ['creating', 'created', 'failed', 'uncertain'], required: true },
  billKey: String, createdBy: String,
}, { timestamps: true })
entrySchema.index({ sourceKey: 1, entityId: 1, invoiceId: 1 }, { unique: true })

const VendorMapping = mongoose.models.BookworksVendorMapping || mongoose.model('BookworksVendorMapping', mappingSchema)
const IntacctEntry = mongoose.models.BookworksIntacctEntry || mongoose.model('BookworksIntacctEntry', entrySchema)

const repository = {
  getMapping: filter => VendorMapping.findOne(filter).lean(),
  saveMapping: (filter, data) => VendorMapping.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true }).lean(),
  getEntry: filter => IntacctEntry.findOne(filter).lean(),
  async claimEntry(filter, data) {
    await IntacctEntry.init()
    try { return { claimed: true, entry: await IntacctEntry.create({ ...filter, ...data, status: 'creating' }) } }
    catch (err) {
      if (err.code !== 11000) throw err
      const retry = await IntacctEntry.findOneAndUpdate({ ...filter, status: 'failed' }, { $set: { ...data, status: 'creating' } }, { new: true }).lean()
      return retry ? { claimed: true, entry: retry } : { claimed: false, entry: await IntacctEntry.findOne(filter).lean() }
    }
  },
  updateEntry: (filter, data) => IntacctEntry.updateOne(filter, { $set: data }),
}
module.exports = { VendorMapping, IntacctEntry, repository }
