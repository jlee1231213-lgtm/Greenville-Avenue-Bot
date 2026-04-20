const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const Settings = require('../../models/settings');
const { getConfiguredRoleIds, memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something as a message.')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to say')
        .setRequired(true)
    ),

  async execute(interaction) {
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const adminRoleIds = getConfiguredRoleIds(settings?.adminRoleId);

    if (adminRoleIds.length === 0) {
      return interaction.reply({
        content: 'No admin role IDs are configured yet. Please set `adminRoleId` first.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!memberHasAnyConfiguredRole(interaction.member, settings.adminRoleId)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const message = interaction.options.getString('message');
    await interaction.reply({ content: 'Message sent!', flags: MessageFlags.Ephemeral });
    // Only send the message after replying, not as a second reply
    await interaction.channel.send(message);
  }
};
