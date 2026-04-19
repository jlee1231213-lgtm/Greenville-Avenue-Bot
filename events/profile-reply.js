const { 
  Events, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const Vehicle = require('../models/vehicle');
const Ticket = require('../models/tickets');
const Warrant = require('../models/warrant');
const Settings = require('../models/settings');
const Eco = require('../models/eco'); // Import eco schema

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('profile_')) return;

    const customIdParts = interaction.customId.split('_');
    const action = customIdParts[1];
    const userId = customIdParts[2];
    const page = parseInt(customIdParts[4]) || 1;

    const guildId = interaction.guild.id;
    const settings = await Settings.findOne({ guildId });
    const embedColor = settings?.embedcolor || '#ffffff';

    const user = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!user) {
      return interaction.reply({ content: 'User not found in the server.', flags: 64 });
    }

    if (action === 'vehicles') {
      const vehicles = await Vehicle.find({ UserID: userId });
      if (!vehicles || vehicles.length === 0) {
        return interaction.reply({ 
          embeds: [
            new EmbedBuilder()
              .setTitle(`${user.user.tag} | Registered Vehicles`)
              .setDescription('No vehicles registered.')
              .setColor(embedColor)
          ], 
          flags: 64 
        });
      }

      const perPage = 5;
      const totalPages = Math.ceil(vehicles.length / perPage);
      const start = (page - 1) * perPage;
      const currentVehicles = vehicles.slice(start, start + perPage);

      const embed = new EmbedBuilder()
        .setTitle(`${user.user.tag} | Registered Vehicles`)
        .setColor(embedColor)
        .setDescription(currentVehicles
          .map(v => `• ${v.brand} ${v.model} (${v.year}) | Color: ${v.Color} | Plate: ${v.Plate}`)
          .join('\n'))
        .setFooter({ text: `Page ${page} of ${totalPages}` });

      const buttons = new ActionRowBuilder();
      if (page > 1) buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`profile_vehicles_${userId}_page_${page - 1}`)
          .setLabel('<')
          .setStyle(ButtonStyle.Secondary)
      );
      if (page < totalPages) buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`profile_vehicles_${userId}_page_${page + 1}`)
          .setLabel('>')
          .setStyle(ButtonStyle.Secondary)
      );

      if (!customIdParts.includes('page')) {
        return interaction.reply({ embeds: [embed], components: buttons.components.length ? [buttons] : [], flags: 64 });
      } else {
        return interaction.update({ embeds: [embed], components: buttons.components.length ? [buttons] : [] });
      }
    }

    if (action === 'tickets') {
      const tickets = await Ticket.find({ UserID: userId });
      const warrants = await Warrant.find({ UserID: userId });

      const ticketList = tickets.map(t => `**Ticket:** ${t.Offense} | $${t.Price} | Issued by <@${t.OfficerID}>`).join('\n') || 'No tickets.';
      const warrantList = warrants.map(w => `**Warrant:** ${w.Offense} | ${w.Time} | Reason: ${w.Reason} | Issued by <@${w.OfficerID}>`).join('\n') || 'No warrants.';

      const embed = new EmbedBuilder()
        .setTitle(`${user.user.tag} | Public Service Records`)
        .setColor(embedColor)
        .addFields(
          { name: 'Tickets', value: ticketList, inline: false },
          { name: 'Warrants', value: warrantList, inline: false }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (action === 'balance') {
      try {
        let eco = await Eco.findOne({ userId });
        if (!eco) {
          eco = await Eco.create({ userId, cash: 0, bank: 0 });
        }

        const balanceEmbed = new EmbedBuilder()
          .setTitle(`${user.user.tag} | Account Balance`)
          .setColor(embedColor)
          .setDescription(`**Cash:** $${eco.cash}\n**Bank:** $${eco.bank}\n**Total:** $${eco.cash + eco.bank}`)
          .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) || '' });

        return interaction.reply({ embeds: [balanceEmbed], ephemeral: true });
      } catch (error) {
        console.error('Error fetching balance:', error);
        return interaction.reply({ content: 'Failed to fetch balance. Please try again later.', ephemeral: true });
      }
    }
  }
};
