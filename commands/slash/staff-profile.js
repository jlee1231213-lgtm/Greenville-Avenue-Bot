const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Settings = require('../../models/settings');
const SessionLog = require('../../models/sessionlog');
const ModLog = require('../../models/modlogs');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

function getSessionTypes(historyType) {
  if (historyType === 'hosted') return ['session'];
  if (historyType === 'cohost') return ['cohost'];
  return ['session', 'cohost'];
}

async function clearSessionHistory(guildId, userId, historyType, amount) {
  const sessionTypes = getSessionTypes(historyType);
  const filter = { guildId, userId, sessiontype: { $in: sessionTypes } };

  if (!amount) {
    const result = await SessionLog.deleteMany(filter);
    return result.deletedCount || 0;
  }

  const records = await SessionLog.find(filter)
    .sort({ timestarted: 1 })
    .limit(amount)
    .select('_id');

  if (!records.length) return 0;

  const result = await SessionLog.deleteMany({ _id: { $in: records.map(record => record._id) } });
  return result.deletedCount || 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-profile')
    .setDescription('Show a staff member\'s profile')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Choose whether to view or clear staff profile history')
        .setRequired(false)
        .addChoices(
          { name: 'View profile', value: 'view' },
          { name: 'Clear history', value: 'clear' },
        )
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Staff member to check')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('history')
        .setDescription('History type to clear')
        .setRequired(false)
        .addChoices(
          { name: 'Hosted sessions', value: 'hosted' },
          { name: 'Co-hosted sessions', value: 'cohost' },
          { name: 'Hosted and co-hosted sessions', value: 'all' },
        )
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of oldest records to clear. Leave blank to clear all selected history.')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const action = interaction.options.getString('action') || 'view';
    const user = interaction.options.getUser('user') || interaction.user;
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ffffff';

    if (action === 'clear') {
      const canClearHistory = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)
        || memberHasAnyConfiguredRole(interaction.member, settings?.adminRoleId);

      if (!canClearHistory) {
        return interaction.editReply({ content: 'You need Administrator permission to clear staff profile history.' });
      }

      const historyType = interaction.options.getString('history') || 'all';
      const amount = interaction.options.getInteger('amount');
      const deletedCount = await clearSessionHistory(interaction.guild.id, user.id, historyType, amount);
      const historyLabel = historyType === 'hosted' ? 'hosted session' : historyType === 'cohost' ? 'co-hosted session' : 'session/co-host';
      const amountLabel = amount ? `oldest ${amount} selected` : 'selected';

      return interaction.editReply({
        content: `Cleared ${deletedCount} ${amountLabel} ${historyLabel} record${deletedCount === 1 ? '' : 's'} for <@${user.id}>.`,
      });
    }

    const sessionCount = await SessionLog.countDocuments({ guildId: interaction.guild.id, userId: user.id, sessiontype: 'session' });
    const cohostCount = await SessionLog.countDocuments({ guildId: interaction.guild.id, userId: user.id, sessiontype: 'cohost' });
    const moderationCount = await ModLog.countDocuments({ guildId: interaction.guild.id, userId: user.id, type: 'moderation' });
    const strikeCount = await ModLog.countDocuments({ guildId: interaction.guild.id, targetId: user.id, type: 'staff-strike' });

    const embed = new EmbedBuilder()
      .setTitle(`Staff Profile - ${user.tag}`)
      .setDescription(`**User:** <@${user.id}>\n**UserID**: ${user.id}\n\n**Sessions Hosted:** ${sessionCount}\n**Sessions Co-Hosted:** ${cohostCount}`)
      .setColor(embedColor)
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL() || undefined });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staffprofile_sessions_${user.id}`)
        .setLabel('Hosted Session(s)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`staffprofile_cohost_${user.id}`)
        .setLabel('Co-Hosted Session(s)')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }
};
