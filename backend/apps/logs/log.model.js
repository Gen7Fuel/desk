const mongoose = require('mongoose')

const logSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    app: { type: String, required: true, index: true },
    action: { type: String, enum: ['create', 'edit', 'delete'], required: true },
    entityId: { type: String, required: true },
    user: {
      id: { type: String },
      email: { type: String },
    },
    // Edit-specific fields
    field: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    // Delete-specific fields
    entitySnapshot: { type: mongoose.Schema.Types.Mixed },
    // Standard audit fields
    ip: { type: String },
    userAgent: { type: String },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
    },
  },
  { timestamps: false, versionKey: false },
)

module.exports = mongoose.model('Log', logSchema)
