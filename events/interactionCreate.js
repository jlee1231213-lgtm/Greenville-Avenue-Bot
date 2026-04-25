module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command || typeof command.execute !== 'function') {
            try {
                await interaction.reply({
                    content: `This command is currently unavailable: /${interaction.commandName}. Please try again after the bot restarts.`,
                    flags: 64,
                });
            } catch (_) {
                // Ignore acknowledgement races.
            }
            return;
        }
        const commandTimeoutMs = 45000;
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

            // Prevent Discord's "application did not respond" when a command
            // accidentally returns without acknowledging the interaction.
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: 'Command completed without a response. Please try again.', flags: 64 });
            }
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