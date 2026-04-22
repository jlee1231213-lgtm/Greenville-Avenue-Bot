const { EmbedBuilder } = require('discord.js');

async function sendCommandLog({ interaction, settings, title, description, fields = [] }) {
  const logChannelId = settings?.logChannelId;
  if (!logChannelId) {
    return false;
  }

  let logChannel;
  try {
    logChannel = await interaction.client.channels.fetch(logChannelId);
  } catch {
    return false;
  }

  if (!logChannel?.isTextBased()) {
    return false;
  }

  const embedColor = settings?.embedcolor || '#ab6cc4';
  const embed = new EmbedBuilder()
    .setTitle(title || `/${interaction.commandName} command executed`)
    .setDescription(description || `${interaction.user.tag} used /${interaction.commandName}`)
    .addFields(
      { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
      ...fields
    )
    .setColor(embedColor)
    .setTimestamp();

  try {
    await logChannel.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

function formatQuotaMentions(participants, { passed, max = 20 }) {
  const filtered = participants
    .filter(entry => entry.passed === passed)
    .sort((a, b) => b.count - a.count);

  if (filtered.length === 0) {
    return 'None';
  }

  const visible = filtered.slice(0, max).map(entry => `<@${entry.userId}> (${entry.count})`);
  const remaining = filtered.length - visible.length;
  return remaining > 0 ? `${visible.join(', ')} (+${remaining} more)` : visible.join(', ');
}

async function sendQuotaStatusLog({
  interaction,
  settings,
  title,
  quotaName,
  periodLabel,
  target,
  participants,
}) {
  const logChannelId = settings?.logChannelId;
  if (!logChannelId) {
    return false;
  }

  let logChannel;
  try {
    logChannel = await interaction.client.channels.fetch(logChannelId);
  } catch {
    return false;
  }

  if (!logChannel?.isTextBased()) {
    return false;
  }

  const passedCount = participants.filter(entry => entry.passed).length;
  const failedCount = participants.length - passedCount;
  const topPerformer = participants
    .slice()
    .sort((a, b) => b.count - a.count)[0];

  const embedColor = settings?.embedcolor || '#ab6cc4';
  const embed = new EmbedBuilder()
    .setTitle(title || 'Quota Status Update')
    .setDescription(`${quotaName} results for ${periodLabel}`)
    .addFields(
      { name: 'Target', value: String(target), inline: true },
      { name: 'Members Evaluated', value: String(participants.length), inline: true },
      { name: 'Passed', value: String(passedCount), inline: true },
      { name: 'Failed', value: String(failedCount), inline: true },
      { name: 'Top Performer', value: topPerformer ? `<@${topPerformer.userId}> (${topPerformer.count})` : 'None', inline: true },
      { name: 'Passed Members', value: formatQuotaMentions(participants, { passed: true }) },
      { name: 'Failed Members', value: formatQuotaMentions(participants, { passed: false }) },
    )
    .setColor(embedColor)
    .setTimestamp();

  try {
    await logChannel.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  sendCommandLog,
  sendQuotaStatusLog,
};