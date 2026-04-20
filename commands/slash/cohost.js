const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const Settings = require('../../models/settings');
const SessionLog = require('../../models/sessionlog');
const { activeStartupSessions } = require('./startup');
const { v4: uuidv4 } = require('uuid');
const { DEFAULT_COHOST_EMBED } = require('../../utils/defaultEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cohost')
    .setDescription('Cohost a session'),
  async execute(interaction) {
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ab6cc4';
    const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
    const channelPermissions = botMember ? interaction.channel?.permissionsFor(botMember) : null;
    // Role checks removed: anyone can use this command

    if (!channelPermissions?.has(PermissionsBitField.Flags.ViewChannel)
      || !channelPermissions.has(PermissionsBitField.Flags.SendMessages)
      || !channelPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Channel Access Required')
            .setDescription('I cannot post the cohost embed here. Please give me View Channel, Send Messages, and Embed Links in this channel, then try again.')
            .setColor(embedColor)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;
    const timestamp = new Date();
    const sessionId = uuidv4();

    const latestStartup = [...activeStartupSessions.entries()]
      .filter(([id, data]) => data.type === 'session')
      .sort((a, b) => b[1].timestamp - a[1].timestamp)[0];

    let replyTarget;
    if (latestStartup) {
      const [id, data] = latestStartup;
      if (data.messageId) {
        try { replyTarget = await interaction.channel.messages.fetch(data.messageId); } catch { replyTarget = null; }
      }
    }

    if (settings && settings.cohostEmbedVersion !== 1) {
      settings.cohostEmbed = DEFAULT_COHOST_EMBED;
      settings.cohostEmbedVersion = 1;
      await settings.save();
    }

    const cohostTemplate = settings?.cohostEmbedVersion === 1
      ? settings.cohostEmbed
      : DEFAULT_COHOST_EMBED;
    const cohostEmbed = new EmbedBuilder()
      .setTitle(cohostTemplate.title || DEFAULT_COHOST_EMBED.title)
      .setDescription((cohostTemplate.description || DEFAULT_COHOST_EMBED.description).replace(/\$user/g, `<@${userId}>`))
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });
    if (cohostTemplate.image?.startsWith('http')) cohostEmbed.setImage(cohostTemplate.image);
    if (cohostTemplate.thumbnail?.startsWith('http')) cohostEmbed.setThumbnail(cohostTemplate.thumbnail);

    let postedMessage = null;
    try {
      if (replyTarget && replyTarget.reply) postedMessage = await replyTarget.reply({ embeds: [cohostEmbed] });
      else postedMessage = await interaction.channel.send({ embeds: [cohostEmbed] });
    } catch (error) {
      if (error?.code === 50001 || error?.code === 50013) {
        return interaction.editReply({ content: 'I could not send the cohost embed in this channel. Please check my channel access and permissions.' });
      }
      throw error;
    }

    activeStartupSessions.set(sessionId, {
      userId,
      timestamp,
      type: 'cohost',
      messageId: postedMessage?.id || null,
    });

    await SessionLog.create({
      guildId: interaction.guild.id,
      sessiontype: 'cohost',
      sessionId,
      userId,
      timestarted: timestamp,
      timeended: null,
    });

    await interaction.editReply({ content: 'Cohost registered successfully.' });
  }
};
