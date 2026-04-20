const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, ButtonStyle, MessageFlags, PermissionsBitField } = require('discord.js');
const StartupSession = require('../../models/startupsession');
const Settings = require('../../models/settings');
const { getConfiguredRoleIds, memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');
const { DEFAULT_EA_EMBED } = require('../../utils/defaultEmbeds');
const STARTUP_REACTION_ID = '1493951094605353062';
const STARTUP_REACTION_FALLBACK = '✅';

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ea")
    .setDescription("Post early access for a session")
    .addStringOption(option =>
      option.setName("link")
        .setDescription("The link to the private server")
        .setRequired(true)
    ),

  async execute(interaction) {
    const bypassPerms = process.env.TESTING_BYPASS_PERMS === 'true';
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ab6cc4';
    const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
    const channelPermissions = botMember ? interaction.channel?.permissionsFor(botMember) : null;

    if (!settings) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Data not found')
            .setDescription('Data was not found, please use `/settings` to configure the Embed.')
            .setColor(embedColor)
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings.eaRoleId, settings.staffRoleId, settings.adminRoleId, settings.leoRoleId)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription('You do not have the required role to access the link.')
            .setColor(embedColor)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (!channelPermissions?.has(PermissionsBitField.Flags.ViewChannel)
      || !channelPermissions.has(PermissionsBitField.Flags.SendMessages)
      || !channelPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Channel Access Required')
            .setDescription('I cannot post Early Access here. Please give me View Channel, Send Messages, and Embed Links in this channel, then try again.')
            .setColor(embedColor)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sessionLink = interaction.options.getString('link');
    const userMention = `<@${interaction.user.id}>`;
    if (settings.eaEmbedVersion !== 1) {
      settings.eaEmbed = DEFAULT_EA_EMBED;
      settings.eaEmbedVersion = 1;
      await settings.save();
    }

    const eaTemplate = settings.eaEmbedVersion === 1 ? settings.eaEmbed : DEFAULT_EA_EMBED;

    const embed = new EmbedBuilder()
      .setTitle((eaTemplate.title || DEFAULT_EA_EMBED.title).replace(/\$user/g, userMention))
      .setDescription((eaTemplate.description || DEFAULT_EA_EMBED.description).replace(/\$user/g, userMention))
      .setColor(embedColor)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    const imageUrl = eaTemplate.image || DEFAULT_EA_EMBED.image;
    const thumbnailUrl = eaTemplate.thumbnail || DEFAULT_EA_EMBED.thumbnail;

    if (typeof imageUrl === 'string' && /^https?:\/\//.test(imageUrl)) {
      embed.setImage(imageUrl);
    }

    if (typeof thumbnailUrl === 'string' && /^https?:\/\//.test(thumbnailUrl)) {
      embed.setThumbnail(thumbnailUrl);
    }

      const button = new ButtonBuilder().setCustomId('get_ealink').setLabel('Get Link').setEmoji({ id: '1489643253681754112', name: 'BlueLine_chain' }).setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(button);

    let earlyAccessMessage;
    try {
      earlyAccessMessage = await interaction.channel.send({ content: '@here', embeds: [embed], components: [row] });
    } catch (error) {
      if (error?.code === 50001 || error?.code === 50013) {
        return interaction.editReply({ content: 'I could not send the Early Access message in this channel. Please check my channel access and permissions.' });
      }
      throw error;
    }
    await interaction.editReply({ content: 'Early access message sent successfully.' });

    let logChannel;
    try { logChannel = await interaction.client.channels.fetch(settings.logChannelId); } catch { logChannel = null; }

    if (logChannel) {
      logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Early Access Command Executed')
            .setDescription(`Early access was initiated by ${interaction.user.tag}`)
            .addFields(
              { name: 'Channel', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: true },
              { name: 'Message Link', value: `[Jump to Message](${earlyAccessMessage.url})`, inline: true },
              { name: 'Link Provided', value: sessionLink }
            )
            .setColor(embedColor)
            .setTimestamp()
        ]
      });
    }

    const collector = earlyAccessMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3600000 });
    collector.on('collect', async i => {
      if (i.customId !== 'get_ealink') return;

      await i.deferReply({ ephemeral: true });

      try {
        if (!memberHasAnyConfiguredRole(i.member, settings.eaRoleId, settings.staffRoleId, settings.adminRoleId, settings.leoRoleId)) {
          return i.editReply({
            embeds: [new EmbedBuilder().setDescription('You do not have the required role.').setColor(embedColor)]
          });
        }

        const startup = await StartupSession.findOne({ guildId: i.guild.id }).sort({ createdAt: -1 });
        if (!startup) {
          return i.editReply({
            embeds: [new EmbedBuilder().setDescription('Startup message not found. Please ask a host to initiate one.').setColor(embedColor)]
          });
        }

        const startupChannel = await interaction.client.channels.fetch(startup.channelId).catch(() => null);
        if (!startupChannel?.isTextBased()) {
          return i.editReply({
            embeds: [new EmbedBuilder().setDescription('Startup channel could not be accessed.').setColor(embedColor)]
          });
        }

        const startupMsg = await startupChannel.messages.fetch(startup.messageId).catch(() => null);
        if (!startupMsg) {
          return i.editReply({
            embeds: [new EmbedBuilder().setDescription('Startup message no longer exists.').setColor(embedColor)]
          });
        }

        const reaction = startupMsg.reactions.cache.find(entry => entry.emoji.id === STARTUP_REACTION_ID || entry.emoji.name === STARTUP_REACTION_FALLBACK);
        const users = reaction ? await reaction.users.fetch().catch(() => null) : null;
        if (!reaction || !users?.has(i.user.id)) {
          return i.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('Reaction Required')
                .setDescription(`You must react to the [startup message](https://discord.com/channels/${i.guild.id}/${startup.channelId}/${startup.messageId}) to get access.`)
                .setColor(embedColor)
            ]
          });
        }

        await i.editReply({
          embeds: [new EmbedBuilder().setDescription(`Session Link: ${sessionLink}`).setColor(embedColor)]
        });

        if (logChannel) {
          logChannel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('Early Access Link Used')
                .setDescription(`<@${i.user.id}> used the EA button in <#${interaction.channel.id}>`)
                .setColor(embedColor)
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
            ]
          }).catch(() => {});
        }
      } catch (err) {
        console.error('EA button interaction failed:', err);
        await i.editReply({
          embeds: [new EmbedBuilder().setDescription('An error occurred while verifying access.').setColor(embedColor)]
        }).catch(() => {});
      }
    });
  }
};
