const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const Ticket = require('../../models/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('File a fine/ticket for a user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to issue the ticket to')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('offense')
        .setDescription('Reason for the ticket')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('price')
        .setDescription('Amount of the fine')
        .setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const member = interaction.member;

    const settings = await Settings.findOne({ guildId });
    if (!settings) return interaction.reply({ content: 'Server settings not found!', ephemeral: true });

    const leoRoleId = settings.leoRoleId;
    if (!leoRoleId) return interaction.reply({ content: 'LEO role is not set in server settings.', ephemeral: true });
    if (!member.roles.cache.has(leoRoleId)) return interaction.reply({ content: 'You must have the LEO role to issue tickets.', ephemeral: true });

    const finedUser = interaction.options.getUser('user');
    const offense = interaction.options.getString('offense');
    const price = interaction.options.getNumber('price');


    const newTicket = new Ticket({
      UserID: finedUser.id,
      OfficerID: member.id,
      Offense: offense,
      Price: price
    });

    await newTicket.save();

    const dmEmbed = new EmbedBuilder()
      .setTitle(` ${interaction.guild.name} | Roleplay Fine`)
      .setDescription(`Greetings <@${finedUser.id}>, you have been fined $${price} for ${offense}. We hope you can acknowledge this fine and wont do it again.
        
**Officer**: <@${interaction.user.id}>

**How to pay the ticket?**
To pay the ticket do /payticket and select the fine you would wish to pay. Make sure you do have enough money to pay for the fine in full.`)
      .setColor(settings.embedcolor || '#ffffff');

    finedUser.send({ embeds: [dmEmbed] }).catch(() => null);

    const confirmationEmbed = new EmbedBuilder()
      .setTitle('Ticket Issued')
      .setDescription(`You have successfully issued a ticket to ${finedUser.tag}.\n**Offense:** ${offense}\n**Price:** $${price}`)
      .setColor(settings.embedcolor || '#ffffff');

    await interaction.reply({ embeds: [confirmationEmbed], ephemeral: true });
  }
};
