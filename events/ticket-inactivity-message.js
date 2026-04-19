const { Events } = require('discord.js');
const Ticket = require('../models/support');

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const ticket = await Ticket.findOne({ channelId: message.channel.id, ownerId: message.author.id });
    if (!ticket) return;

    ticket.lastOwnerMessageAt = new Date();
    ticket.inactivityWarningSentAt = null;
    await ticket.save().catch(() => {});
  },
};
