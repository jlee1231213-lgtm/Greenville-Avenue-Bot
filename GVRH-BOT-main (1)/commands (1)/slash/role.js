const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Settings = require('../../models/settings');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Choose whether to add or remove the role')
        .setRequired(true)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        )
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Member to update')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to add or remove')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Optional audit reason for this change')
        .setRequired(false)
    ),

  async execute(interaction) {
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ffffff';
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';

    const hasConfiguredRole = memberHasAnyConfiguredRole(
      interaction.member,
      settings?.staffRoleId,
      settings?.adminRoleId
    );
    const hasManageRolesPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles);

    if (!bypassPerms && !hasConfiguredRole && !hasManageRolesPermission) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const action = interaction.options.getString('action');
    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const botMember = interaction.guild.members.me;

    if (!targetMember) {
      return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: 'I need the Manage Roles permission to do that.', ephemeral: true });
    }

    if (role.managed) {
      return interaction.reply({ content: 'I cannot manage integration or bot-managed roles.', ephemeral: true });
    }

    if (botMember.roles.highest.position <= role.position) {
      return interaction.reply({ content: 'That role is higher than or equal to my highest role.', ephemeral: true });
    }

    const invokerCanBypassHierarchy = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!invokerCanBypassHierarchy && interaction.member.roles.highest.position <= role.position) {
      return interaction.reply({ content: 'You cannot manage roles that are higher than or equal to your highest role.', ephemeral: true });
    }

    if (action === 'add') {
      if (targetMember.roles.cache.has(role.id)) {
        return interaction.reply({ content: `${targetUser.tag} already has ${role}.`, ephemeral: true });
      }

      await targetMember.roles.add(role, `${interaction.user.tag}: ${reason}`);
    } else {
      if (!targetMember.roles.cache.has(role.id)) {
        return interaction.reply({ content: `${targetUser.tag} does not have ${role}.`, ephemeral: true });
      }

      await targetMember.roles.remove(role, `${interaction.user.tag}: ${reason}`);
    }

    const embed = new EmbedBuilder()
      .setTitle('Role Updated')
      .setDescription([
        `**Action:** ${action === 'add' ? 'Added' : 'Removed'}`,
        `**User:** <@${targetUser.id}>`,
        `**Role:** ${role}`,
        `**Moderator:** <@${interaction.user.id}>`,
        `**Reason:** ${reason}`,
      ].join('\n'))
      .setColor(embedColor)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};