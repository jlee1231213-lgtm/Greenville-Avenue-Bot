const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const SessionLog = require('../../models/sessionlog');
const { activeStartupSessions } = require('./startup');
const { v4: uuidv4 } = require('uuid');
const { DEFAULT_COHOST_EMBED } = require('../../utils/defaultEmbeds');
const { setEmbedMedia } = require('../../utils/embedMedia');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cohost')
    .setDescription('Cohost a session'),
  async execute(interaction) {
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ab6cc4';
    // Role checks removed: anyone can use this command

    await interaction.deferReply({ ephemeral: true });
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
    setEmbedMedia(cohostEmbed, cohostTemplate);

    let postedMessage = null;
    if (replyTarget && replyTarget.reply) postedMessage = await replyTarget.reply({ embeds: [cohostEmbed] });
    else postedMessage = await interaction.channel.send({ embeds: [cohostEmbed] });

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

    await interaction.editReply({ content: 'Cohost registered successfully.', ephemeral: true });
  }
};
