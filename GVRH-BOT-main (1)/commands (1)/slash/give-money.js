const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Eco = require('../../models/eco');
const Settings = require('../../models/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give-money')
    .setDescription('Give cash to another user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user you want to give money to')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('amount')
        .setDescription('The amount of cash to give')
        .setRequired(true)),

  async execute(interaction) {
    const { guild, member } = interaction;
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');

    const settings = await Settings.findOne({ guildId: guild.id });
    const embedColor = settings?.embedcolor || "#ff9933";

    if (!settings?.civiRoleId || !member.roles.cache.has(settings.civiRoleId)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(embedColor)
            .setDescription("You must have the **Civilian** role to use this command.")
        ],
        ephemeral: true
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(embedColor)
            .setDescription("You cannot give money to bots.")
        ],
        ephemeral: true
      });
    }

    if (amount <= 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(embedColor)
            .setDescription("The amount must be greater than 0.")
        ],
        ephemeral: true
      });
    }

    let senderEco = await Eco.findOne({ userId: interaction.user.id });
    if (!senderEco || senderEco.cash < amount) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(embedColor)
            .setDescription("You do not have enough cash to give.")
        ],
        ephemeral: true
      });
    }

    let recipientEco = await Eco.findOne({ userId: targetUser.id });
    if (!recipientEco) recipientEco = new Eco({ userId: targetUser.id });

    senderEco.cash -= amount;
    recipientEco.cash += amount;

    await senderEco.save();
    await recipientEco.save();

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Money Transferred')
      .setDescription(`Successfully transferred **$${amount}** to ${targetUser}.`);

    return interaction.reply({ embeds: [embed] });
  }
};
