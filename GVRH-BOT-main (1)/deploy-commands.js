const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [];
function findSlashCommandsPath() {
    const candidates = [
        path.join(__dirname, 'commands', 'slash'),
        path.join(__dirname, 'commands (1)', 'slash'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(`No slash commands folder found. Checked: ${candidates.join(', ')}`);
}

const commandsPath = findSlashCommandsPath();
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    // Only register slash commands that have data + execute
    if (command.data && command.data.toJSON) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 Refreshing application (/) commands...');

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log(`✅ Successfully registered ${commands.length} commands.`);
    } catch (error) {
        console.error(error);
    }
})();
