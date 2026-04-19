const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const Settings = require(path.join(__dirname, '../../models/settings'));
const ModLog = require(path.join(__dirname, '../../models/modlogs'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('proof')
        .setDescription('Optional proof link')
        .setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const proof = interaction.options.getString('proof') || null;

    const settings = await Settings.findOne({ guildId });
    if (!settings) return interaction.reply({ content: 'Server settings not found!', ephemeral: true });

    // Role checks removed: anyone can use this command

    const guildMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!guildMember) return interaction.reply({ content: 'User not found in the server.', ephemeral: true });

    const embedColor = settings.embedcolor || '#ffffff';

    const dmEmbed = new EmbedBuilder()
      .setTitle(`${interaction.guild.name} | Banned`)
      .setDescription(`You have been banned from **${interaction.guild.name}**.
        
> **Reason**: ${reason}
> **Proof**: ${proof || 'No proof provided'}
> **Moderator**: <@${interaction.user.id}>/${interaction.user.tag}`)
      .setColor(embedColor)
      .setTimestamp();

    await target.send({ embeds: [dmEmbed] }).catch(() => null);

    await guildMember.ban({ reason });

    const newLog = new ModLog({
      userId: interaction.user.id,
      targetId: target.id,
      reason,
      type: 'ban',
      proof,
      date: new Date()
    });
    await newLog.save();

    const replyEmbed = new EmbedBuilder()
      .setTitle('User Banned')
      .setDescription(`<@${target.id}> has been banned from the server.`)
      .setColor(embedColor)
      .setTimestamp();

    return interaction.reply({ embeds: [replyEmbed], ephemeral: true });
  }
};
