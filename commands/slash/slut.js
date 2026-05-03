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
    .setName('slut')
    .setDescription('Take a risky job to earn cash.'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const { guild, user } = interaction;
      const settings = await Settings.findOne({ guildId: guild.id });
      const embedColor = settings?.embedcolor || '#ff9933';
      const cooldownTime = 45 * 60 * 1000;
      const now = Date.now();

      let userEco = await Eco.findOne({ userId: user.id });
      if (!userEco) userEco = new Eco({ userId: user.id });

      const lastSlutAt = userEco.lastSlut ? new Date(userEco.lastSlut).getTime() : null;
      if (lastSlutAt && now - lastSlutAt < cooldownTime) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription(`You need to wait **${formatCooldown(cooldownTime - (now - lastSlutAt))}** before using this command again.`)
          ]
        });
      }

      const successScenarios = [
        'You took a risky side job and earned',
        'You found a late-night gig and made',
        'You hustled around town and got paid',
        'You picked up a sketchy errand and received',
        'You worked a quick cash job and earned'
      ];
      const failScenarios = [
        'The job went badly and you lost',
        'You got scammed and lost',
        'The plan fell apart and cost you',
        'You had to pay your way out and lost',
        'The risk did not pay off, costing you'
      ];

      userEco.lastSlut = new Date(now);

      if (Math.random() < 0.65) {
        const amount = randomInt(75, 300);
        const scenario = successScenarios[Math.floor(Math.random() * successScenarios.length)];

        userEco.cash += amount;
        await userEco.save();

        const embed = new EmbedBuilder()
          .setTitle('Risky Job Results')
          .setColor(embedColor)
          .setDescription(`${scenario} **$${amount.toLocaleString()}**.`)
          .setFooter({ text: `Total Cash: $${userEco.cash.toLocaleString()}` });

        return interaction.editReply({ embeds: [embed] });
      }

      const amount = Math.min(Number(userEco.cash) || 0, randomInt(25, 150));
      const scenario = failScenarios[Math.floor(Math.random() * failScenarios.length)];

      userEco.cash -= amount;
      await userEco.save();

      const embed = new EmbedBuilder()
        .setTitle('Risky Job Results')
        .setColor(embedColor)
        .setDescription(amount > 0
          ? `${scenario} **$${amount.toLocaleString()}**.`
          : 'The job went badly, but you had no cash to lose.')
        .setFooter({ text: `Total Cash: $${userEco.cash.toLocaleString()}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in slut command:', error);
      return interaction.editReply({ content: '❌ Error processing slut command.' }).catch(() => {});
    }
  }
};
