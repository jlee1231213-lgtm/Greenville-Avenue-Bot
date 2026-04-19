const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const SessionLog = require('../../models/sessionlog');
const Settings = require('../../models/settings');
const { activeStartupSessions } = require('../slash/startup');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end')
    .setDescription('End the session')
    .addStringOption(option =>
      option.setName('notes')
        .setDescription('How was the session')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
      const settings = await Settings.findOne({ guildId: interaction.guild.id });
      const embedColor = settings?.embedcolor || '#ab6cc4';
      if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings?.staffRoleId, settings?.adminRoleId)) {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('You do not have the required role to use this command.')
                .setColor(embedColor)
            ],
            ephemeral: true
          });
        } else {
          return await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription('You do not have the required role to use this command.')
                .setColor(embedColor)
            ],
            ephemeral: true
          });
        }
      }

      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;
      const note = interaction.options.getString('notes');
      const channel = interaction.channel;

      const sessionEntry = [...activeStartupSessions.entries()]
        .find(([id, data]) => data.userId === userId && data.type === 'session');

      if (!sessionEntry) {
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Data not found')
              .setDescription('No active session found. Please use `/settings` to configure the Embed.')
              .setColor(embedColor)
          ]
        });
      }

      const [sessionId, sessionData] = sessionEntry;

      await SessionLog.create({
        guildId: interaction.guild.id,
        sessiontype: sessionData.type,
        sessionId,
        userId: sessionData.userId,
        timestarted: sessionData.timestamp,
        timeended: new Date()
      });

      activeStartupSessions.delete(sessionId);

      const endEmbedTemplate = settings?.overEmbed || {};
      const endEmbed = new EmbedBuilder()
        .setTitle(endEmbedTemplate.title || 'Data not found')
        .setDescription(
          endEmbedTemplate.description
            ?.replace(/\$user/g, `<@${userId}>`)
            .replace(/\$notes/g, note) ||
          'Data was not found, please use `/settings` to configure the Embed.'
        )
        .setColor(embedColor)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

      if (endEmbedTemplate.image?.startsWith('http')) endEmbed.setImage(endEmbedTemplate.image);
      if (endEmbedTemplate.thumbnail?.startsWith('http')) endEmbed.setThumbnail(endEmbedTemplate.thumbnail);

      const button = new ButtonBuilder()
        .setCustomId('feedback')
        .setLabel('Feedback Form')
        .setStyle(ButtonStyle.Primary);
      const actionRow = new ActionRowBuilder().addComponents(button);

      await channel.send({ embeds: [endEmbed], });

      await interaction.editReply({ content: 'Session ended successfully.' });

      let logChannel;
      try { logChannel = await interaction.client.channels.fetch(settings?.logChannelId || '1419318345731411968'); } catch { logChannel = null; }

      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('Session Ended')
          .setDescription(`Session was ended by ${interaction.user.tag}`)
          .addFields(
            { name: 'Host', value: `<@${userId}>`, inline: true },
            { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
            { name: 'Message Link', value: `[Jump to Message](${channel.lastMessage?.url || ''})`, inline: true }
          )
          .setColor(embedColor)
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });
        await logChannel.send({ embeds: [logEmbed] });
      }

    } catch (error) {
      const embedColor = (await Settings.findOne({ guildId: interaction.guild.id }))?.embedcolor || '#ab6cc4';
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription(`There was an error executing the command.\n\`\`\`${error.message}\`\`\``)
        .setColor(embedColor);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      } catch {}

      let logChannel;
      try { logChannel = await interaction.client.channels.fetch('1419318345731411968'); } catch { logChannel = null; }
      if (logChannel) {
        const errorLogEmbed = new EmbedBuilder()
          .setTitle('Session Ended Command Error')
          .setDescription(`Command run by ${interaction.user.tag} failed.\n\`\`\`${error.message}\`\`\``)
          .setColor(embedColor);
        await logChannel.send({ embeds: [errorLogEmbed] });
      }
    }
  }
};
