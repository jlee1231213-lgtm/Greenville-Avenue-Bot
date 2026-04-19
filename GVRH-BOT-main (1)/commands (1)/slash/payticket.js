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

    await interaction.deferReply({ ephemeral: true });

    const settings = await Settings.findOne({ guildId });
    const embedColor = settings?.embedcolor || '#ffffff';

    const replyWith = (description) =>
      interaction.editReply({
        embeds: [new EmbedBuilder().setColor(embedColor).setDescription(description)],
      });

    let ticket;
    try {
      ticket = await Ticket.findOne({ _id: ticketId, UserID: userId });
    } catch (error) {
      return replyWith('That ticket selection is invalid. Please choose the ticket from the autocomplete list and try again.');
    }

    if (!ticket) {
      return replyWith('Ticket not found, already paid, or not assigned to you.');
    }

    const ticketPrice = Number(ticket.Price) || 0;
    if (ticketPrice <= 0) {
      return replyWith('This ticket has an invalid price and cannot be paid right now. Please contact staff.');
    }

    let userEco = await Eco.findOne({ userId });
    if (!userEco) {
      return replyWith('You have no money to pay this ticket.');
    }

    const bankBalance = Number(userEco.bank) || 0;
    const cashBalance = Number(userEco.cash) || 0;
    const totalBalance = bankBalance + cashBalance;

    if (totalBalance < ticketPrice) {
      return replyWith(`You do not have enough funds to pay this ticket. Amount needed: $${ticketPrice}`);
    }

    let remaining = ticketPrice;
    userEco.bank = bankBalance;
    userEco.cash = cashBalance;

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
      .setDescription(`You have successfully paid the ticket.\n**Offense:** ${ticket.Offense}\n**Amount Paid:** $${ticketPrice}`)
      .setColor(embedColor);

    await interaction.editReply({ embeds: [embed] });
  }
};
