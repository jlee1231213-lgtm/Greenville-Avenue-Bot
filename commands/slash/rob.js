const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Eco = require('../../models/eco');
const Settings = require('../../models/settings');

function formatCooldown(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob cash from another user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user you want to rob')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const { guild, user } = interaction;
      const targetUser = interaction.options.getUser('user');
      const settings = await Settings.findOne({ guildId: guild.id });
      const embedColor = settings?.embedcolor || '#ff9933';

      if (targetUser.id === user.id) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription('You cannot rob yourself.')
          ]
        });
      }

      if (targetUser.bot) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription('You cannot rob bots.')
          ]
        });
      }

      const cooldownTime = 60 * 60 * 1000;
      const now = Date.now();

      let robberEco = await Eco.findOne({ userId: user.id });
      if (!robberEco) robberEco = new Eco({ userId: user.id });

      const lastRobAt = robberEco.lastRob ? new Date(robberEco.lastRob).getTime() : null;
      if (lastRobAt && now - lastRobAt < cooldownTime) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription(`You need to wait **${formatCooldown(cooldownTime - (now - lastRobAt))}** before robbing again.`)
          ]
        });
      }

      let targetEco = await Eco.findOne({ userId: targetUser.id });
      if (!targetEco) targetEco = new Eco({ userId: targetUser.id });

      const targetCash = Number(targetEco.cash) || 0;
      if (targetCash < 100) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription(`${targetUser} does not have enough cash to rob.`)
          ]
        });
      }

      const success = Math.random() < 0.45;
      robberEco.lastRob = new Date(now);

      if (success) {
        const maxSteal = Math.min(500, Math.max(25, Math.floor(targetCash * 0.45)));
        const amount = randomInt(25, maxSteal);

        targetEco.cash -= amount;
        robberEco.cash += amount;

        await targetEco.save();
        await robberEco.save();

        const embed = new EmbedBuilder()
          .setTitle('Robbery Successful')
          .setColor(embedColor)
          .setDescription(`You robbed **$${amount.toLocaleString()}** from ${targetUser}.`)
          .setFooter({ text: `Your Cash: $${robberEco.cash.toLocaleString()}` });

        return interaction.editReply({ embeds: [embed] });
      }

      const fine = Math.min(Number(robberEco.cash) || 0, randomInt(50, 250));
      robberEco.cash -= fine;
      targetEco.cash += fine;

      await targetEco.save();
      await robberEco.save();

      const embed = new EmbedBuilder()
        .setTitle('Robbery Failed')
        .setColor(embedColor)
        .setDescription(fine > 0
          ? `You got caught trying to rob ${targetUser} and paid **$${fine.toLocaleString()}**.`
          : `You got caught trying to rob ${targetUser}, but you had no cash to lose.`)
        .setFooter({ text: `Your Cash: $${robberEco.cash.toLocaleString()}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in rob command:', error);
      return interaction.editReply({ content: '❌ Error processing rob command.' }).catch(() => {});
    }
  }
};
