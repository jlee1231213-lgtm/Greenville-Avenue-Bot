const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pingtest')
        .setDescription('Test the bot is working - shows ping and latency'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: 64 });

            const sent = await interaction.fetchReply();
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
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Error executing command', embeds: [] }).catch(() => {});
            } else {
                await interaction.reply({ content: '❌ Error executing command', flags: 64 }).catch(() => {});
            }
        }
    }
};
