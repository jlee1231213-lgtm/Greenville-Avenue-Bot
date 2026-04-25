const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

function buildQuotaEmbed(guild, embedColor) {
  return new EmbedBuilder()
    .setTitle('Staff Quota Entry')
    .setDescription(`<:green_arrow_recolor:1489356754570580069> Partnership Entry
- Staff:
- Server Partnered With:
- Partnership Type:
- Mutual Ping (Yes / No):
- Proof:
- Points Earned: +0.5
- New Total:

<:green_arrow_recolor:1489356754570580069> Session Host Entry
- Host:
- Session Start:
- Session End:
- Summary / Notes:
- Proof:
- Points Earned: +2
- New Total:

<:green_arrow_recolor:1489356754570580069> Session Attempt Entry
- Staff:
- Attempt Start:
- Attempt End:
- Reason (No players, issues, etc):
- Proof (if applicable):
- Points Earned: +1
- New Total:

<:green_arrow_recolor:1489356754570580069> Co-Host Entry
- Co-Host:
- Main Host:
- Proof:
- Points Earned: +1.5
- New Total:`)
    .addFields({
      name: 'Team Reminder',
      value: '__Please ensure you log all quota activities immediately after completion, including partnerships, hosted sessions, co-hosts, attempts, and any other eligible contributions. Accurate and timely logging is required so records stay up to date and points are counted correctly. Weekly quota is due every Sunday, so please make sure all entries are submitted before the deadline. Thank you.__',
    })
    .setColor(embedColor)
    .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quotaembed')
    .setDescription('Post the staff quota entry template.'),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ab6cc4';

    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings?.staffRoleId, settings?.adminRoleId)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const embed = buildQuotaEmbed(interaction.guild, embedColor);
    await interaction.reply({ embeds: [embed] });
  },
};
