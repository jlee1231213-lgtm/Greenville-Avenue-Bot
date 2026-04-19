const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require("discord.js");
const StartupSession = require('../../models/startupsession');
const Settings = require('../../models/settings');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

const DEFAULT_REINVITES_TEMPLATE = {
  title: '<:gvi_confetti:1493952437642461254> **__Greenville Avenue — Session Re-Invites__**',
  description: `<:green_arrow_recolor:1489356754570580069> Re-invitations for this roleplay session have now been issued by the session host. Individuals who were previously unable to join or were placed on hold may now re-enter the session.

Session Details:

- Host: $user
- FRP Speed Limit: $frplimit
- Peacetime Status: $pt
- Law Enforcement Availability: $leo

<:bell_tts:1489640619318968531> Please note: Any participant who was previously removed from the session is not permitted to rejoin unless explicitly authorized by the session host.

-# <:green_arrow_recolor:1489356754570580069>  We appreciate your cooperation and look forward to maintaining a structured and immersive roleplay environment.`,
  image: 'https://media.discordapp.net/attachments/1450473391134871565/1489434331242958859/Screenshot_20260402_213906.jpg?ex=69e4d690&is=69e38510&hm=c38a5a38bf5f290d26352d6e24c288aa55f06bf19f9d2a34414d95b0ecf9db51&=&format=webp&width=2160&height=1056',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reinvites")
    .setDescription("Post reinvites for a session")
    .addUserOption(option =>
      option.setName("host")
        .setDescription("The host for this session")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("link")
        .setDescription("The private server link")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("peacetime")
        .setDescription("Peacetime status")
        .setRequired(true)
        .addChoices(
          { name: 'Strict', value: 'Strict' },
          { name: 'On', value: 'On' },
          { name: 'Off', value: 'Off' }
        )
    )
    .addStringOption(option =>
      option.setName("frplimit")
        .setDescription("FRP speed limit")
        .setRequired(true)
        .addChoices(
          { name: '65MPH', value: '65MPH' },
          { name: '75MPH', value: '75MPH' },
          { name: '85MPH', value: '85MPH' }
        )
    )
    .addStringOption(option =>
      option.setName("leo")
        .setDescription("LEO status")
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'Online' },
          { name: 'Offline', value: 'Offline' }
        )
    ),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#7545B0';

    await interaction.deferReply({ ephemeral: true });

    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings?.staffRoleId)) {
      return interaction.editReply({
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

    const hostUser = interaction.options.getUser('host');
    const sessionLink = interaction.options.getString('link');
    const ptStatus = interaction.options.getString('peacetime');
    const frpLimit = interaction.options.getString('frplimit');
    const leoStatus = interaction.options.getString('leo');
    const userToPing = hostUser.id;
    const reinvitesTemplate = DEFAULT_REINVITES_TEMPLATE;

    const embed = new EmbedBuilder()
      .setTitle(reinvitesTemplate.title)
      .setDescription(
        reinvitesTemplate.description
          .replace(/\$user/g, `<@${userToPing}>`)
          .replace(/\$pt/g, ptStatus)
          .replace(/\$frplimit/g, frpLimit)
          .replace(/\$leo/g, leoStatus)
      )
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    if (reinvitesTemplate.image?.startsWith('http')) embed.setImage(reinvitesTemplate.image);
    if (reinvitesTemplate.thumbnail?.startsWith('http')) embed.setThumbnail(reinvitesTemplate.thumbnail);

    const button = new ButtonBuilder()
      .setCustomId('reinvites_link')
      .setLabel('Get Session Link')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    const reinviteMessage = await interaction.channel.send({ content: '@here', embeds: [embed], components: [row] });
    await interaction.deleteReply().catch(() => {});

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
          { name: 'Host', value: `<@${hostUser.id}>`, inline: true },
          { name: 'FRP Speed Limit', value: frpLimit, inline: true },
          { name: 'Peacetime Status', value: ptStatus, inline: true },
          { name: 'Law Enforcement', value: leoStatus, inline: true },
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
