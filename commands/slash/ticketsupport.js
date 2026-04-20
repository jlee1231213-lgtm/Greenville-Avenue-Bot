const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');
const Settings = require('../../models/settings');

const DEFAULT_PANEL = {
  title: 'Communited Assistance',
  description: `**<:orange_arrow:1418054390765457479>: General Assistance**
    <:sub1v2:1418076490972532868> Opening a “General Assistance” ticket means you may ask any concerns or suggestions about or in **Greenville Avenue**


**<:orange_arrow:1418054390765457479> Member Report**
<:sub1v2:1418076490972532868> If you want to report a member/staff that **broke the communities rules or Discord TOS**, open a “Member Report” for one of our staff members to come and help out


**<:orange_arrow:1418054390765457479> Staff Report**
<:sub1v2:1418076490972532868> If you need to report a staff member for misconduct or improper handling, open a “Staff Report” so leadership can review it.`,
  image: 'https://cdn.discordapp.com/attachments/1417296613839339621/1420607848261619782/Your_paragraph_text.png?ex=68d603a8&is=68d4b228&hm=36bee8efa2eb423650e96c683562ed65a077d0574d04345732b849fbf21a0a8f&',
  placeholder: 'Select an option'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketsupport')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .setDescription('Open a ticket support dropdown.'),
  async execute(interaction) {
    try {
      const settings = await Settings.findOne({ guildId: interaction.guild.id });
      const embedColor = settings?.embedcolor || '#ff7f25';
      const panelConfig = {
        ...DEFAULT_PANEL,
        ...(settings?.ticketSupportEmbed || {})
      };

      await interaction.deferReply({ flags: 64 });

      const embed = new EmbedBuilder()
        .setTitle(panelConfig.title || DEFAULT_PANEL.title)
        .setDescription(panelConfig.description || DEFAULT_PANEL.description)
        .setColor(embedColor)
        .setFooter({
          text: interaction.guild.name,
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
                description: 'Open a ticket to ask for help.',
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

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.editReply({ content: 'The support ticket options have been sent.' });
    } catch (error) {
      console.error('Error running ticketsupport command:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Error running ticketsupport command.' }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ Error running ticketsupport command.', flags: 64 }).catch(() => {});
      }
    }
  },
};
