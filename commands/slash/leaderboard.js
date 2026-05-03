const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Eco = require('../../models/eco');
const Settings = require('../../models/settings');

async function getDisplayName(client, userId) {
  try {
    const user = await client.users.fetch(userId);
    return user ? `<@${user.id}>` : `Unknown User (${userId})`;
  } catch {
    return `Unknown User (${userId})`;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the richest users by total money.'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const settings = await Settings.findOne({ guildId: interaction.guild.id });
      const embedColor = settings?.embedcolor || '#FFD700';

      const leaders = await Eco.aggregate([
        {
          $project: {
            userId: 1,
            cash: { $ifNull: ['$cash', 0] },
            bank: { $ifNull: ['$bank', 0] },
            total: {
              $add: [
                { $ifNull: ['$cash', 0] },
                { $ifNull: ['$bank', 0] }
              ]
            }
          }
        },
        { $match: { total: { $gt: 0 } } },
        { $sort: { total: -1 } },
        { $limit: 10 }
      ]);

      if (leaders.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setDescription('No economy balances found yet.')
          ]
        });
      }

      const lines = await Promise.all(leaders.map(async (entry, index) => {
        const displayName = await getDisplayName(interaction.client, entry.userId);
        return `**${index + 1}.** ${displayName} - **$${entry.total.toLocaleString()}**`;
      }));

      const embed = new EmbedBuilder()
        .setTitle('Money Leaderboard')
        .setColor(embedColor)
        .setDescription(lines.join('\n'));

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      return interaction.editReply({ content: '❌ Error retrieving leaderboard.' }).catch(() => {});
    }
  }
};
