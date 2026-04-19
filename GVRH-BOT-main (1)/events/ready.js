const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { isVisibleSlashCommand } = require('../visibleSlashCommands');

function findSlashCommandsPath() {
    const candidates = [
        path.join(__dirname, '..', 'commands', 'slash'),
        path.join(__dirname, '..', 'commands (1)', 'slash'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(`No slash commands folder found. Checked: ${candidates.join(', ')}`);
}

async function deployGuildCommands(client) {
    if (!process.env.TOKEN || !process.env.GUILD_ID) {
        console.warn('[WARN] Testing mode is enabled, but TOKEN or GUILD_ID is missing. Skipping command deploy.');
        return;
    }

    const commands = [];
    const slashPath = findSlashCommandsPath();
    const commandFiles = fs.readdirSync(slashPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(slashPath, file));
        if (command?.data?.name && isVisibleSlashCommand(command.data.name)) {
            commands.push(command.data.toJSON());
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    // Remove old global commands during testing to avoid duplicate command listings.
    await rest.put(
        Routes.applicationCommands(client.application.id),
        { body: [] },
    );

    await rest.put(
        Routes.applicationGuildCommands(client.application.id, process.env.GUILD_ID),
        { body: commands },
    );
    console.log(`[INFO] Testing mode: cleared global commands and deployed ${commands.length} guild slash commands to ${process.env.GUILD_ID}`);
}

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        const desiredBotDescription = `Introducing the Greenville Avenue Bot, a multipurpose bot made especially for GVA.
*Owned by kosmote_21 & f80q, Developed by pnkstrz_._ & Designed by f80q*

https://discord.gg/PCkUk7X28c`;
        const desiredBotName = process.env.BOT_NAME?.trim();
        if (desiredBotName && client.user.username !== desiredBotName) {
            try {
                await client.user.setUsername(desiredBotName);
                console.log(`[INFO] Updated bot username to: ${desiredBotName}`);
            } catch (error) {
                console.warn('[WARN] Could not update bot username (possible Discord rate limit):', error?.message || error);
            }
        }

        if (client.application) {
            try {
                await client.application.fetch();
                if (client.application.description !== desiredBotDescription) {
                    await client.application.edit({ description: desiredBotDescription });
                    console.log('[INFO] Updated bot description.');
                }
            } catch (error) {
                console.warn('[WARN] Could not update bot description:', error?.message || error);
            }
        }

        console.log(`Bot is online as ${client.user.tag}`);
        client.user.setPresence({ activities: [{ name: 'Greenville Avenue' }], status: 'online' });

        const testingMode = process.env.TESTING_MODE !== 'false';
        if (testingMode) {
            try {
                await deployGuildCommands(client);
            } catch (error) {
                console.error('[ERROR] Testing mode command deploy failed:', error);
            }
        }
    }
};
