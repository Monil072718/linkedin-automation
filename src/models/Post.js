const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  scheduleDate: { type: Date, required: true },
  status: { type: String, enum: ['pending','posted','failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  lastError: String,
  postedAt: Date,
  media: [{ assetUrn: String, title: String }], 
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);
