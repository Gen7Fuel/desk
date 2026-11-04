const mongoose = require("mongoose");
const { Schema } = mongoose;

const siteSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    folder: { type: String, required: true, unique: true },
    locationId: { type: String, default: "" },
    storeLocationIds: { type: [String], required: true },
  },
  { timestamps: true },
);

// A document per event keeps large days below Mongo's document-size limit.
const eventSchema = new Schema(
  {
    site: { type: String, required: true },
    key: { type: String, required: true },
    hash: { type: String, required: true },
    date: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
eventSchema.index({ site: 1, key: 1 }, { unique: true });
eventSchema.index({ site: 1, date: 1 });

const fileSchema = new Schema(
  {
    site: { type: String, required: true },
    path: { type: String, required: true },
    hash: { type: String, required: true },
    days: [String],
    eventKeys: [String],
    archived: { type: Boolean, default: false },
    archivePath: String,
  },
  { timestamps: true },
);
fileSchema.index({ site: 1, path: 1, hash: 1 }, { unique: true });
fileSchema.index({ site: 1, days: 1 });

const reportSchema = new Schema(
  {
    site: { type: String, required: true },
    date: { type: String, required: true },
    revision: { type: Number, default: 0 },
    acceptedHash: String,
    acceptedBy: String,
    acceptedAt: Date,
    acceptedEventHashes: [String],
    snapshot: Schema.Types.Mixed,
  },
  { timestamps: true },
);
reportSchema.index({ site: 1, date: 1 }, { unique: true });

const revisionSchema = new Schema(
  {
    site: String,
    date: String,
    revision: Number,
    sourceHash: String,
    acceptedBy: String,
    acceptedAt: Date,
    snapshot: Schema.Types.Mixed,
  },
  { timestamps: true },
);
revisionSchema.index({ site: 1, date: 1, revision: 1 }, { unique: true });

const lockSchema = new Schema({ _id: String, owner: String, expires: Date });
module.exports = {
  Site: mongoose.model("PosSite", siteSchema),
  Event: mongoose.model("PosEvent", eventSchema),
  File: mongoose.model("PosSourceFile", fileSchema),
  Report: mongoose.model("PosDailyReport", reportSchema),
  Revision: mongoose.model("PosReportRevision", revisionSchema),
  Lock: mongoose.model("PosReportLock", lockSchema),
};
