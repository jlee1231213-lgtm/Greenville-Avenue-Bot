const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const {
  DEFAULT_SETUP_EMBED,
  DEFAULT_SETUP_EMBED_VERSION,
  isLegacySetupEmbed,
} = require('../../utils/defaultEmbeds');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Post the setup notice'),
  async execute(interaction) {
    try {
      const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
      let settings = await Settings.findOne({ guildId: interaction.guild.id });

      if (!settings) {
        settings = await Settings.create({
          guildId: interaction.guild.id,
          embedcolor: '#ab6cc4',
          setupEmbedVersion: DEFAULT_SETUP_EMBED_VERSION,
          setupEmbed: DEFAULT_SETUP_EMBED,
        });
      }

      if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings.staffRoleId)) {
        return interaction.reply({ content: 'You must have the Staff role.', flags: 64 });
      }

      if (settings.setupEmbedVersion !== DEFAULT_SETUP_EMBED_VERSION || isLegacySetupEmbed(settings.setupEmbed)) {
        settings.setupEmbedVersion = DEFAULT_SETUP_EMBED_VERSION;
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

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Error running setup command.', flags: 64 });
      } else {
        await interaction.editReply({ content: '❌ Error running setup command.' });
      }
    }
  }
};
