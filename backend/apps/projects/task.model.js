const mongoose = require('mongoose')

const TaskSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed', 'blocked'],
      default: 'not-started',
    },
    phase: {
      type: String,
      enum: ['planning', 'design', 'development', 'qa', 'launch'],
      default: 'planning',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    notes: { type: String },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Task', TaskSchema)
