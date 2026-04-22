const fs = require('fs');
const path = require('path');

function findSlashCommandsPath(baseDir) {
    const canonicalPath = path.join(baseDir, 'commands', 'slash');
    if (fs.existsSync(canonicalPath)) {
        return canonicalPath;
    }

    const legacyPath = path.join(baseDir, 'commands (1)', 'slash');
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    throw new Error(`No slash commands folder found. Checked: ${canonicalPath}, ${legacyPath}`);
}

function loadSlashCommands(baseDir) {
    const slashCommandsPath = findSlashCommandsPath(baseDir);
    const commandFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));
    const loadedCommands = [];
    const commandNames = new Map();

    for (const file of commandFiles) {
        const filePath = path.join(slashCommandsPath, file);
        const command = require(filePath);

        if (!command?.data?.name) {
            loadedCommands.push({ file, filePath, command, name: null });
            continue;
        }

        const existingFile = commandNames.get(command.data.name);
        if (existingFile) {
            throw new Error(
                `Duplicate slash command name "${command.data.name}" found in ${existingFile} and ${filePath}`
            );
        }

        commandNames.set(command.data.name, filePath);
        loadedCommands.push({ file, filePath, command, name: command.data.name });
    }

    return { slashCommandsPath, loadedCommands };
}

module.exports = {
    findSlashCommandsPath,
    loadSlashCommands,
};