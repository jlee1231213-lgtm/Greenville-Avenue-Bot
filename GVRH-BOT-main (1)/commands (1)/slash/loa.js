const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Post a leave of absence notice')
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the leave of absence')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('How long the leave will last')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ab6cc4';

    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings?.staffRoleId, settings?.adminRoleId)) {
      return interaction.editReply({ content: 'You do not have the required role to use this command.' });
    }

    const reason = interaction.options.getString('reason');
    const duration = interaction.options.getString('duration');

    const embed = new EmbedBuilder()
      .setTitle('Leave of Absence')
      .setDescription([
        `**Staff Member:** <@${interaction.user.id}>`,
        `**Reason:** ${reason}`,
        `**Duration:** ${duration}`,
      ].join('\n'))
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.editReply({ content: 'LOA posted successfully.' });
  }
};