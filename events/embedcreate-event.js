const { EmbedBuilder } = require('discord.js');
const Settings = require('../models/settings');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isModalSubmit() && interaction.customId === 'workembed') {
                await interaction.deferReply({ flags: 64 });

                const guildName = interaction.guild?.name || "the server";
                const guildIcon = interaction.guild?.iconURL() || null;

                const description = interaction.fields.getTextInputValue('description');
                const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail') || null;
                const imageUrl = interaction.fields.getTextInputValue('image') || null;
                const title = interaction.fields.getTextInputValue('title') || null;

                if (!description) {
                    return interaction.editReply({ content: 'Description is required.' });
                }


                const settings = await Settings.findOne({ guildId: interaction.guild.id });
                const embedColor = settings?.embedcolor || '#2B2D31';

                const embed = new EmbedBuilder()
                    .setDescription(description)
                    .setColor(embedColor)
                    .setFooter({ text: guildName, iconURL: guildIcon });

                if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
                if (imageUrl) embed.setImage(imageUrl);
                if (title) embed.setTitle(title);

                await interaction.channel.send({ embeds: [embed] });

                await interaction.editReply({ content: 'Embed successfully created!' });

                console.log('Embed sent successfully.');
            }
        } catch (error) {
            console.error('Error processing modal submission:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: 'An error occurred while processing your request.', flags: 64 });
            } else {
                await interaction.reply({ content: 'An error occurred. Please try again.', flags: 64 });
            }
        }
    },
};
