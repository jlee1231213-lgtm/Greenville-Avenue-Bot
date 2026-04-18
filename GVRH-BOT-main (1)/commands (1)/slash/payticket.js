const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Eco = require('../../models/eco');
const Settings = require('../../models/settings');
const Ticket = require('../../models/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payticket')
    .setDescription('Pay a ticket you have received.')
    .addStringOption(option =>
      option.setName('ticket')
        .setDescription('Select the ticket to pay')
        .setRequired(true)
        .setAutocomplete(true)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const ticketId = interaction.options.getString('ticket');
    const ticket = await Ticket.findById(ticketId);
    const settings = await Settings.findOne({ guildId });
    const embedColor = settings?.embedcolor || "#ffffff";

    if (!ticket) return interaction.reply({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription('Ticket not found.')], ephemeral: true });
    if (ticket.UserID !== userId) return interaction.reply({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription('This ticket is not yours.')], ephemeral: true });

    let userEco = await Eco.findOne({ userId });
    if (!userEco) return interaction.reply({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription('You have no money to pay this ticket.')], ephemeral: true });

    let totalBalance = userEco.cash + userEco.bank;
    if (totalBalance < ticket.Price) return interaction.reply({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription(`You do not have enough funds to pay this ticket. Amount needed: $${ticket.Price}`)], ephemeral: true });

    let remaining = ticket.Price;

    if (userEco.bank >= remaining) {
      userEco.bank -= remaining;
      remaining = 0;
    } else {
      remaining -= userEco.bank;
      userEco.bank = 0;
    }

    if (remaining > 0) {
      userEco.cash -= remaining;
    }

    await userEco.save();
    await ticket.deleteOne();

    const embed = new EmbedBuilder()
      .setTitle('Ticket Paid')
      .setDescription(`You have successfully paid the ticket.\n**Offense:** ${ticket.Offense}\n**Amount Paid:** $${ticket.Price}`)
      .setColor(embedColor);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
