module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        const timeoutAcknowledge = setTimeout(async () => {
            if (!interaction.deferred && !interaction.replied) {
                try {
                    await interaction.deferReply({ flags: 64 });
                } catch (_) {
                    // Ignore acknowledge race conditions.
                }
            }
        }, 2000);

        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(`[ERROR] Slash command failed: /${interaction.commandName}`, err);
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ content: 'There was an error executing that command.' });
                } else if (interaction.replied) {
                    await interaction.followUp({ content: 'There was an error executing that command.', flags: 64 });
                } else {
                    await interaction.reply({ content: 'There was an error executing that command.', flags: 64 });
                }
            } catch (_) {
                // Ignore secondary response errors to avoid crashing handler.
            }
        } finally {
            clearTimeout(timeoutAcknowledge);
        }
    },
};