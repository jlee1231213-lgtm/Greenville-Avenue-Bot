require('dotenv').config();
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

mongoose.set('bufferCommands', false);

// Connect to MongoDB
if (!process.env.MONGODB_URI) {
    console.error('[ERROR] No MongoDB URI found in environment variables. Please set MONGODB_URI in your .env file.');
    process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('[INFO] Connected to MongoDB'))
    .catch((err) => {
        console.error('[ERROR] Failed to connect to MongoDB:', err);
        console.warn('[WARN] Bot will continue running, but database-backed features may fail until MongoDB reconnects.');
    });

mongoose.connection.on('connected', () => {
    console.log('[INFO] MongoDB connection established.');
});

mongoose.connection.on('disconnected', () => {
    console.warn('[WARN] MongoDB disconnected. Waiting for reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error('[ERROR] MongoDB connection error:', err?.message || err);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

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

const slashCommandsPath = findSlashCommandsPath();
console.log('[INFO] Loading slash commands from', slashCommandsPath);

// Commands
client.commands = new Collection();
const slashCommandFiles = fs.readdirSync(slashCommandsPath).filter(f => f.endsWith('.js'));
for (const file of slashCommandFiles) {
    try {
        const command = require(path.join(slashCommandsPath, file));
        if (!command?.data?.name) {
            console.log('[DEBUG] Skipping slash command (missing data.name):', file);
            continue;
        }
        console.log('[DEBUG] Loading slash command:', file);
        client.commands.set(command.data.name, command);
    } catch (err) {
        console.error('[ERROR] Failed to load slash command:', file);
        console.error(err);
        process.exit(1);
    }
}

// Events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}
// Login with error handling
if (!process.env.TOKEN || process.env.TOKEN === "" || process.env.TOKEN === "your_discord_bot_token_here") {
    console.error("[ERROR] No valid Discord bot token found in environment variables. Please set TOKEN in your .env file.");
    process.exit(1);
}

client.login(process.env.TOKEN).catch((err) => {
    if (err.message && err.message.includes('An invalid token was provided')) {
        console.error("[ERROR] Invalid Discord bot token. Please check your TOKEN in the .env file and try again.");
    } else {
        console.error("[ERROR] Failed to login:", err);
    }
    process.exit(1);
});
