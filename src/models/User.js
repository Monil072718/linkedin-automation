const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  linkedinId: { type: String, unique: true, required: true },
  firstName: String,
  lastName: String,
  profilePicture: String,
  authorUrn: String, // urn:li:person:{id}
  accessToken: String,
  refreshToken: String,
  tokenExpiresAt: Date,
  scopes: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
