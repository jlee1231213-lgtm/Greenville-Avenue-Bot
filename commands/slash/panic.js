const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const { getConfiguredRoleIds, memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panic')
    .setDescription('Send an urgent officer panic alert')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Current location')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('details')
        .setDescription('What is happening?')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';

    const allowedRoleIds = getConfiguredRoleIds(settings?.leoRoleId, settings?.staffRoleId, settings?.adminRoleId);
    if (!bypassPerms && allowedRoleIds.length > 0 && !memberHasAnyConfiguredRole(interaction.member, settings?.leoRoleId, settings?.staffRoleId, settings?.adminRoleId)) {
      return interaction.editReply({ content: 'You do not have permission to send panic alerts.' });
    }

    const location = interaction.options.getString('location', true);
    const details = interaction.options.getString('details') || 'Officer requested immediate backup.';

    const panicEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('OFFICER PANIC ALERT')
      .setDescription(`Immediate response requested by <@${interaction.user.id}>`)
      .addFields(
        { name: 'Location', value: location, inline: false },
        { name: 'Details', value: details, inline: false }
      )
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
      .setTimestamp();

    await interaction.channel.send({ content: '@everyone', embeds: [panicEmbed] });
    return interaction.editReply({ content: 'Panic alert sent.' });
  },
};
