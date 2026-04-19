const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('View information about the bot'),

    async execute(interaction) {
        try {
            const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
            const ping = sent.createdTimestamp - interaction.createdTimestamp;
            const apiPing = interaction.client.ws.ping;

            // Try to get embed color from DB, fallback to default
            let embedColor = "#ab6cc4";
            let dbStatus = 'Connected';
            try {
                const settings = await Settings.findOne({ guildId: interaction.guild.id });
                if (settings && settings.embedcolor) {
                    embedColor = settings.embedcolor;
                }
            } catch (dbError) {
                dbStatus = 'Unavailable';
                console.log('MongoDB not available for botinfo, using defaults');
            }

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle("Bot Information")
                .addFields(
                    { name: 'Developer', value: 'Batman Jordan', inline: true },
                    { name: 'Server Location', value: 'N/A', inline: true },
                    { name: 'Database Status', value: dbStatus, inline: true },
                    { name: 'Ping', value: `${ping}ms`, inline: true },
                    { name: 'API Latency', value: `${apiPing}ms`, inline: true }
                );

            await interaction.editReply({ content: '', embeds: [embed] });
        } catch (error) {
            console.error('Error in botinfo command:', error);
            await interaction.editReply({ content: '❌ Error retrieving bot information.', embeds: [] }).catch(() => {});
        }
    }
};
