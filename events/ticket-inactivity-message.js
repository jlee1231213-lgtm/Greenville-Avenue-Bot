const { Events } = require('discord.js');
const Ticket = require('../models/support');
const hatepingsCommand = require('../commands/slash/hatepings');

const HATEPINGS_CHANNEL_ID = '1443224412395671737';

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const isHatepingsChannel = message.channel.id === HATEPINGS_CHANNEL_ID;
    const hasPing = message.mentions.everyone || message.mentions.users.size > 0 || message.mentions.roles.size > 0;

    if (isHatepingsChannel && hasPing) {
      try {
        await hatepingsCommand.postHatepingsMessage(message.channel);
      } catch (error) {
        console.error('[ERROR] Failed to auto-post hatepings embed:', error);
      }
    }

    const ticket = await Ticket.findOne({ channelId: message.channel.id, ownerId: message.author.id });
    if (!ticket) return;

    ticket.lastOwnerMessageAt = new Date();
    ticket.inactivityWarningSentAt = null;
    await ticket.save().catch(() => {});
  },
};
