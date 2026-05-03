const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Eco = require('../../models/eco');
const Settings = require('../../models/settings');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

const COLLECT_COOLDOWN = 24 * 60 * 60 * 1000;

const PAY_TIERS = [
  { label: 'Ownership', amount: 1000000, roleNames: ['ownership', 'owner'] },
  { label: 'High Command', amount: 7000, roleNames: ['high command', 'high-command', 'highcommand'] },
  { label: 'Middle Command', amount: 3000, roleNames: ['middle command', 'middle-command', 'middlecommand'] },
  { label: 'Low Command', amount: 1000, roleNames: ['low command', 'low-command', 'lowcommand'] },
];

function normalizeRoleName(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatCooldown(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function getCollectPayouts(member, settings) {
  const memberRoleNames = new Set(
    member.roles.cache.map(role => normalizeRoleName(role.name))
  );
  const payouts = [];

  for (const tier of PAY_TIERS) {
    if (tier.roleNames.some(roleName => memberRoleNames.has(roleName))) {
      payouts.push(tier);
    }
  }

  if (memberHasAnyConfiguredRole(member, settings?.civiRoleId) || memberRoleNames.has('civilian')) {
    payouts.push({ label: 'Civilian', amount: 500 });
  }

  return payouts;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collect')
    .setDescription('Collect your daily role payout.'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const { guild, member, user } = interaction;
      const settings = await Settings.findOne({ guildId: guild.id });
      const embedColor = settings?.embedcolor || '#ff9933';
      const payouts = getCollectPayouts(member, settings);

      if (payouts.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription('You need a Civilian, Low Command, Middle Command, High Command, or Ownership role to collect money.')
          ]
        });
      }

      const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);
      const payoutLines = payouts
        .map(payout => `${payout.label}: **$${payout.amount.toLocaleString()}**`)
        .join('\n');

      let userEco = await Eco.findOne({ userId: user.id });
      if (!userEco) userEco = new Eco({ userId: user.id });

      const now = Date.now();
      const lastDailyAt = userEco.lastDaily ? new Date(userEco.lastDaily).getTime() : null;

      if (lastDailyAt && now - lastDailyAt < COLLECT_COOLDOWN) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription(`You need to wait **${formatCooldown(COLLECT_COOLDOWN - (now - lastDailyAt))}** before collecting again.`)
          ]
        });
      }

      userEco.cash += totalAmount;
      userEco.lastDaily = new Date(now);
      await userEco.save();

      const embed = new EmbedBuilder()
        .setTitle('Money Collected')
        .setColor(embedColor)
        .setDescription(`You collected **$${totalAmount.toLocaleString()}** total.\n\n${payoutLines}`)
        .setFooter({ text: `Total Cash: $${userEco.cash.toLocaleString()}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in collect command:', error);
      return interaction.editReply({ content: '❌ Error processing collect command.' }).catch(() => {});
    }
  }
};
