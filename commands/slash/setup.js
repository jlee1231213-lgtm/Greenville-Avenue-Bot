const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const StartupSession = require('../../models/startupsession');
const { DEFAULT_SETUP_EMBED, isLegacySetupEmbed } = require('../../utils/defaultEmbeds');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Post the setup notice'),
  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
      let settings = await Settings.findOne({ guildId: interaction.guild.id });

      if (!settings) {
        settings = await Settings.create({
          guildId: interaction.guild.id,
          embedcolor: '#ab6cc4',
          setupEmbed: DEFAULT_SETUP_EMBED,
        });
      }

      if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings.staffRoleId)) {
        return interaction.editReply({ content: 'You must have the Staff role.' });
      }

      if (isLegacySetupEmbed(settings.setupEmbed)) {
        settings.setupEmbed = DEFAULT_SETUP_EMBED;
        await settings.save();
      }

      const embedColor = settings?.embedcolor || '#155fa0';
      const setupTemplate = settings.setupEmbed || DEFAULT_SETUP_EMBED;
      const embed = new EmbedBuilder()
        .setTitle((setupTemplate.title || DEFAULT_SETUP_EMBED.title).replace(/\$user/g, `<@${interaction.user.id}>`))
        .setDescription((setupTemplate.description || DEFAULT_SETUP_EMBED.description).replace(/\$user/g, `<@${interaction.user.id}>`))
        .setColor(embedColor)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

      if ((setupTemplate.image || DEFAULT_SETUP_EMBED.image)?.startsWith('http')) {
        embed.setImage(setupTemplate.image || DEFAULT_SETUP_EMBED.image);
      }

      const latestStartup = await StartupSession.findOne({
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
      }).sort({ createdAt: -1 });

      if (!latestStartup) {
        return interaction.editReply({ content: 'No startup message found in this channel. Run `/startup` first.' });
      }

      const startupMessage = await interaction.channel.messages.fetch(latestStartup.messageId).catch(() => null);
      if (!startupMessage) {
        return interaction.editReply({ content: 'Startup message could not be found. Please run `/startup` again.' });
      }

      await startupMessage.reply({ embeds: [embed] });
      await interaction.editReply({ content: 'Setup notice sent as a reply to the latest startup message.' });
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Error running setup command.', flags: 64 });
      } else {
        await interaction.editReply({ content: '❌ Error running setup command.' });
      }
    }
  }
};
