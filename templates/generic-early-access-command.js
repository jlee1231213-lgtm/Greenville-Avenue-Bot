const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');

// Change these values to fit the other bot/server.
const COMMAND_NAME = 'earlyaccess';
const BUTTON_ID = 'get_early_access_link';
const BUTTON_LABEL = 'Get Link';
const BUTTON_EMOJI = null; // Example: { id: '123456789012345678', name: 'chain' }
const DEFAULT_EMBED_COLOR = '#2b6cb0';
const DEFAULT_TITLE = 'Early Access Is Open';
const DEFAULT_DESCRIPTION = '$user has opened early access.\n\nUse the button below if you have permission to join.';
const DEFAULT_IMAGE = '';
const PING_TEXT = '@here';

// Members with Administrator permission can always use the button.
// Add server role IDs here if you want non-admin members to be able to claim the link.
const EARLY_ACCESS_ROLE_IDS = [
  // '123456789012345678',
];

function memberHasAccess(member) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  if (EARLY_ACCESS_ROLE_IDS.length === 0) {
    return false;
  }

  return member.roles.cache.some(role => EARLY_ACCESS_ROLE_IDS.includes(role.id));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription('Post an early access message with a claim button.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('link')
        .setDescription('The server or invite link to send privately')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Optional custom embed title')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Optional custom embed description')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Optional image URL for the embed')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sessionLink = interaction.options.getString('link', true);
    const userMention = `<@${interaction.user.id}>`;
    const title = (interaction.options.getString('title') || DEFAULT_TITLE).replace(/\$user/g, userMention);
    const description = (interaction.options.getString('description') || DEFAULT_DESCRIPTION).replace(/\$user/g, userMention);
    const imageUrl = interaction.options.getString('image') || DEFAULT_IMAGE;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(DEFAULT_EMBED_COLOR)
      .setFooter({
        text: interaction.guild.name,
        iconURL: interaction.guild.iconURL() || undefined,
      });

    if (typeof imageUrl === 'string' && /^https?:\/\//.test(imageUrl)) {
      embed.setImage(imageUrl);
    }

    const button = new ButtonBuilder()
      .setCustomId(BUTTON_ID)
      .setLabel(BUTTON_LABEL)
      .setStyle(ButtonStyle.Success);

    if (BUTTON_EMOJI) {
      button.setEmoji(BUTTON_EMOJI);
    }

    const row = new ActionRowBuilder().addComponents(button);

    const message = await interaction.channel.send({
      content: PING_TEXT || undefined,
      embeds: [embed],
      components: [row],
    });

    await interaction.editReply({
      content: 'Early access message sent successfully.',
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60 * 60 * 1000,
    });

    collector.on('collect', async buttonInteraction => {
      if (buttonInteraction.customId !== BUTTON_ID) {
        return;
      }

      await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!memberHasAccess(buttonInteraction.member)) {
        return buttonInteraction.editReply({
          content: 'You do not have the required role or administrator permission.',
        });
      }

      return buttonInteraction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Your Early Access Link')
            .setDescription(`Here is your link:\n${sessionLink}`)
            .setColor(DEFAULT_EMBED_COLOR),
        ],
      });
    });
  },
};
