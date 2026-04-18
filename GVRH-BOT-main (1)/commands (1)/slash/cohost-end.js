const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Settings = require('../../models/settings');
const SessionLog = require('../../models/sessionlog');
const { activeStartupSessions } = require('../slash/startup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cohost-end')
    .setDescription('End a cohost session')
    .addStringOption(option =>
      option.setName('notes')
        .setDescription('Optional notes for the cohost end embed')
        .setRequired(false)
    ),
  async execute(interaction) {
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ab6cc4';
    // Role checks removed: anyone can use this command

    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const note = interaction.options.getString('notes') || 'No notes provided';

    const sessionEntry = [...activeStartupSessions.entries()]
      .find(([id, data]) => data.userId === userId && data.type === 'cohost');

    let sessionId;
    let sessionData;

    if (sessionEntry) {
      [sessionId, sessionData] = sessionEntry;
      const endTime = new Date();
      const updateResult = await SessionLog.updateOne(
        { guildId: interaction.guild.id, sessionId, sessiontype: 'cohost', timeended: null },
        { $set: { timeended: endTime } }
      );

      if (!updateResult.modifiedCount) {
        await SessionLog.create({
          guildId: interaction.guild.id,
          sessiontype: sessionData.type,
          sessionId,
          userId: sessionData.userId,
          timestarted: sessionData.timestamp,
          timeended: endTime,
        });
      }

      activeStartupSessions.delete(sessionId);
    } else {
      const activeDbSession = await SessionLog.findOne({
        guildId: interaction.guild.id,
        userId,
        sessiontype: 'cohost',
        timeended: null,
      }).sort({ timestarted: -1 });

      if (!activeDbSession) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setDescription('No active cohost session found. Run /cohost first, then /cohost-end when finished.')
              .setColor(embedColor)
          ]
        });
      }

      sessionId = activeDbSession.sessionId;
      sessionData = {
        userId: activeDbSession.userId,
        type: activeDbSession.sessiontype,
        timestamp: activeDbSession.timestarted,
        messageId: null,
      };

      await SessionLog.updateOne(
        { _id: activeDbSession._id, timeended: null },
        { $set: { timeended: new Date() } }
      );
    }

    const cohostEndTemplate = settings?.cohostendEmbed || {};
    const endEmbed = new EmbedBuilder()
      .setTitle(cohostEndTemplate.title || 'Data not found')
      .setDescription(cohostEndTemplate.description?.replace(/\$user/g, `<@${userId}>`).replace(/\$notes/g, note) || 'Data was not found, please use `/settings` to configure the Embed')
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });
    if (cohostEndTemplate.image?.startsWith('http')) endEmbed.setImage(cohostEndTemplate.image);
    if (cohostEndTemplate.thumbnail?.startsWith('http')) endEmbed.setThumbnail(cohostEndTemplate.thumbnail);

    const originalCohostMessage = sessionData.messageId
      ? await interaction.channel.messages.fetch(sessionData.messageId).catch(() => null)
      : null;
    const button = new ButtonBuilder().setCustomId('feedback').setLabel('Feedback Form').setStyle(ButtonStyle.Primary);
    const actionRow = new ActionRowBuilder().addComponents(button);

    if (originalCohostMessage && originalCohostMessage.reply) await originalCohostMessage.reply({ embeds: [endEmbed], components: [actionRow] });
    else await interaction.channel.send({ embeds: [endEmbed], components: [actionRow] });

    await interaction.editReply({ content: 'Command executed successfully', ephemeral: true });
  }
};
