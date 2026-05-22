const mongoose = require('mongoose')

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    site: { type: String, trim: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['planning', 'active', 'on-hold', 'completed'],
      default: 'planning',
    },
    startDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Project', ProjectSchema)
