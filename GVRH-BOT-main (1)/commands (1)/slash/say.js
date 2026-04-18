const { SlashCommandBuilder } = require('discord.js');
const Settings = require('../../models/settings');

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
    const message = interaction.options.getString('message');
    await interaction.reply({ content: 'Message sent!', ephemeral: true });
    // Only send the message after replying, not as a second reply
    await interaction.channel.send(message);
  }
};
