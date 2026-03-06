const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  role: { type: String, default: null },
  permissionOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

module.exports = mongoose.model('User', UserSchema)
