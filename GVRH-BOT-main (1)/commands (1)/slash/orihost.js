const { SlashCommandBuilder } = require('discord.js');
const cohost = require('./cohost');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('orihost')
    .setDescription('Alias for /cohost'),
  async execute(interaction) {
    return cohost.execute(interaction);
  }
};
