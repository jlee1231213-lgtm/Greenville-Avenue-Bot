const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Eco = require('../../models/eco');
const Settings = require('../../models/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw money from your bank into cash.')
    .addNumberOption(option =>
      option.setName('amount')
        .setDescription('Amount to withdraw from your bank')
        .setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const settings = await Settings.findOne({ guildId });
    const embedColor = settings?.embedcolor || '#ffffff';

    const userId = interaction.user.id;
    const amount = interaction.options.getNumber('amount');

    let userEco = await Eco.findOne({ userId });
    if (!userEco) {
      userEco = new Eco({ userId });
      await userEco.save();
    }

    if (amount <= 0) return interaction.reply({ content: 'You must withdraw more than 0.', ephemeral: true });
    if (userEco.bank < amount) return interaction.reply({ content: 'You do not have enough in your bank.', ephemeral: true });

    userEco.bank -= amount;
    userEco.cash += amount;
    await userEco.save();

    const embed = new EmbedBuilder()
      .setTitle('Withdraw Successful')
      .setColor(embedColor)
      .setDescription(`You have withdrawn $${amount} from your bank.\nYour new balances:\n**Cash:** $${userEco.cash}\n**Bank:** $${userEco.bank}`);

    return interaction.reply({ embeds: [embed] });
  }
};
