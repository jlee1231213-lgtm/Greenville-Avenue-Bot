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
        const acknowledgeAfterMs = 1500;
        const visibleProgressAfterMs = 10000;
        let commandFinished = false;
        let commandTimeoutId;
        let visibleProgressId;

        async function sendVisibleProgress() {
            if (commandFinished || interaction.replied) return;

            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: `/${interaction.commandName} is still working. If this stays here, check the console for the slow step.`,
                    });
                } else {
                    await interaction.reply({
                        content: `/${interaction.commandName} is still working. If this stays here, check the console for the slow step.`,
                        flags: 64,
                    });
                }
            } catch (_) {
                // Ignore acknowledgement races.
            }
        }

        const timeoutAcknowledge = setTimeout(async () => {
            if (!interaction.deferred && !interaction.replied) {
                try {
                    await interaction.deferReply({ flags: 64 });
                } catch (_) {
                    // Ignore acknowledge race conditions.
                }
            }
        }, acknowledgeAfterMs);

        visibleProgressId = setTimeout(sendVisibleProgress, visibleProgressAfterMs);

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
            commandFinished = true;

            // Prevent Discord's "application did not respond" when a command
            // accidentally returns without acknowledging the interaction.
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: 'Command completed without a response. Please try again.', flags: 64 });
            }
        } catch (err) {
            commandFinished = true;
            console.error(`[ERROR] Slash command failed: /${interaction.commandName}`, err);
            try {
                if (interaction.deferred && !interaction.replied) {
                    const isTimeout = err?.message?.includes('timed out');
                    await interaction.editReply({
                        content: isTimeout
                            ? `/${interaction.commandName} timed out. The bot stopped waiting so Discord does not stay stuck on thinking.`
                            : 'There was an error executing that command.',
                    });
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
            clearTimeout(visibleProgressId);
        }
    },
};
