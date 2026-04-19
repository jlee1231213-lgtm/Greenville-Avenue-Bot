const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('911')
    .setDescription('Submit a civilian 911 call to dispatch')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Your location')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('incident')
        .setDescription('What is happening?')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('details')
        .setDescription('Additional details')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ff7f25';

    const location = interaction.options.getString('location', true);
    const incident = interaction.options.getString('incident', true);
    const details = interaction.options.getString('details') || 'No additional details provided.';

    const dispatchEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('911 Dispatch Call')
      .addFields(
        { name: 'Caller', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Location', value: location, inline: true },
        { name: 'Incident', value: incident, inline: false },
        { name: 'Details', value: details, inline: false }
      )
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
      .setTimestamp();

    let targetChannel = interaction.channel;
    if (settings?.logChannelId) {
      const fetched = await interaction.client.channels.fetch(settings.logChannelId).catch(() => null);
      if (fetched && fetched.isTextBased()) targetChannel = fetched;
    }

    await targetChannel.send({ embeds: [dispatchEmbed] });
    return interaction.editReply({ content: 'Your 911 call has been sent to dispatch.' });
  },
};
