const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const StartupSession = require(path.join(__dirname, '../../models/startupsession'));
const Settings = require('../../models/settings');

const activeStartupSessions = new Map();

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
    await interaction.deferReply({ ephemeral: true });

    let settings = await Settings.findOne({ guildId: interaction.guild.id });
    
    // Create default settings if they don't exist
    if (!settings) {
      try {
        settings = await Settings.create({
          guildId: interaction.guild.id,
          embedcolor: '#ab6cc4',
          staffRoleId: null,
          startupEmbed: {
            title: 'Startup Session Started by $user',
            description: 'React with ✅ to join the session!'
          },
          setupEmbed: {}
        });
      } catch (error) {
        return interaction.editReply({ content: 'Failed to create server settings. Please use `/settings` to configure the server.', ephemeral: true });
      }
    }

    const staffRoleId = settings.staffRoleId;
    if (!bypassPerms && (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId))) {
      return interaction.editReply({ content: 'You must have the Staff role', ephemeral: true });
    }

    const reactionsRequired = interaction.options.getInteger('reactions');
    const userId = interaction.user.id;
    const now = new Date();
    const embedColor = settings.embedcolor || '#ab6cc4';
    const startupTemplate = settings.startupEmbed || {};
    const setupTemplate = settings.setupEmbed || {};

    const embed = new EmbedBuilder()
      .setTitle(startupTemplate.title?.replace(/\$user/g, `<@${userId}>`).replace(/\$date/g, now.toLocaleString()).replace(/\$reactions/g, reactionsRequired) || 'Data not found')
      .setDescription(startupTemplate.description?.replace(/\$user/g, `<@${userId}>`).replace(/\$date/g, now.toLocaleString()).replace(/\$reactions/g, reactionsRequired) || 'Data was not found, please use `/settings` to configure the Embed')
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    if (startupTemplate.image && startupTemplate.image.startsWith('http')) embed.setImage(startupTemplate.image);

    const message = await interaction.channel.send({ content: '@everyone', embeds: [embed] });
    await message.react('✅');

    const sessionId = uuidv4();
    activeStartupSessions.set(sessionId, { userId, timestamp: now, type: 'session', messageId: message.id });

    await StartupSession.create({ guildId: interaction.guild.id, channelId: interaction.channel.id, messageId: message.id, createdAt: now });

    await interaction.editReply({ content: 'Session started successfully.', ephemeral: true });

    const filter = (reaction, user) => reaction.emoji.name === '✅' && !user.bot;
    const collector = message.createReactionCollector({ filter, max: reactionsRequired, time: 1000 * 60 * 60 }); 

    collector.on('collect', async () => {
      if (message.reactions.cache.get('✅')?.count - 1 >= reactionsRequired) {
        collector.stop();

        const setupEmbed = new EmbedBuilder()
          .setTitle(setupTemplate.title?.replace(/\$user/g, `<@${userId}>`) || 'Data not found')
          .setDescription(setupTemplate.description?.replace(/\$user/g, `<@${userId}>`) || 'Data was not found, please use `/settings` to configure the Embed')
          .setColor(embedColor);

        if (setupTemplate.image && setupTemplate.image.startsWith('http')) setupEmbed.setImage(setupTemplate.image);

        await message.reply({ embeds: [setupEmbed] });
      }
    });

    collector.on('end', collected => {
      console.log(`Reaction collector ended. Total collected: ${collected.size}`);
    });
  }
};

module.exports.activeStartupSessions = activeStartupSessions;
