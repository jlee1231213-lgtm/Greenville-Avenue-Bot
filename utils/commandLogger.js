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

module.exports = {
  sendCommandLog,
};