const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const { loadSlashCommands } = require('./utils/slashCommandLoader');

mongoose.set('bufferCommands', false);

// Connect to MongoDB
if (!process.env.MONGODB_URI) {
    console.error('[ERROR] No MongoDB URI found in environment variables. Please set MONGODB_URI in your .env file.');
    process.exit(1);
}

async function connectToMongo() {
    try {
        console.log('[INFO] Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 20000,
        });
        console.log('[INFO] Connected to MongoDB');
    } catch (err) {
        console.error('[ERROR] Failed to connect to MongoDB:', err);
        process.exit(1);
    }
}

mongoose.connection.on('connected', () => {
    console.log('[INFO] MongoDB connection established.');
});

mongoose.connection.on('disconnected', () => {
    console.warn('[WARN] MongoDB disconnected. Waiting for reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error('[ERROR] MongoDB connection error:', err?.message || err);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ]
});

const { slashCommandsPath, loadedCommands } = loadSlashCommands(__dirname);
console.log('[INFO] Loading slash commands from', slashCommandsPath);

// Commands
client.commands = new Collection();
for (const { file, command, name } of loadedCommands) {
    try {
        if (!name) {
            console.log('[DEBUG] Skipping slash command (missing data.name):', file);
            continue;
        }
        console.log('[DEBUG] Loading slash command:', file);
        client.commands.set(name, command);
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
async function startBot() {
    await connectToMongo();

    if (!process.env.TOKEN || process.env.TOKEN === "" || process.env.TOKEN === "your_discord_bot_token_here") {
        console.error("[ERROR] No valid Discord bot token found in environment variables. Please set TOKEN in your .env file.");
        process.exit(1);
    }

    console.log('[INFO] Logging into Discord...');

    client.login(process.env.TOKEN).catch((err) => {
        if (err.message && err.message.includes('An invalid token was provided')) {
            console.error("[ERROR] Invalid Discord bot token. Please check your TOKEN in the .env file and try again.");
        } else {
            console.error("[ERROR] Failed to login:", err);
        }
        process.exit(1);
    });
}

startBot().catch((err) => {
    console.error('[ERROR] Bot startup failed:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ERROR] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[ERROR] Uncaught exception:', err);
});
