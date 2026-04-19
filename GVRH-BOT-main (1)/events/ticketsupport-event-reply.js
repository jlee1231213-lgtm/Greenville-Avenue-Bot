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

const TICKET_TYPE_META = {
  st: {
    label: 'General Assistance',
    formatTitle: 'General Assistance Format',
    formatLines: [
      'Topic: [what this is about]',
      'What you need help with: [details]',
      'Extra context: [screenshots/links if any]'
    ]
  },
  mr: {
    label: 'Member Report',
    formatTitle: 'Member Report Format',
    formatLines: [
      'Reported Username/ID: [user]',
      'What happened: [details]',
      'Proof: [links/images]'
    ]
  },
  ma: {
    label: 'Staff Report',
    formatTitle: 'Staff Report Format',
    formatLines: [
      'Reported Staff Username/ID: [staff member]',
      'What happened: [details]',
      'Proof: [links/images]'
    ]
  }
};

function buildFormatBlock(typeMeta) {
  return [
    `**${typeMeta.formatTitle}**`,
    '```',
    ...typeMeta.formatLines,
    '```'
  ].join('\n');
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
    const isSupportButton = interaction.isButton() && ['claimTicket', 'unclaimTicket', 'closeTicket', 'confirmClose'].includes(interaction.customId);
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
        let roleId = type === 'st' ? '1417661969863020583' : '1417663103369478325';
        const everyone = guild.roles.everyone;
        if (!guild.roles.cache.has(roleId)) roleId = ownerId;

        const permissionOverwrites = [
          { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: ownerId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ];
        if (roleId !== ownerId) {
          permissionOverwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
        }

        const ticketChannel = await guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          permissionOverwrites
        });

      const typeMeta = TICKET_TYPE_META[type] || {
        label: 'Support Ticket',
        formatTitle: 'Support Format',
        formatLines: ['Describe your request here.']
      };
      const formatBlock = buildFormatBlock(typeMeta);
      let description = '';
      if (type === 'st') description = [
        '**Thank you for opening a ticket within *Greenville Avenue*. Please wait for the staff team to reply.**',
        '',
        `**Selected Option:** ${typeMeta.label}`,
        '',
        `<@${ownerId}>`,
        '',
        `**Your Message:** ${interaction.fields.getTextInputValue('helpNeeded')}`,
        '',
        '**Use this format for any follow-up details:**',
        formatBlock
      ].join('\n');
      if (type === 'mr') description = [
        '**Thank you for opening a Member Report within *Greenville Avenue*.**',
        '',
        `**Selected Option:** ${typeMeta.label}`,
        '',
        '**Submitted Details**',
        `- Reported Username/ID: ${interaction.fields.getTextInputValue('userReport')}`,
        `- What happened: ${interaction.fields.getTextInputValue('reason')}`,
        `- Proof: ${interaction.fields.getTextInputValue('proof') || 'No proof provided'}`,
        '',
        '**Use this format for any follow-up details:**',
        formatBlock
      ].join('\n');
      if (type === 'ma') description = [
        '**Thank you for opening a Staff Report within *Greenville Avenue*.**',
        '',
        `**Selected Option:** ${typeMeta.label}`,
        '',
        '**Submitted Details**',
        `- Your Username/ID: ${interaction.user.tag}`,
        `- What happened: ${interaction.fields.getTextInputValue('reason')}`,
        '',
        '**Use this format for any follow-up details:**',
        formatBlock
      ].join('\n');

      const embed = new EmbedBuilder().setColor(embedColor).setDescription(description);
      const claimBtn = new ButtonBuilder().setCustomId('claimTicket').setLabel('Claim').setStyle(ButtonStyle.Success);
      const closeBtn = new ButtonBuilder().setCustomId('closeTicket').setLabel('Close').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(claimBtn, closeBtn);

      const msg = await ticketChannel.send({ content: `<@${ownerId}> <@&${roleId}>`, embeds: [embed], components: [row] });
      await msg.pin();

      await Ticket.create({
        guildId: guild.id,
        channelId: ticketChannel.id,
        ownerId,
        roleId,
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

      if (interaction.customId === 'claimTicket') {

        ticketData.claimed = interaction.user.id;
        await ticketData.save();

        await interaction.channel.permissionOverwrites.edit(ticketData.roleId, { ViewChannel: false });
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

        await interaction.channel.permissionOverwrites.edit(ticketData.roleId, { ViewChannel: true });
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
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirmClose').setLabel('Confirm Close').setStyle(ButtonStyle.Danger));
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(embedColor).setDescription('Are you sure you want to close this ticket?')], components: [row], ephemeral: true });
        return;
      }

      if (interaction.customId === 'confirmClose') {
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

        if (logChannel) logChannel.send({ embeds: [finalEmbed], files: [transcript] });

        await Ticket.deleteOne({ channelId: interaction.channel.id });
        await interaction.update({ content: 'Closing ticket in 5 seconds...', embeds: [], components: [] });
        setTimeout(() => interaction.channel.delete(), 5000);
      }
    }
  }
};
