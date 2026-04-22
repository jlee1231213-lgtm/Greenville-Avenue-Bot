const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { isVisibleSlashCommand } = require('./visibleSlashCommands');
const { loadSlashCommands } = require('./utils/slashCommandLoader');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const commands = [];
const { loadedCommands } = loadSlashCommands(__dirname);

for (const { command, name } of loadedCommands) {

    // Only register slash commands that should appear in Discord's slash menu.
    if (command.data && command.data.toJSON && isVisibleSlashCommand(name)) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 Refreshing application (/) commands...');

        const deployGuildId = process.env.GUILD_ID?.trim();
        if (deployGuildId) {
            try {
                // Keep the slash menu clean when guild deploy is available.
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: [] }
                );
                console.log('🧹 Cleared global application commands.');

                await rest.put(
                    Routes.applicationGuildCommands(
                        process.env.CLIENT_ID,
                        deployGuildId
                    ),
                    { body: commands }
                );

                console.log(`✅ Successfully registered ${commands.length} guild commands to ${deployGuildId}.`);
                return;
            } catch (error) {
                if (error?.code !== 50001) {
                    throw error;
                }

                console.warn(`⚠️ Missing access to guild ${deployGuildId}. Falling back to global command deployment.`);
            }
        } else {
            console.warn('⚠️ GUILD_ID is not set. Deploying global commands.');
        }

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log(`✅ Successfully registered ${commands.length} global commands.`);
    } catch (error) {
        console.error(error);
    }
})();
