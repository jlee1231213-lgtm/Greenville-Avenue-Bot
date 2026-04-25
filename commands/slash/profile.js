const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Vehicle = require('../../models/vehicle');
const Ticket = require('../../models/tickets');
const License = require('../../models/license');
const Settings = require('../../models/settings');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Displays the roleplay profile of a user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Select a user to view their profile. If not selected, shows your profile.')
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const selectedUser = interaction.options.getUser('user') || interaction.user;
      if (!selectedUser || !selectedUser.username) {
        return interaction.editReply({ content: 'Invalid user selected.' });
      }

      const guildId = interaction.guild.id;
      const settings = await Settings.findOne({ guildId });
      const embedColor = settings?.embedcolor || '#ffffff';

      const userId = selectedUser.id;
      const guild = interaction.guild;

      const license = await License.findOne({ userId }).catch(() => null);
      const licenseStatus = license?.status || 'Active';

      const vehicles = await Vehicle.find({ UserID: userId }).catch(() => []);
      const vehicleCount = vehicles.length;
      const vehicleList = vehicles.map(v => `• ${v.brand} ${v.model} (${v.year}) | Color: ${v.Color} | Plate: ${v.Plate}`).join('\n') || 'No registered vehicles';

      const apikey = "37a80efe-6341-4a19-b8f8-dcd656bf7add";
      const bloxlinkUrl = `https://api.blox.link/v4/public/guilds/${guild.id}/discord-to-roblox/${userId}`;
      const bloxlinkResponse = await axios.get(bloxlinkUrl, { headers: { 'Authorization': apikey } }).catch(() => null);

      let robloxID, robloxUsername, robloxProfileLink, robloxThumbnail;

      if (bloxlinkResponse?.status === 200 && bloxlinkResponse.data.robloxID) {
        robloxID = bloxlinkResponse.data.robloxID;
        robloxProfileLink = `https://www.roblox.com/users/${robloxID}/profile`;
      }

      if (robloxID) {
        const [robloxResponse, headshotResponse] = await Promise.all([
          axios.get(`https://users.roblox.com/v1/users/${robloxID}`).catch(() => null),
          axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxID}&size=150x150&format=Png`).catch(() => null),
        ]);

        if (robloxResponse?.status === 200) robloxUsername = robloxResponse.data.name;
        if (headshotResponse?.status === 200 && headshotResponse.data.data.length > 0) {
          robloxThumbnail = headshotResponse.data.data[0].imageUrl;
        }
      }

      const profileEmbed = new EmbedBuilder()
        .setTitle('Roleplay Profile')
        .setDescription(
`All information about the user has been provided below
**Roblox Username:** ${robloxUsername || 'N/A'}
**User ID:** ${userId}
**Registered Vehicles (${vehicleCount}):**

**License Status:** ${licenseStatus}`
        )
        .setThumbnail(robloxThumbnail || selectedUser.displayAvatarURL({ dynamic: true }) || '')
        .setColor(embedColor)
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) || '' });

      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`view_vehicles_${userId}`)
            .setLabel('Registered Assets')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`view_tickets_${userId}`)
            .setLabel('Public Service Records')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`view_balance_${userId}`)
            .setLabel('Account Balance')
            .setStyle(ButtonStyle.Secondary),
        );

      await interaction.editReply({ embeds: [profileEmbed], components: [buttons] });

    } catch (error) {
      console.error('Error executing profile command:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'An error occurred while executing the command.' }).catch(() => {});
      } else {
        await interaction.reply({ content: 'An error occurred while executing the command.', flags: 64 }).catch(() => {});
      }
    }
  },
};
