const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const StartupSession = require('../../models/startupsession');
const { activeStartupSessions } = require('./startup');
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function formatSessionTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function formatDuration(start, end) {
    const diffMs = Math.max(0, end - start);
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

async function purgeNonPinnedMessages(channel) {
    let before;

    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
        if (!fetched || fetched.size === 0) break;

        const unpinnedMessages = [...fetched.values()].filter(message => !message.pinned);
        const recentMessages = unpinnedMessages.filter(message => Date.now() - message.createdTimestamp < FOURTEEN_DAYS_MS);
        const olderMessages = unpinnedMessages.filter(message => Date.now() - message.createdTimestamp >= FOURTEEN_DAYS_MS);

        if (recentMessages.length > 0) {
            await channel.bulkDelete(recentMessages.map(message => message.id), true).catch(() => {});
        }

        for (const message of olderMessages) {
            if (message.deletable) {
                await message.delete().catch(() => {});
            }
        }

        before = fetched.last()?.id;
        if (!before) break;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('concluded')
        .setDescription('Send a concluded session message')
        .addStringOption(option =>
            option
                .setName('notes')
                .setDescription('Any host notes')
                .setRequired(true)
        ),
    async execute(interaction) {
        const settings = await Settings.findOne({ guildId: interaction.guild.id });
        const embedColor = settings?.embedcolor || '#ab6cc4';
        const imageUrl = 'https://media.discordapp.net/attachments/1450473391134871565/1492956124092039329/Screenshot_20260402_214940.jpg?ex=69dd373d&is=69dbe5bd&hm=9b392661e3f7da0bd7a522875f0d5adccf36e613e5d6f834fc04c81ffdb977b3&=&format=webp&width=2160&height=1046';
        const host = interaction.user;
        const latestStartupSession = await StartupSession.findOne({
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
        }).sort({ createdAt: -1 });
        const startupDate = latestStartupSession?.createdAt ? new Date(latestStartupSession.createdAt) : null;
        const now = new Date();
        const startTime = startupDate ? formatSessionTime(startupDate) : 'Unknown';
        const endTime = formatSessionTime(now);
        const duration = startupDate ? formatDuration(startupDate, now) : 'Unknown';
        const notes = interaction.options.getString('notes', true);
        await purgeNonPinnedMessages(interaction.channel);

        await StartupSession.deleteMany({
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
        }).catch(() => {});

        for (const [sessionId, data] of activeStartupSessions.entries()) {
            if (data?.type === 'session' || data?.type === 'cohost') {
                activeStartupSessions.delete(sessionId);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription([
                `<:gvry_ydot:1489356230785761382> Thank you for joining the session hosted by <@${host.id}>, we hope you had an enjoyable experience throughout the session!`,
                '',
                '<:green_arrow_recolor:1489356754570580069>**| Session Information**',
                `-# <:gvry_ydot:1489356230785761382> **Host:** <@${host.id}>`,
                `-# <:gvry_ydot:1489356230785761382> **Start Time:** ${startTime}`,
                `-# <:gvry_ydot:1489356230785761382> **End Time:** ${endTime}`,
                `-# <:gvry_ydot:1489356230785761382> **Duration:** \`${duration}\``,
                `-# <:gvry_ydot:1489356230785761382> **Notes:** ${notes}`
            ].join('\n'))
            .setImage(imageUrl)
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

        await interaction.reply({ embeds: [embed] });
    },
};
