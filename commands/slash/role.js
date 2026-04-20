const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const Settings = require('../../models/settings');
const { getConfiguredRoleIds, memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('View the roles a member currently has.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member whose roles you want to view')
        .setRequired(true)
    ),

  async execute(interaction) {
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ffffff';
    const adminRoleIds = getConfiguredRoleIds(settings?.adminRoleId);

    if (adminRoleIds.length > 0 && !memberHasAnyConfiguredRole(interaction.member, settings.adminRoleId)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const targetUser = interaction.options.getUser('user', true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: 'That user is not in this server.',
        flags: MessageFlags.Ephemeral
      });
    }

    const roleMentions = targetMember.roles.cache
      .filter(role => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => `<@&${role.id}>`);

    const embed = new EmbedBuilder()
      .setTitle(`Roles for ${targetUser.tag}`)
      .setDescription(
        roleMentions.length > 0
          ? roleMentions.join(', ')
          : 'This member has no roles other than `@everyone`.'
      )
      .addFields(
        { name: 'User', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Role Count', value: String(roleMentions.length), inline: true }
      )
      .setColor(embedColor)
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    });
  }
};
