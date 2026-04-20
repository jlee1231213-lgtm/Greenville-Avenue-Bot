const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const StartupSession = require(path.join(__dirname, '../../models/startupsession'));
const Settings = require('../../models/settings');
const { DEFAULT_SETUP_EMBED, DEFAULT_STARTUP_EMBED, isLegacySetupEmbed, isLegacyStartupEmbed } = require('../../utils/defaultEmbeds');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

const activeStartupSessions = new Map();
const STARTUP_REACTION_IDENTIFIER = 'blue_heartburst:1493951094605353062';
const STARTUP_REACTION_ID = '1493951094605353062';
const STARTUP_REACTION_FALLBACK = '✅';

function isStartupReaction(reaction) {
  return reaction?.emoji?.id === STARTUP_REACTION_ID
    || reaction?.emoji?.identifier === STARTUP_REACTION_IDENTIFIER
    || reaction?.emoji?.name === STARTUP_REACTION_FALLBACK;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('startup')
    .setDescription('Start a session')
    .addIntegerOption(option =>
      option.setName('reactions')
        .setDescription('Amount of reactions needed to start')
        .setRequired(true)
    ),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    await interaction.deferReply({ flags: 64 });

    let settings = await Settings.findOne({ guildId: interaction.guild.id });
    
    // Create default settings if they don't exist
    if (!settings) {
      try {
        settings = await Settings.create({
          guildId: interaction.guild.id,
          embedcolor: '#ab6cc4',
          staffRoleId: null,
          startupEmbed: DEFAULT_STARTUP_EMBED,
          setupEmbed: DEFAULT_SETUP_EMBED
        });
      } catch (error) {
        return interaction.editReply({ content: 'Failed to create server settings. Please use `/settings` to configure the server.' });
      }
    }

    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings.staffRoleId)) {
      return interaction.editReply({ content: 'You must have the Staff role' });
    }

    const reactionsRequired = interaction.options.getInteger('reactions');
    const userId = interaction.user.id;
    const now = new Date();
    const embedColor = settings.embedcolor || '#ab6cc4';
    if (isLegacyStartupEmbed(settings.startupEmbed)) {
      settings.startupEmbed = DEFAULT_STARTUP_EMBED;
      await settings.save();
    }
    if (isLegacySetupEmbed(settings.setupEmbed)) {
      settings.setupEmbed = DEFAULT_SETUP_EMBED;
      await settings.save();
    }

    const startupTemplate = settings.startupEmbed || DEFAULT_STARTUP_EMBED;
    const setupTemplate = settings.setupEmbed || DEFAULT_SETUP_EMBED;

    const embed = new EmbedBuilder()
      .setTitle(startupTemplate.title?.replace(/\$user/g, `<@${userId}>`).replace(/\$date/g, now.toLocaleString()).replace(/\$reactions/g, reactionsRequired) || 'Data not found')
      .setDescription(startupTemplate.description?.replace(/\$user/g, `<@${userId}>`).replace(/\$date/g, now.toLocaleString()).replace(/\$reactions/g, reactionsRequired) || 'Data was not found, please use `/settings` to configure the Embed')
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    if (startupTemplate.image && startupTemplate.image.startsWith('http')) embed.setImage(startupTemplate.image);

    const message = await interaction.channel.send({ content: '@everyone', embeds: [embed] });
    let reacted = false;

    try {
      reacted = await message.react(STARTUP_REACTION_IDENTIFIER) ? true : false;
    } catch {
      // Continue through fallback reactions.
    }

    if (!reacted) {
      try {
        reacted = await message.react(STARTUP_REACTION_ID) ? true : false;
      } catch {
        // Continue through fallback reactions.
      }
    }

    if (!reacted) {
      try {
        reacted = await message.react(STARTUP_REACTION_FALLBACK) ? true : false;
      } catch {
        reacted = false;
      }
    }

    if (!reacted) {
      return interaction.editReply({ content: 'Session could not start because I could not add the startup reaction. Check Add Reactions and Use External Emojis permissions.' });
    }

    const sessionId = uuidv4();
    activeStartupSessions.set(sessionId, { userId, timestamp: now, type: 'session', messageId: message.id });

    await StartupSession.create({ guildId: interaction.guild.id, channelId: interaction.channel.id, messageId: message.id, createdAt: now });

    await interaction.editReply({ content: 'Session started successfully.' });

    const filter = (reaction, user) => isStartupReaction(reaction) && !user.bot;
    const collector = message.createReactionCollector({ filter, max: reactionsRequired, time: 1000 * 60 * 60 });

    collector.on('collect', async reaction => {
      const reactionCount = reaction.count || 0;
      if (reactionCount - 1 >= reactionsRequired) {
        collector.stop();

        const setupEmbed = new EmbedBuilder()
          .setTitle((setupTemplate.title || DEFAULT_SETUP_EMBED.title).replace(/\$user/g, `<@${userId}>`))
          .setDescription((setupTemplate.description || DEFAULT_SETUP_EMBED.description).replace(/\$user/g, `<@${userId}>`))
          .setColor(embedColor);

        if ((setupTemplate.image || DEFAULT_SETUP_EMBED.image)?.startsWith('http')) setupEmbed.setImage(setupTemplate.image || DEFAULT_SETUP_EMBED.image);

        await message.reply({ embeds: [setupEmbed] });
      }
    });

    collector.on('end', collected => {
      console.log(`Reaction collector ended. Total collected: ${collected.size}`);
    });
  }
};

module.exports.activeStartupSessions = activeStartupSessions;
