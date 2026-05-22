const mongoose = require('mongoose')

const TemplateTaskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    durationDays: { type: Number, required: true },
    order: { type: Number, required: true },
    dependsOnPrevious: { type: Boolean, default: true },
  },
  { _id: false }
)

const ProjectTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    tasks: [TemplateTaskSchema],
  },
  { timestamps: true }
)

module.exports = mongoose.model('ProjectTemplate', ProjectTemplateSchema)
