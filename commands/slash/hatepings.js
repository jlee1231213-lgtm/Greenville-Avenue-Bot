const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hatepings')
    .setDescription('Post instructions for muting ping-heavy channels and partnerships.'),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ab6cc4';

    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings?.staffRoleId, settings?.adminRoleId)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Tired of the Pings?')
      .setDescription(`• Simply Right-Click on this channel, (press and hold for mobile), and choose 'Mute Channel' and the appropriate duration! Any issues, please open a ticket!

↳ Want to partner with Greenville Avenue? Ensure you meet our requirements & open a support ticket in order to request an alliance!`)
      .setColor(embedColor)
      .setImage('https://media.tenor.com/5KsAptV-UhkAAAAM/logs-mute-logs.gif')
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    await interaction.reply({ embeds: [embed] });
  },
};