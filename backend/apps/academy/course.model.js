const mongoose = require('mongoose')

const LearningItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['hotspot', 'video', 'mcq', 'flip-card', 'ordering', 'matching'],
    required: true,
  },
  order: { type: Number, required: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
})

const SectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  order: { type: Number, required: true },
  type: { type: String, enum: ['lesson', 'test'], default: 'lesson' },
  items: [LearningItemSchema],
})

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    sections: [SectionSchema],
  },
  { timestamps: true },
)

module.exports = mongoose.model('Course', CourseSchema)
