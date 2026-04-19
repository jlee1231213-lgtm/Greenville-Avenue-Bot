const { EmbedBuilder } = require('discord.js');
const Settings = require('../models/settings');
const SessionLog = require('../models/sessionlog');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const [prefix, type, userId] = interaction.customId.split('_');
    if (prefix !== 'staffprofile') return;
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "You can't control another user's staff profile.", flags: 64 });
    }

    try {
      await interaction.deferReply({ flags: 64 });

      const settings = await Settings.findOne({ guildId: interaction.guild.id });
      const embedColor = settings?.embedcolor || '#ab6cc4';

      if (type === 'sessions') {
        const sessions = await SessionLog.find({ userId, sessiontype: 'session' }).sort({ timestarted: -1 });
        const description = sessions.length
          ? sessions.map(s => {
              const start = s.timestarted.toLocaleString();
              const end = s.timeended ? s.timeended.toLocaleString() : 'Still Active';
              const duration = s.timeended ? ((s.timeended - s.timestarted)/1000).toFixed(0)+'s' : 'N/A';
              return `• **Started:** ${start} | **Ended:** ${end} | **Duration:** ${duration}`;
            }).join('\n')
          : 'No session records found.';

        const embed = new EmbedBuilder()
          .setTitle(`Sessions (${sessions.length})`)
          .setDescription(description)
          .setColor(embedColor);

        await interaction.editReply({ embeds: [embed] });
      }

      if (type === 'cohost') {
        const cohosts = await SessionLog.find({ userId, sessiontype: 'cohost' }).sort({ timestarted: -1 });
        const itemsPerPage = 11;
        const description = cohosts.length
          ? cohosts.slice(0, itemsPerPage).map(s => {
              const start = s.timestarted.toLocaleString();
              const end = s.timeended ? s.timeended.toLocaleString() : 'Still Active';
              const duration = s.timeended ? ((s.timeended - s.timestarted)/1000).toFixed(0)+'s' : 'N/A';
              return `• **Started:** ${start} | **Ended:** ${end} | **Duration:** ${duration}`;
            }).join('\n')
          : 'No cohost records found.';

        const embed = new EmbedBuilder()
          .setTitle(`Cohost Sessions (${cohosts.length})`)
          .setDescription(description)
          .setColor(embedColor);

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error handling staff profile interaction:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'Something went wrong while loading this staff profile view.' }).catch(() => {});
      } else {
        await interaction.reply({ content: 'Something went wrong while loading this staff profile view.', flags: 64 }).catch(() => {});
      }
    }
  }
};
