const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const Warrant = require('../../models/warrant');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warrant')
    .setDescription('Issue a warrant for a user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to issue the warrant for')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('offense')
        .setDescription('Offense committed')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Duration of the warrant (e.g., 24h, 7d)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warrant')
        .setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    const settings = await Settings.findOne({ guildId });
    if (!settings) return interaction.reply({ content: 'Server settings not found!', ephemeral: true });

    const leoRoleId = settings.leoRoleId;
    if (!leoRoleId) return interaction.reply({ content: 'LEO role is not set in server settings.', ephemeral: true });
    if (!member.roles.cache.has(leoRoleId)) return interaction.reply({ content: 'You must have the LEO role to issue warrants.', ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const offense = interaction.options.getString('offense');
    const time = interaction.options.getString('time');
    const reason = interaction.options.getString('reason');

    const newWarrant = new Warrant({
      UserID: targetUser.id,
      OfficerID: member.id,
      Offense: offense,
      Time: time,
      Reason: reason
    });

    await newWarrant.save();

    const dmEmbed = new EmbedBuilder()
      .setTitle(`${interaction.guild.name} | Roleplay Warrant`)
      .setDescription(`Greetings <@${targetUser.id}>, a warrant has been issued against you.

**Offense:** ${offense}
**Duration:** ${time}
**Reason:** ${reason}
**Issued by:** <@${member.id}>

Please comply with authorities to avoid further consequences.`)
      .setColor(settings.embedcolor || '#ffffff');

    targetUser.send({ embeds: [dmEmbed] }).catch(() => null);

    const confirmationEmbed = new EmbedBuilder()
      .setTitle('Warrant Issued')
      .setDescription(`You have successfully issued a warrant for ${targetUser.tag}.\n**Offense:** ${offense}\n**Duration:** ${time}\n**Reason:** ${reason}`)
      .setColor(settings.embedcolor || '#ffffff');

    await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });
  }
};
