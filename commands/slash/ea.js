const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ComponentType, ButtonStyle } = require('discord.js');
const StartupSession = require('../../models/startupsession');
const Settings = require('../../models/settings');
const { getConfiguredRoleIds, memberHasAnyConfiguredRole } = require('../../utils/roleHelpers');
const { DEFAULT_EA_EMBED } = require('../../utils/defaultEmbeds');
const STARTUP_REACTION_ID = '1493951094605353062';

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

    if (!settings) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Data not found')
            .setDescription('Data was not found, please use `/settings` to configure the Embed.')
            .setColor(embedColor)
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
        ],
        ephemeral: true
      });
    }

    if (!bypassPerms && !memberHasAnyConfiguredRole(interaction.member, settings.eaRoleId, settings.staffRoleId, settings.adminRoleId, settings.leoRoleId)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription('You do not have the required role to access the link.')
            .setColor(embedColor)
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

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

    if ((eaTemplate.image || DEFAULT_EA_EMBED.image)?.startsWith('http')) embed.setImage(eaTemplate.image || DEFAULT_EA_EMBED.image);
    if (eaTemplate.thumbnail?.startsWith('http')) embed.setThumbnail(eaTemplate.thumbnail);

    const button = new ButtonBuilder().setCustomId('get_ealink').setLabel('Get Link').setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(button);

    const earlyAccessMessage = await interaction.channel.send({ content: '@here', embeds: [embed], components: [row] });
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
      if (!memberHasAnyConfiguredRole(i.member, settings.eaRoleId, settings.staffRoleId, settings.adminRoleId, settings.leoRoleId)) {
        return i.reply({
          embeds: [new EmbedBuilder().setDescription('You do not have the required role.').setColor(embedColor)],
          ephemeral: true
        });
      }

      const startup = await StartupSession.findOne({ guildId: i.guild.id }).sort({ createdAt: -1 });
      if (!startup) {
        return i.reply({
          embeds: [new EmbedBuilder().setDescription('Startup message not found. Please ask a host to initiate one.').setColor(embedColor)],
          ephemeral: true
        });
      }

      const startupChannel = await interaction.client.channels.fetch(startup.channelId);
      const startupMsg = await startupChannel.messages.fetch(startup.messageId).catch(() => null);
      if (!startupMsg) {
        return i.reply({
          embeds: [new EmbedBuilder().setDescription('Startup message no longer exists.').setColor(embedColor)],
          ephemeral: true
        });
      }

      const reaction = startupMsg.reactions.cache.find(entry => entry.emoji.id === STARTUP_REACTION_ID);
      if (!reaction || !(await reaction.users.fetch()).has(i.user.id)) {
        return i.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Reaction Required')
              .setDescription(`You must react to the [startup message](https://discord.com/channels/${i.guild.id}/${startup.channelId}/${startup.messageId}) to get access.`)
              .setColor(embedColor)
          ],
          ephemeral: true
        });
      }

      await i.reply({
        embeds: [new EmbedBuilder().setDescription(`Session Link: ${sessionLink}`).setColor(embedColor)],
        ephemeral: true
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
        });
      }
    });
  }
};
