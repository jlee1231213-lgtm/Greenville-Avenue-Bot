const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  welcomechannelid: { type: String, default: null },
  logChannelId: { type: String, default: null },
  leoRoleId: { type: String, default: null },
  civiRoleId: { type: String, default: null },
  eaRoleId: { type: String, default: null },
  staffRoleId: { type: String, default: null },
  adminRoleId: { type: String, default: null },
  embedcolor: { type: String, default: '#ffffff' },
  vehiclelist: { type: String, default: null },
  trailerlist: { type: String, default: null },
  vehicleCaps: [
    {
      roleId: { type: String, required: true },
      cap: { type: Number, required: true }
    }
  ],
  startupEmbed: { title: String, description: String, image: String },
  cohostEmbedVersion: { type: Number, default: 0 },
  eaEmbedVersion: { type: Number, default: 0 },
  eaEmbed: { title: String, description: String, image: String },
  giveawayEmbed: { title: String, description: String, image: String },
  welcomeEmbed: { title: String, description: String, image: String },
  cohostEmbed: { title: String, description: String, image: String },
  cohostendEmbed: { title: String, description: String, image: String },
  ticketSupportEmbed: { title: String, description: String, image: String, placeholder: String },
  setupEmbed: { title: String, description: String, image: String },
  releaseEmbed: { title: String, description: String, image: String },
  reinvitesEmbed: { title: String, description: String, image: String },
  overEmbed: { title: String, description: String, image: String },
});

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
