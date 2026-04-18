const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require("discord.js");
const StartupSession = require('../../models/startupsession');
const Settings = require('../../models/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reinvites")
    .setDescription("Post reinvites for a session")
    .addStringOption(option =>
      option.setName("link")
        .setDescription("The private server link")
        .setRequired(true)
    ),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#7545B0';
    const staffRoleId = settings?.staffRoleId;
    const reinvitesTemplate = settings?.reinvitesEmbed || {};

    if (!bypassPerms && (!staffRoleId || !interaction.member.roles.cache.has(staffRoleId))) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Data not found')
            .setDescription('You do not have permission to use this command or data is not configured. Please use `/settings` to configure the Embed.')
            .setColor(embedColor)
        ],
        ephemeral: true
      });
    }

    if (!interaction.client.reinviteCounters) interaction.client.reinviteCounters = new Map();
    const channelId = interaction.channelId;
    const currentCount = (interaction.client.reinviteCounters.get(channelId) || 0) + 1;
    interaction.client.reinviteCounters.set(channelId, currentCount);

    const sessionLink = interaction.options.getString('link');
    const userToPing = interaction.user.id;

    const embed = new EmbedBuilder()
      .setTitle(reinvitesTemplate.title || 'Data not found')
      .setDescription(reinvitesTemplate.description?.replace(/\$user/g, `<@${userToPing}>`) || 'Reinvites embed data was not found. Please use `/settings` to configure the data.')
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    if (reinvitesTemplate.image?.startsWith('http')) embed.setImage(reinvitesTemplate.image);
    if (reinvitesTemplate.thumbnail?.startsWith('http')) embed.setThumbnail(reinvitesTemplate.thumbnail);

    const button = new ButtonBuilder()
      .setCustomId('reinvites_link')
      .setLabel('Get Session Link')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const reinviteMessage = await interaction.channel.send({ content: '@here', embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Reinvites sent successfully.', ephemeral: true });

    const collector = reinviteMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3600000 });

    collector.on('collect', async btnInteraction => {
      if (btnInteraction.customId !== 'reinvites_link') return;

      try {
        const lastSession = await StartupSession.findOne({ guildId: btnInteraction.guildId }).sort({ createdAt: -1 });
        if (!lastSession) return btnInteraction.reply({ content: 'Startup session not found. Please ask a host to initiate one.', ephemeral: true });

        const channel = await interaction.client.channels.fetch(lastSession.channelId);
        const message = await channel.messages.fetch(lastSession.messageId).catch(() => null);
        if (!message) return btnInteraction.reply({ content: 'Startup message no longer exists.', ephemeral: true });

        const reacted = await message.reactions.cache.get('✅')?.users.fetch();
        if (reacted && reacted.has(btnInteraction.user.id)) {
          if (!btnInteraction.replied) await btnInteraction.reply({ content: `Session Link: ${sessionLink}`, ephemeral: true });
        } else {
          if (!btnInteraction.replied) {
            await btnInteraction.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('Reaction Required')
                  .setDescription(`You must react to the [startup message](https://discord.com/channels/${btnInteraction.guildId}/${channel.id}/${message.id}) to receive the session link.`)
                  .setColor(embedColor)
              ],
              ephemeral: true
            });
          }
        }
      } catch {
        if (!btnInteraction.replied) await btnInteraction.reply({ content: 'An error occurred verifying your access.', ephemeral: true });
      }
    });

    let logChannel;
    try { logChannel = await interaction.client.channels.fetch(settings?.logChannelId || '1419318345731411968'); } catch { logChannel = null; }

    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('Reinvites Initiated')
        .setDescription(`Reinvites round ${currentCount} started by ${interaction.user.tag}`)
        .addFields(
          { name: 'Host', value: `<@${userToPing}>`, inline: true },
          { name: 'Channel', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: true },
          { name: 'Message Link', value: `[Jump to Message](${reinviteMessage.url})`, inline: true },
          { name: 'Reinvite Count', value: `Round ${currentCount}`, inline: true }
        )
        .setColor(embedColor)
        .setTimestamp();

      logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
  }
};
