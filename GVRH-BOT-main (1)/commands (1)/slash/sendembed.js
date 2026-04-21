const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const { setEmbedMedia } = require('../../utils/embedMedia');

const TEMPLATE_FIELDS = {
  startup: 'startupEmbed',
  setup: 'setupEmbed',
  ea: 'eaEmbed',
  giveaway: 'giveawayEmbed',
  welcome: 'welcomeEmbed',
  cohost: 'cohostEmbed',
  cohostend: 'cohostendEmbed',
  release: 'releaseEmbed',
  reinvites: 'reinvitesEmbed',
  over: 'overEmbed',
};

function applyTemplate(text, values) {
  if (!text) return text;
  return text
    .replace(/\$user/g, values.user)
    .replace(/\$date/g, values.date)
    .replace(/\$reactions/g, values.reactions)
    .replace(/\$notes/g, values.notes)
    .replace(/\$pt/g, values.pt)
    .replace(/\$frplimit/g, values.frplimit)
    .replace(/\$leo/g, values.leo);
}

function normalizeHexColor(input, fallback) {
  if (!input) return fallback;
  const value = input.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
    return value.startsWith('#') ? value : `#${value}`;
  }
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendembed')
    .setDescription('Send one of the configured settings embeds to this channel')
    .addStringOption(option =>
      option
        .setName('template')
        .setDescription('Which saved embed template to send')
        .setRequired(true)
        .addChoices(
          { name: 'Startup', value: 'startup' },
          { name: 'Setup', value: 'setup' },
          { name: 'EA', value: 'ea' },
          { name: 'Giveaway', value: 'giveaway' },
          { name: 'Welcome', value: 'welcome' },
          { name: 'Cohost', value: 'cohost' },
          { name: 'Cohost End', value: 'cohostend' },
          { name: 'Release', value: 'release' },
          { name: 'Reinvites', value: 'reinvites' },
          { name: 'Over/End', value: 'over' },
        ))
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User value for $user placeholder'))
    .addIntegerOption(option =>
      option
        .setName('reactions')
        .setDescription('Value for $reactions placeholder'))
    .addStringOption(option =>
      option
        .setName('notes')
        .setDescription('Value for $notes placeholder'))
    .addStringOption(option =>
      option
        .setName('peacetime')
        .setDescription('Value for $pt placeholder'))
    .addStringOption(option =>
      option
        .setName('frplimit')
        .setDescription('Value for $frplimit placeholder'))
    .addStringOption(option =>
      option
        .setName('leo')
        .setDescription('Value for $leo placeholder'))
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Override embed title'))
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Override embed description'))
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Override embed color (#RRGGBB or RRGGBB)'))
    .addStringOption(option =>
      option
        .setName('image')
        .setDescription('Override embed image URL'))
    .addStringOption(option =>
      option
        .setName('thumbnail')
        .setDescription('Override embed thumbnail URL'))
    .addStringOption(option =>
      option
        .setName('content')
        .setDescription('Optional message content (e.g. @everyone, @here)')),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const settings = await Settings.findOne({ guildId: interaction.guild.id });
    const embedColor = settings?.embedcolor || '#ffffff';

    if (!settings) {
      return interaction.editReply({ content: 'Server settings not found. Run /settings first.' });
    }

    const templateChoice = interaction.options.getString('template', true);
    const templateField = TEMPLATE_FIELDS[templateChoice];
    const template = settings?.[templateField] || {};

    if (!template.title && !template.description && !template.image && !template.thumbnail) {
      return interaction.editReply({ content: `No saved data found for ${templateChoice}. Configure it in /settings first.` });
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const replacements = {
      user: `<@${targetUser.id}>`,
      date: new Date().toLocaleDateString(),
      reactions: String(interaction.options.getInteger('reactions') || 'N/A'),
      notes: interaction.options.getString('notes') || 'N/A',
      pt: interaction.options.getString('peacetime') || 'N/A',
      frplimit: interaction.options.getString('frplimit') || 'N/A',
      leo: interaction.options.getString('leo') || 'N/A',
    };

    const overrideTitle = interaction.options.getString('title');
    const overrideDescription = interaction.options.getString('description');
    const overrideColor = interaction.options.getString('color');
    const overrideImage = interaction.options.getString('image');
    const overrideThumbnail = interaction.options.getString('thumbnail');
    const messageContent = interaction.options.getString('content');

    const finalColor = normalizeHexColor(overrideColor, embedColor);
    if (overrideColor && !finalColor) {
      return interaction.editReply({ content: 'Invalid color format. Use #RRGGBB or RRGGBB.' });
    }

    const finalTitle = applyTemplate(overrideTitle || template.title || 'Data not found', replacements);
    const finalDescription = applyTemplate(overrideDescription || template.description || 'No description configured.', replacements);

    const embed = new EmbedBuilder()
      .setColor(finalColor)
      .setTitle(finalTitle)
      .setDescription(finalDescription)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

    setEmbedMedia(embed, {
      image: overrideImage || template.image,
      thumbnail: overrideThumbnail || template.thumbnail,
    });

    await interaction.channel.send({ content: messageContent || undefined, embeds: [embed] });
    return interaction.editReply({ content: `Sent ${templateChoice} embed.` });
  },
};
