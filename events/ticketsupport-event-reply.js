const { 
  Events,
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionsBitField,
  ChannelType
} = require('discord.js');
const discordTranscripts = require('@fluxbot/discord-html-transcripts');
const Ticket = require('../models/support');
const Settings = require('../models/settings');
const { getConfiguredRoleIds } = require('../utils/roleHelpers');

const TICKET_CATEGORY_ID = '1463252878666760316';
const TRANSCRIPT_CHANNEL_ID = '1495629716395266129';

const TICKET_TYPE_META = {
  st: {
    label: 'General Assistance',
  },
  mr: {
    label: 'Member Report',
  },
  ma: {
    label: 'Staff Report',
  }
};

function getTicketSupportRoleIds(guild, settings, type) {
  const configuredRoleIds = [
    ...new Set(getConfiguredRoleIds(settings?.staffRoleId, settings?.adminRoleId))
  ].filter(roleId => guild.roles.cache.has(roleId));

  if (configuredRoleIds.length > 0) {
    return configuredRoleIds;
  }

  const legacyFallbackRoleId = type === 'st' ? '1417661969863020583' : '1417663103369478325';
  return guild.roles.cache.has(legacyFallbackRoleId) ? [legacyFallbackRoleId] : [];
}

async function getOrCreateTicketData(interaction) {
  let ticketData = await Ticket.findOne({ channelId: interaction.channel.id });
  if (ticketData) return ticketData;

  // Legacy fallback: recover ticket data from old ticket channel names like st_123_ticket.
  const channelName = interaction.channel?.name || '';
  const match = channelName.match(/^(st|mr|ma)_(\d+)_ticket$/);
  if (!match) return null;

  const type = match[1];
  const ownerId = match[2];
  ticketData = await Ticket.create({
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    ownerId,
    roleId: ownerId,
    type,
    lastOwnerMessageAt: new Date(),
    inactivityWarningSentAt: null,
  });

  return ticketData;
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.guild) return;

    const isSupportSelect = interaction.isStringSelectMenu() && interaction.customId === 'supportOptions';
    const isSupportModal = interaction.isModalSubmit() && interaction.customId.startsWith('ticketModal_');
    const isSupportButton = interaction.isButton() && ['claimTicket', 'unclaimTicket', 'closeTicket', 'confirmClose', 'cancelCloseRequest'].includes(interaction.customId);
    if (!isSupportSelect && !isSupportModal && !isSupportButton) return;

    const settings = interaction.guild ? await Settings.findOne({ guildId: interaction.guild.id }).catch(() => null) : null;
    const embedColor = settings?.embedcolor || '#ff7f25';

    if (interaction.isStringSelectMenu() && interaction.customId === 'supportOptions') {
      const type = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`ticketModal_${type}`)
        .setTitle('Ticket Information');

      if (type === 'st') modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('helpNeeded')
          .setLabel('What help is needed?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ));

      if (type === 'mr') modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('userReport')
            .setLabel('Username/ID of reported member')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('What did they do?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('proof')
            .setLabel('Proof (link/image)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      if (type === 'ma') modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('What happened?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ));

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticketModal_')) {
      try {
        await interaction.deferReply({ ephemeral: true });

        const type = interaction.customId.split('_')[1];
        const ownerId = interaction.user.id;
        const guild = interaction.guild;
        const ticketName = `${type}_${ownerId}_ticket`;
        const everyone = guild.roles.everyone;
        const supportRoleIds = getTicketSupportRoleIds(guild, settings, type);

        const permissionOverwrites = [
          { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: ownerId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ];

        for (const roleId of supportRoleIds) {
          permissionOverwrites.push({
            id: roleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          });
        }

        const ticketChannel = await guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: guild.channels.cache.has(TICKET_CATEGORY_ID) ? TICKET_CATEGORY_ID : undefined,
          permissionOverwrites
        });

      const typeMeta = TICKET_TYPE_META[type] || {
        label: 'Support Ticket',
      };
      let description = '';
      if (type === 'st') description = [
        '**Thank you for opening a ticket within *Greenville Avenue*. Please wait for the staff team to reply.**',
        '',
        `**Selected Option:** ${typeMeta.label}`,
        '',
        `<@${ownerId}>`,
        '',
        `**Your Message:** ${interaction.fields.getTextInputValue('helpNeeded')}`
      ].join('\n');
      if (type === 'mr') description = [
        '**Thank you for opening a Member Report within *Greenville Avenue*.**',
        '',
        `**Selected Option:** ${typeMeta.label}`,
        '',
        '**Submitted Details**',
        `- Reported Username/ID: ${interaction.fields.getTextInputValue('userReport')}`,
        `- What happened: ${interaction.fields.getTextInputValue('reason')}`,
        `- Proof: ${interaction.fields.getTextInputValue('proof') || 'No proof provided'}`
      ].join('\n');
      if (type === 'ma') description = [
        '**Thank you for opening a Staff Report within *Greenville Avenue*.**',
        '',
        `**Selected Option:** ${typeMeta.label}`,
        '',
        '**Submitted Details**',
        `- Your Username/ID: ${interaction.user.tag}`,
        `- What happened: ${interaction.fields.getTextInputValue('reason')}`
      ].join('\n');

      const embed = new EmbedBuilder().setColor(embedColor).setDescription(description);
      const claimBtn = new ButtonBuilder().setCustomId('claimTicket').setLabel('Claim').setStyle(ButtonStyle.Success);
      const closeBtn = new ButtonBuilder().setCustomId('closeTicket').setLabel('Close').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(claimBtn, closeBtn);
      const supportRoleMentions = supportRoleIds.map(roleId => `<@&${roleId}>`).join(' ');

      const msg = await ticketChannel.send({
        content: [ `<@${ownerId}>`, supportRoleMentions ].filter(Boolean).join(' '),
        embeds: [embed],
        components: [row]
      });
      await msg.pin();

      await Ticket.create({
        guildId: guild.id,
        channelId: ticketChannel.id,
        ownerId,
        roleId: supportRoleIds.join(','),
        type,
        lastOwnerMessageAt: new Date(),
        inactivityWarningSentAt: null,
      });

      const logChannel = guild.channels.cache.get('1417296613839339621');
      if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription(`<@${ownerId}> opened a ${typeMeta.label} ticket in <#${ticketChannel.id}>.`)] });

      await interaction.editReply({ content: 'Ticket opened!' });
      return;
    } catch (error) {
      console.error('Error handling ticket modal submit:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Something went wrong while opening your ticket. Please try again.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ Something went wrong while opening your ticket. Please try again.', ephemeral: true }).catch(() => {});
      }
      return;
    }
  }

    if (interaction.isButton()) {
      const ticketData = await getOrCreateTicketData(interaction);
      if (!ticketData) {
        await interaction.reply({
          content: 'Ticket data was not found for this channel, so this action cannot run. If needed, create a new ticket.',
          ephemeral: true,
        }).catch(() => {});
        return;
      }
      const logChannel = interaction.guild.channels.cache.get('1417296613839339621');
      const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

      if (interaction.customId === 'claimTicket') {

        ticketData.claimed = interaction.user.id;
        await ticketData.save();

        await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder().setCustomId('unclaimTicket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('closeTicket').setLabel('Close').setStyle(ButtonStyle.Danger)
          );

        const msg = await interaction.channel.messages.fetch({ limit: 10 }).then(ms => ms.find(m => m.embeds.length));
        if (msg) msg.edit({ components: [row] });

        await interaction.reply({ content: `<@${interaction.user.id}> claimed the ticket.`, ephemeral: false });
        if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription(`<@${interaction.user.id}> claimed ticket <#${interaction.channel.id}>.`)] });
        return;
      }

      if (interaction.customId === 'unclaimTicket') {
        if (ticketData.claimed !== interaction.user.id) return interaction.reply({ content: 'You did not claim this ticket.', ephemeral: true });

        ticketData.claimed = null;
        await ticketData.save();

        await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder().setCustomId('claimTicket').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('closeTicket').setLabel('Close').setStyle(ButtonStyle.Danger)
          );

        const msg = await interaction.channel.messages.fetch({ limit: 10 }).then(ms => ms.find(m => m.embeds.length));
        if (msg) msg.edit({ components: [row] });

        await interaction.reply({ content: `<@${interaction.user.id}> unclaimed the ticket.`, ephemeral: false });
        if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription(`<@${interaction.user.id}> unclaimed ticket <#${interaction.channel.id}>.`)] });
        return;
      }

      if (interaction.customId === 'closeTicket') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirmClose').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('cancelCloseRequest').setLabel('Cancel Request').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: `<@${ticketData.ownerId}> ticket close requested by <@${interaction.user.id}>.`,
          embeds: [
            new EmbedBuilder()
              .setColor(embedColor)
              .setTitle('Ticket Close Request')
              .setDescription('Please confirm if this ticket should be closed.')
          ],
          components: [row],
          allowedMentions: { users: [ticketData.ownerId, interaction.user.id] }
        });
        return;
      }

      if (interaction.customId === 'cancelCloseRequest') {
        const canCancel = interaction.user.id === ticketData.ownerId
          || interaction.user.id === ticketData.claimed
          || interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

        if (!canCancel) {
          await interaction.reply({ content: 'Only the ticket owner or staff can cancel this close request.', ephemeral: true });
          return;
        }

        await interaction.update({ content: 'Ticket close request canceled.', embeds: [], components: [] });
        return;
      }

      if (interaction.customId === 'confirmClose') {
        const canConfirm = interaction.user.id === ticketData.ownerId
          || interaction.user.id === ticketData.claimed
          || interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

        if (!canConfirm) {
          await interaction.reply({ content: 'Only the ticket owner or staff can confirm closure.', ephemeral: true });
          return;
        }

        const transcript = await discordTranscripts.createTranscript(interaction.channel);
        const closedAt = new Date();

        const finalEmbed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('Ticket Closed')
          .setDescription('We hope we were able to help you.')
          .addFields(
            { name: 'Owner', value: `<@${ticketData.ownerId}>`, inline: true },
            { name: 'Closed by', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Opened at', value: `<t:${Math.floor(ticketData.createdAt.getTime()/1000)}:F>`, inline: true },
            { name: 'Closed at', value: `<t:${Math.floor(closedAt.getTime()/1000)}:F>`, inline: true }
          );

        const ownerMember = await interaction.guild.members.fetch(ticketData.ownerId).catch(() => null);
        if (ownerMember) ownerMember.send({ embeds: [finalEmbed], files: [transcript] }).catch(() => null);

        if (transcriptChannel) {
          transcriptChannel.send({ embeds: [finalEmbed], files: [transcript] }).catch(() => null);
        } else if (logChannel) {
          logChannel.send({ embeds: [finalEmbed], files: [transcript] }).catch(() => null);
        }

        await Ticket.deleteOne({ channelId: interaction.channel.id });
        await interaction.update({ content: 'Closing ticket in 5 seconds...', embeds: [], components: [] });
        setTimeout(async () => {
          const channelToDelete = await interaction.guild.channels.fetch(ticketData.channelId).catch(() => null);
          if (channelToDelete?.deletable) {
            await channelToDelete.delete('Ticket closed after confirmation').catch(() => {});
          }
        }, 5000);
      }
    }
  }
};
