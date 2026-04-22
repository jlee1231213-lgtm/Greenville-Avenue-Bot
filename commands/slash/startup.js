const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const StartupSession = require(path.join(__dirname, '../../models/startupsession'));
const Settings = require('../../models/settings');
const { sendCommandLog } = require('../../utils/commandLogger');
const { DEFAULT_SETUP_EMBED, DEFAULT_STARTUP_EMBED, isLegacySetupEmbed, isLegacyStartupEmbed } = require('../../utils/defaultEmbeds');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

const activeStartupSessions = new Map();
const STARTUP_REACTION_IDENTIFIER = 'blue_heartburst:1493951094605353062';
const STARTUP_REACTION_ID = '1493951094605353062';
const STARTUP_REACTION_FALLBACK = '✅';
const STARTUP_STEP_TIMEOUT_MS = 15000;

function isStartupReaction(reaction) {
  return reaction?.emoji?.id === STARTUP_REACTION_ID
    || reaction?.emoji?.identifier === STARTUP_REACTION_IDENTIFIER
    || reaction?.emoji?.name === STARTUP_REACTION_FALLBACK;
}

function withTimeout(promise, label, timeoutMs = STARTUP_STEP_TIMEOUT_MS) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise,
  ]);
}

async function addStartupReaction(message) {
  for (const emoji of [STARTUP_REACTION_IDENTIFIER, STARTUP_REACTION_ID, STARTUP_REACTION_FALLBACK]) {
    try {
      await withTimeout(message.react(emoji), `Adding startup reaction ${emoji}`, 5000);
      return true;
    } catch (_) {
      // Continue through fallback reactions.
    }
  }

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('startup')
    .setDescription('Start a session')
    .addIntegerOption(option =>
      option.setName('reactions')
        .setDescription('Amount of reactions needed to start')
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    await interaction.deferReply({ ephemeral: true });

    try {
      if (!interaction.inGuild()) {
        return interaction.editReply({ content: 'This command can only be used in a server.' });
      }

      if (!interaction.channel?.isTextBased()) {
        return interaction.editReply({ content: 'This command can only be used in a text channel.' });
      }

      let settings = await withTimeout(
        Settings.findOne({ guildId: interaction.guild.id }),
        'Loading server settings'
      );

      if (!settings) {
        try {
          settings = await withTimeout(
            Settings.create({
              guildId: interaction.guild.id,
              embedcolor: '#ab6cc4',
              staffRoleId: null,
              startupEmbed: DEFAULT_STARTUP_EMBED,
              setupEmbed: DEFAULT_SETUP_EMBED
            }),
            'Creating server settings'
          );
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
      let needsSettingsSave = false;

      if (isLegacyStartupEmbed(settings.startupEmbed)) {
        settings.startupEmbed = DEFAULT_STARTUP_EMBED;
        needsSettingsSave = true;
      }
      if (isLegacySetupEmbed(settings.setupEmbed)) {
        settings.setupEmbed = DEFAULT_SETUP_EMBED;
        needsSettingsSave = true;
      }

      if (needsSettingsSave) {
        await withTimeout(settings.save(), 'Saving updated startup settings');
      }

      const startupTemplate = settings.startupEmbed || DEFAULT_STARTUP_EMBED;
      const setupTemplate = settings.setupEmbed || DEFAULT_SETUP_EMBED;

      const embed = new EmbedBuilder()
        .setTitle(startupTemplate.title?.replace(/\$user/g, `<@${userId}>`).replace(/\$date/g, now.toLocaleString()).replace(/\$reactions/g, reactionsRequired) || 'Data not found')
        .setDescription(startupTemplate.description?.replace(/\$user/g, `<@${userId}>`).replace(/\$date/g, now.toLocaleString()).replace(/\$reactions/g, reactionsRequired) || 'Data was not found, please use `/settings` to configure the Embed')
        .setColor(embedColor)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

      if (startupTemplate.image && startupTemplate.image.startsWith('http')) embed.setImage(startupTemplate.image);

      const message = await withTimeout(
        interaction.channel.send({ content: '@everyone', embeds: [embed] }),
        'Sending startup message'
      );
      const reacted = await addStartupReaction(message);

      if (!reacted) {
        return interaction.editReply({ content: 'Session could not start because I could not add the startup reaction. Check Add Reactions and Use External Emojis permissions.' });
      }

      const sessionId = uuidv4();
      activeStartupSessions.set(sessionId, { userId, timestamp: now, type: 'session', messageId: message.id });

      await withTimeout(
        StartupSession.create({ guildId: interaction.guild.id, channelId: interaction.channel.id, messageId: message.id, createdAt: now }),
        'Saving startup session'
      );

      await interaction.editReply({ content: 'Session started successfully.' });

      await sendCommandLog({
        interaction,
        settings,
        title: 'Startup Command Executed',
        description: `${interaction.user.tag} started a startup session.`,
        fields: [
          { name: 'Reactions Required', value: String(reactionsRequired), inline: true },
          { name: 'Startup Message', value: `[Jump to Message](${message.url})`, inline: true },
        ],
      });

      const filter = (reaction, user) => isStartupReaction(reaction) && !user.bot;
      const collector = message.createReactionCollector({ filter, max: reactionsRequired, time: 1000 * 60 * 60 });

      collector.on('collect', async reaction => {
        try {
          const reactionCount = reaction.count || 0;
          if (reactionCount - 1 < reactionsRequired) return;

          collector.stop();

          const setupEmbed = new EmbedBuilder()
            .setTitle((setupTemplate.title || DEFAULT_SETUP_EMBED.title).replace(/\$user/g, `<@${userId}>`))
            .setDescription((setupTemplate.description || DEFAULT_SETUP_EMBED.description).replace(/\$user/g, `<@${userId}>`))
            .setColor(embedColor);

          if ((setupTemplate.image || DEFAULT_SETUP_EMBED.image)?.startsWith('http')) {
            setupEmbed.setImage(setupTemplate.image || DEFAULT_SETUP_EMBED.image);
          }

          await message.reply({ embeds: [setupEmbed] });
        } catch (error) {
          console.error('Startup reaction collector failed:', error);
        }
      });

      collector.on('end', collected => {
        console.log(`Reaction collector ended. Total collected: ${collected.size}`);
      });
    } catch (error) {
      console.error('Startup command failed:', error);
      await interaction.editReply({
        content: 'Startup failed before it could finish. Check my channel permissions and database connection, then try again.'
      }).catch(() => {});
    }
  }
};

module.exports.activeStartupSessions = activeStartupSessions;
