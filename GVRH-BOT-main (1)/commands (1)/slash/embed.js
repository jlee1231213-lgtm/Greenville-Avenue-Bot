const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const { normalizeEmbedMediaUrl, setEmbedMedia } = require('../../utils/embedMedia');

function normalizeHexColor(input, fallback) {
    if (!input) return fallback;
    const value = input.trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(value)) return null;
    return value.startsWith('#') ? value : `#${value}`;
}

function isHttpUrl(value) {
    return Boolean(normalizeEmbedMediaUrl(value));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and send an embed to the channel')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Title of the embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Hex color (#RRGGBB or RRGGBB)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Main image URL')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('thumbnail')
                .setDescription('Thumbnail image URL')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('footer')
                .setDescription('Footer text')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('content')
                .setDescription('Optional message content outside embed')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const title = interaction.options.getString('title', true);
        const description = interaction.options.getString('description', true);
        const colorInput = interaction.options.getString('color');
        const image = interaction.options.getString('image');
        const thumbnail = interaction.options.getString('thumbnail');
        const footer = interaction.options.getString('footer');
        const content = interaction.options.getString('content');

        if (!description || description.trim() === "") {
            return await interaction.editReply({ content: '❌ Description is required for the embed.' });
        }

        if (image && !isHttpUrl(image)) {
            return await interaction.editReply({ content: '❌ Invalid image URL. Use http/https.' });
        }
        if (thumbnail && !isHttpUrl(thumbnail)) {
            return await interaction.editReply({ content: '❌ Invalid thumbnail URL. Use http/https.' });
        }

        const settings = await Settings.findOne({ guildId: interaction.guild.id }).catch(() => null);
        const defaultColor = settings?.embedcolor || '#00AAFF';
        const finalColor = normalizeHexColor(colorInput, defaultColor);
        if (colorInput && !finalColor) {
            return await interaction.editReply({ content: '❌ Invalid color format. Use #RRGGBB or RRGGBB.' });
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(finalColor);

        setEmbedMedia(embed, { image, thumbnail });
        if (footer) embed.setFooter({ text: footer });

        await interaction.channel.send({ content: content || undefined, embeds: [embed] });
        await interaction.editReply({ content: 'Embed sent successfully.' });
    },
};
