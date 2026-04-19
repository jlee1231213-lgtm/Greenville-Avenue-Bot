const mongoose = require('mongoose');

const ticket2Schema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  roleId: { type: String, required: true },
  type: { type: String, required: true }, // 'st', 'mr', 'ma'
  claimed: { type: String, default: null }, // userId of claimer
    lastOwnerMessageAt: { type: Date, default: Date.now },
  inactivityWarningSentAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Ticketsupport', ticket2Schema);
