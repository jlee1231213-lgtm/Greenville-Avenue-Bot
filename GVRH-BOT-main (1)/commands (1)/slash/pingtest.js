const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pingtest')
        .setDescription('Test the bot is working - shows ping and latency'),

    async execute(interaction) {
        try {
            const sent = await interaction.reply({ content: 'Measuring ping...', fetchReply: true });
            const ping = sent.createdTimestamp - interaction.createdTimestamp;
            const apiPing = interaction.client.ws.ping;

            const embed = new EmbedBuilder()
                .setColor("#00ff00")
                .setTitle("✓ Bot is Working!")
                .addFields(
                    { name: 'Bot Ping', value: `${ping}ms`, inline: true },
                    { name: 'API Latency', value: `${apiPing}ms`, inline: true },
                    { name: 'Status', value: 'Online & Responding', inline: true }
                )
                .setFooter({ text: 'Testing Mode - MongoDB Disabled' });

            await interaction.editReply({ content: '', embeds: [embed] });
        } catch (error) {
            console.error('Error in pingtest command:', error);
            await interaction.reply({ content: '❌ Error executing command', ephemeral: true }).catch(() => {});
        }
    }
};
