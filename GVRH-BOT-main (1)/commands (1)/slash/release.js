const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require("discord.js");
const StartupSession = require('../../models/startupsession');
const Settings = require('../../models/settings');
const { memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');

const DEFAULT_RELEASE_TEMPLATE = {
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
    .setName("release")
    .setDescription("Release a session")
    .addStringOption(option =>
      option.setName("link")
        .setDescription("Private server link")
        .setRequired(true))
    .addStringOption(option =>
      option.setName("peacetime")
        .setDescription("Peacetime status")
        .setRequired(true)
        .addChoices(
          { name: 'Strict', value: 'Strict' },
          { name: 'On', value: 'On' },
          { name: 'Off', value: 'Off' }
        ))
    .addStringOption(option =>
      option.setName("frplimit")
        .setDescription("FRP speed limit")
        .setRequired(true)
        .addChoices(
          { name: '65MPH', value: '65MPH' },
          { name: '75MPH', value: '75MPH' },
          { name: '85MPH', value: '85MPH' }
        ))
    .addStringOption(option =>
      option.setName("leo")
        .setDescription("LEO status")
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'Online' },
          { name: 'Offline', value: 'Offline' }
        )),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#155fa0';
    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings?.staffRoleId)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Data not found')
            .setDescription(`You do not have the required role to use this command or data is not configured. Please use \`/settings\` to configure the Embed.`)
            .setColor(embedColor)
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });


    const sessionLink = interaction.options.getString('link');
    const ptStatus = interaction.options.getString('peacetime');
    const frpLimit = interaction.options.getString('frplimit');
    const leoStatus = interaction.options.getString('leo');

    const releaseTemplate = {
      ...DEFAULT_RELEASE_TEMPLATE,
      ...(settings?.releaseEmbed || {}),
    };
    const embed = new EmbedBuilder()
      .setTitle(releaseTemplate.title)
      .setDescription(
        releaseTemplate.description
          .replace(/\$user/g, `<@${interaction.user.id}>`)
          .replace(/\$pt/g, ptStatus)
          .replace(/\$frplimit/g, frpLimit)
          .replace(/\$leo/g, leoStatus)
      )
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    if (releaseTemplate.image?.startsWith('http')) embed.setImage(releaseTemplate.image);
    if (releaseTemplate.thumbnail?.startsWith('http')) embed.setThumbnail(releaseTemplate.thumbnail);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("getlink")
        .setLabel('Link')
        .setStyle(ButtonStyle.Primary)
    );

    const message = await interaction.channel.send({
      content: "@everyone",
      embeds: [embed],
      components: [row]
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`Session has been released successfully.`)
          .setColor(embedColor)
      ]
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 3600000
    });

    collector.on('collect', async (i) => {
      if (i.customId !== 'getlink') return;

      await i.deferReply({ ephemeral: true });

      const session = await StartupSession.findOne({ guildId: i.guild.id }).sort({ createdAt: -1 });
      if (!session) {
        return i.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('Data not found')
            .setDescription('No startup session found. Ask a host to initiate one.')
            .setColor(embedColor)]
        });
      }

      const startupChannel = await interaction.client.channels.fetch(session.channelId);
      const startupMsg = await startupChannel.messages.fetch(session.messageId).catch(() => null);
      if (!startupMsg) {
        return i.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('Data not found')
            .setDescription('Startup message no longer exists.')
            .setColor(embedColor)]
        });
      }

      const reaction = startupMsg.reactions.cache.get('✅');
      const users = reaction ? await reaction.users.fetch() : null;
      if (!reaction || !users.has(i.user.id)) {
        return i.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('Reaction Required')
            .setDescription(`You must react to the [startup message](https://discord.com/channels/${i.guild.id}/${startupChannel.id}/${startupMsg.id}) to unlock the link.`)
            .setColor(embedColor)]
        });
      }

      await i.editReply({ content: `Session Link: ${sessionLink}`, embeds: [] });
    });
  }
};
