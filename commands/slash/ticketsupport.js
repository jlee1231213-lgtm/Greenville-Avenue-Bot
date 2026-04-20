const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');
const Settings = require('../../models/settings');

const DEFAULT_PANEL = {
  title: 'Greenville Avenue - Support Tickets',
  description: `Welcome to the Greenville Avenue, Support Directory! This channel allows you to request assistance, such as General Support, Staff Report, or a Civilian Report. If you are facing any issues within the server, please do not hesitate to make a ticket below!

> **\`General Assistance:\`**
<:gvry_ydot:1489356230785761382> Use this support ticket to ask **questions** about rules or sessions. You may also use this ticket to **Request Partnerships, Claim Perks, or for Application Requests**. This is not to be used to report someone, as there are other tickets to use that for.

> **\`Member Report:\`**
<:gvry_ydot:1489356230785761382> Use this to report a **Civilian** who might be breaking the rules. Make sure to gather proof as it is necessary so that the server High Command Team can take action, depending on the severity. If further support is needed, please request the Staff Member to assist you further.

> **\`Staff Report:\`**
<:gvry_ydot:1489356230785761382> Use this to report a **Staff Member** who might be breaking the rules. Make sure to gather proof as it is necessary so that the server High Command Team can take action, depending on the severity. If further support is needed, please request the High Command Member to assist you further.

-# **Please Note:** If you do not respond to your ticket within **24 Hours**, it will be __automatically__ closed. Processing your support tickets may take between **2-3** Hours.`,
  image: 'https://media.discordapp.net/attachments/1450473391134871565/1492937155973091429/Screenshot_20260402_223741.jpg?ex=69dd2593&is=69dbd413&hm=4b2b3ce43a1614758c54f42720f7f7d6b5f3c5b86cddd626c42fd155c6bae182&=&format=webp&width=2160&height=1048',
  placeholder: 'Select an option'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketsupport')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .setDescription('Open a ticket support dropdown.'),
  async execute(interaction) {
    const channelid = `${interaction.channel.id}`
    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ff7f25';
    const savedPanel = settings?.ticketSupportEmbed || {};
    const panelConfig = {
      ...DEFAULT_PANEL,
      ...savedPanel
    };

 
    await interaction.deferReply(); 


    const embed = new EmbedBuilder()
      .setTitle(panelConfig.title || DEFAULT_PANEL.title)
      .setDescription(panelConfig.description || DEFAULT_PANEL.description)
      .setColor(embedColor)
      .setFooter({ 
        text: `${interaction.guild.name}`,
        iconURL: interaction.guild.iconURL() || undefined
      });

    if (typeof panelConfig.image === 'string' && panelConfig.image.startsWith('http')) {
      embed.setImage(panelConfig.image);
    }


    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('supportOptions')
          .setPlaceholder(panelConfig.placeholder || DEFAULT_PANEL.placeholder)
          .addOptions([
            {
              label: 'General Assistance',
              description: `Open a ticket to ask a question.`,
              value: 'st',
            },
            {
              label: 'Member Report',
              description: 'Open a ticket to report a member.',
              value: 'mr',
            },
            {
              label: 'Staff Report',
              description: 'Open a ticket to report a staff member.',
              value: 'ma',
            },
          ])
      );

    const supportChannel = interaction.guild.channels.cache.get(`${channelid}`);
    if (supportChannel) {
      await supportChannel.send({ embeds: [embed], components: [row] });
      await interaction.followUp({ content: 'The support ticket options have been sent.', ephemeral: true });
    } else {
      await interaction.followUp({ content: 'Unable to find the support channel.', ephemeral: true });
    }
  },
};
