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

function getCollectTier(member, settings) {
  const memberRoleNames = new Set(
    member.roles.cache.map(role => normalizeRoleName(role.name))
  );

  for (const tier of PAY_TIERS) {
    if (tier.roleNames.some(roleName => memberRoleNames.has(roleName))) {
      return tier;
    }
  }

  if (memberHasAnyConfiguredRole(member, settings?.civiRoleId) || memberRoleNames.has('civilian')) {
    return { label: 'Civilian', amount: 500 };
  }

  return null;
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
      const tier = getCollectTier(member, settings);

      if (!tier) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription('You need a Civilian, Low Command, Middle Command, High Command, or Ownership role to collect money.')
          ]
        });
      }

      let userEco = await Eco.findOne({ userId: user.id });
      if (!userEco) userEco = new Eco({ userId: user.id });

      const now = Date.now();
      const lastCollectAt = userEco.lastCollect ? new Date(userEco.lastCollect).getTime() : null;

      if (lastCollectAt && now - lastCollectAt < COLLECT_COOLDOWN) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription(`You need to wait **${formatCooldown(COLLECT_COOLDOWN - (now - lastCollectAt))}** before collecting again.`)
          ]
        });
      }

      userEco.cash += tier.amount;
      userEco.lastCollect = new Date(now);
      await userEco.save();

      const embed = new EmbedBuilder()
        .setTitle('Money Collected')
        .setColor(embedColor)
        .setDescription(`You collected **$${tier.amount.toLocaleString()}** for **${tier.label}**.`)
        .setFooter({ text: `Total Cash: $${userEco.cash.toLocaleString()}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in collect command:', error);
      return interaction.editReply({ content: '❌ Error processing collect command.' }).catch(() => {});
    }
  }
};
