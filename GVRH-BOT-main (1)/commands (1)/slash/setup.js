const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Quickly set up the server with a simple embed.'),
  async execute(interaction) {
    try {
      const settings = await Settings.findOne({ guildId: interaction.guild.id });
      const embedColor = settings?.embedcolor || '#155fa0';
      const embed = new EmbedBuilder()
        .setTitle('> <a:load:1489298699669737482> **Greenville Avenue, Setup!**<a:load:1489298699669737482>')
        .setDescription('<a:arrow3:1489298553942708364> {user} is offically setting up! Please do **NOT** ping host. Please patiently wait for **Host** to release early access for, server boosters, staff team, and public services and anyone with the early access role. This setup should take roguhly **5-10** minutes untill Early Access. Please wait untill then.')
        .setColor(embedColor)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });
      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Error running setup command.', ephemeral: true });
      } else {
        await interaction.editReply({ content: '❌ Error running setup command.' });
      }
    }
  }
};
