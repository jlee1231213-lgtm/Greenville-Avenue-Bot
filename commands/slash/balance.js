const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your balance')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check balance of')
                .setRequired(false)),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: false });

            const targetUser = interaction.options.getUser('user') || interaction.user;

            // Fetch real balance from MongoDB, upsert to avoid duplicate key error
            const Eco = require('../../models/eco');
            let userEco = await Eco.findOneAndUpdate(
                { userId: targetUser.id },
                {},
                { returnDocument: 'after', upsert: true }
            );
            const cash = userEco.cash || 0;
            const bank = userEco.bank || 0;
            const total = cash + bank;
            const embed = new EmbedBuilder()
                .setColor("#ffff00")
                .setTitle(`${targetUser.username}'s Balance`)
                .addFields(
                    { name: '💰 Cash', value: `$${cash.toLocaleString()}`, inline: true },
                    { name: '🏦 Bank', value: `$${bank.toLocaleString()}`, inline: true },
                    { name: '💎 Total', value: `$${total.toLocaleString()}`, inline: true }
                );
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in balance command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Error retrieving balance information.' });
            } else {
                await interaction.editReply({ content: '❌ Error retrieving balance information.' }).catch(() => {});
            }
        }
    }
};
