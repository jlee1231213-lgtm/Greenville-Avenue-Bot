const mongoose = require('mongoose');

const modLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  targetId: { type: String, required: true },
  reason: { type: String, required: true },
  type: { type: String, required: true },
  proof: { type: String, default: null },
  date: { type: Date, required: true, default: Date.now }
});

module.exports = mongoose.model('ModLog', modLogSchema);
