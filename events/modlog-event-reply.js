const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ModLog = require('../models/modlogs');
const Settings = require('../models/settings');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('modlog_')) {
      await interaction.deferUpdate();
      const [ , action, targetId, currentPage ] = interaction.customId.split('_');
      const page = parseInt(currentPage);
      const perPage = 5;

      const logs = await ModLog.find({ targetId }).sort({ date: -1 });
      if (!logs.length) return;

      const totalPages = Math.ceil(logs.length / perPage);
      let newPage = page;

      if (action === 'next' && page < totalPages) newPage++;
      if (action === 'prev' && page > 1) newPage--;

      const pageLogs = logs.slice((newPage - 1) * perPage, newPage * perPage);
      const settings = await Settings.findOne({ guildId: interaction.guild.id });
      const embedColor = settings?.embedcolor || '#ffffff';

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.guild.members.cache.get(targetId)?.user.tag || 'User'} | Mod Logs`)
        .setColor(embedColor)
        .setDescription(pageLogs.map(l => `**Type:** ${l.type}\n**Reason:** ${l.reason}\n**Proof:** ${l.proof || 'None'}\n**By:** <@${l.userId}>\n**Date:** <t:${Math.floor(l.date / 1000)}:f>`).join('\n\n'))
        .setFooter({ text: `Page ${newPage} of ${totalPages}` });

      const row = new ActionRowBuilder();
      if (totalPages > 1) {
        row.addComponents(
          new ButtonBuilder().setCustomId(`modlog_prev_${targetId}_${newPage}`).setLabel('<').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 1),
          new ButtonBuilder().setCustomId(`modlog_next_${targetId}_${newPage}`).setLabel('>').setStyle(ButtonStyle.Secondary).setDisabled(newPage === totalPages)
        );
      }

      await interaction.editReply({ embeds: [embed], components: row.components.length ? [row] : [] });
    }
  }
};
