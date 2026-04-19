const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const { getConfiguredRoleIds, memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bolo')
    .setDescription('Create a BOLO (be on the lookout) alert')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of BOLO')
        .setRequired(true)
        .addChoices(
          { name: 'Vehicle', value: 'Vehicle' },
          { name: 'Person', value: 'Person' },
          { name: 'Other', value: 'Other' }
        ))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Description of suspect/vehicle')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('last_seen')
        .setDescription('Last seen location')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('priority')
        .setDescription('Priority level')
        .setRequired(true)
        .addChoices(
          { name: 'Low', value: 'Low' },
          { name: 'Medium', value: 'Medium' },
          { name: 'High', value: 'High' }
        )),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ff7f25';
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';

    const allowedRoleIds = getConfiguredRoleIds(settings?.leoRoleId, settings?.staffRoleId, settings?.adminRoleId);
    if (!bypassPerms && allowedRoleIds.length > 0 && !memberHasAnyConfiguredRole(interaction.member, settings?.leoRoleId, settings?.staffRoleId, settings?.adminRoleId)) {
      return interaction.editReply({ content: 'You do not have permission to send BOLO alerts.' });
    }

    const type = interaction.options.getString('type', true);
    const description = interaction.options.getString('description', true);
    const lastSeen = interaction.options.getString('last_seen', true);
    const priority = interaction.options.getString('priority', true);

    const boloEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('BOLO Alert')
      .addFields(
        { name: 'Type', value: type, inline: true },
        { name: 'Priority', value: priority, inline: true },
        { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Description', value: description, inline: false },
        { name: 'Last Seen', value: lastSeen, inline: false }
      )
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
      .setTimestamp();

    await interaction.channel.send({ content: '@here', embeds: [boloEmbed] });
    return interaction.editReply({ content: 'BOLO alert sent.' });
  },
};
