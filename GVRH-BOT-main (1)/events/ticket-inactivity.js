const { Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const Ticket = require('../models/support');
const Settings = require('../models/settings');

const WARNING_AFTER_MS = 24 * 60 * 60 * 1000; // 24h
const CLOSE_AFTER_MS = 30 * 60 * 60 * 1000; // 24h + 6h grace
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10m

async function runInactivitySweep(client) {
  if (mongoose.connection.readyState !== 1) return;

  const tickets = await Ticket.find({});
  const now = Date.now();

  for (const ticket of tickets) {
    const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
    if (!guild) {
      await Ticket.deleteOne({ _id: ticket._id });
      continue;
    }

    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      // Skip on fetch failures instead of deleting DB row; this prevents stale-button issues.
      continue;
    }

    const settings = await Settings.findOne({ guildId: ticket.guildId }).catch(() => null);
    const embedColor = settings?.embedcolor || '#ff7f25';

    const lastOwnerAt = new Date(ticket.lastOwnerMessageAt || ticket.createdAt).getTime();
    const idleMs = now - lastOwnerAt;

    if (!ticket.inactivityWarningSentAt && idleMs >= WARNING_AFTER_MS) {
      const warningEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Inactivity Warning')
        .setDescription(`<@${ticket.ownerId}> this ticket has been inactive for 24 hours.\nIf you do not send a message, this ticket will close automatically in 6 hours.`)
        .setTimestamp();

      await channel.send({ embeds: [warningEmbed] }).catch(() => {});
      ticket.inactivityWarningSentAt = new Date();
      await ticket.save();
      continue;
    }

    if (ticket.inactivityWarningSentAt && idleMs >= CLOSE_AFTER_MS) {
      const closeEmbed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Ticket Closed Due To Inactivity')
        .setDescription(`This ticket was automatically closed because <@${ticket.ownerId}> did not send a message for 30 hours.`)
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] }).catch(() => {});
      await Ticket.deleteOne({ _id: ticket._id });
      await channel.delete('Ticket auto-closed due to owner inactivity').catch(() => {});
    }
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Run once on startup so stale inactive tickets are handled promptly.
    await runInactivitySweep(client).catch(err => {
      console.error('[ERROR] Ticket inactivity startup sweep failed:', err);
    });

    setInterval(() => {
      runInactivitySweep(client).catch(err => {
        console.error('[ERROR] Ticket inactivity sweep failed:', err);
      });
    }, CHECK_INTERVAL_MS);
  },
};

module.exports.runInactivitySweep = runInactivitySweep;
