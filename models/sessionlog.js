const mongoose = require('mongoose');

const sessionLogSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
  sessiontype: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  timestarted: {
    type: Date,
    required: true
  },
  timeended: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('SessionLog', sessionLogSchema);