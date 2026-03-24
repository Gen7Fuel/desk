const mongoose = require('mongoose')

const BOLPhotoSchema = new mongoose.Schema(
  {
    site: { type: String, required: true, index: true },
    date: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: 'date must be in YYYY-MM-DD format',
      },
    },
    filename: { type: String, required: true },
    bolNumber: { type: String, required: true, trim: true },
    comments: [
      {
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        user: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
)

BOLPhotoSchema.index({ site: 1, date: 1, filename: 1 }, { unique: true })

const BOLPhoto = mongoose.models.BOLPhoto || mongoose.model('BOLPhoto', BOLPhotoSchema)

module.exports = BOLPhoto
