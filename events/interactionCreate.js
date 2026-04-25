module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        const commandTimeoutMs = 15000;
        let commandTimeoutId;

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
            const timeoutPromise = new Promise((_, reject) => {
                commandTimeoutId = setTimeout(() => {
                    reject(new Error(`Command /${interaction.commandName} timed out after ${commandTimeoutMs}ms`));
                }, commandTimeoutMs);
            });

            await Promise.race([
                Promise.resolve().then(() => command.execute(interaction)),
                timeoutPromise,
            ]);
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
            clearTimeout(commandTimeoutId);
        }
    },
};