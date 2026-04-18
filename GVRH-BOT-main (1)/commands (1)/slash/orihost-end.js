const { SlashCommandBuilder } = require('discord.js');
const cohostEnd = require('./cohost-end');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orihost-end')
    .setDescription('Alias for /cohost-end')
    .addStringOption(option =>
      option.setName('notes')
        .setDescription('Optional notes for the cohost end embed')
        .setRequired(false)
    ),
  async execute(interaction) {
    return cohostEnd.execute(interaction);
  }
};
