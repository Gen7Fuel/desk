const mongoose = require('mongoose')

const DEPARTMENTS = [
  'OPERATIONS',
  'INVENTORY',
  'STATION MANAGERS',
  'MARKETING',
  'PROCUREMENT',
]
const STATUSES = ['open', 'in-progress', 'on-hold', 'resolved']

const issueSchema = new mongoose.Schema(
  {
    station: { type: String, required: true, trim: true },
    issue: { type: String, required: true, trim: true },
    comments: { type: String, default: '', trim: true },
    department: { type: String, enum: DEPARTMENTS, required: true },
    assignee: { type: String, default: '', trim: true },
    startDate: { type: Date, required: true },
    notes: { type: String, default: '', trim: true },
    status: { type: String, enum: STATUSES, default: 'open' },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Issue', issueSchema)
