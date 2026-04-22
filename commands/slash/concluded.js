const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const StartupSession = require('../../models/startupsession');
const SessionLog = require('../../models/sessionlog');
const { activeStartupSessions } = require('./startup');
const { sendCommandLog, sendQuotaStatusLog } = require('../../utils/commandLogger');
const { getConfiguredRoleIds } = require('../../utils/roleHelpers');
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeDiscordMediaUrl(url) {
    if (typeof url !== 'string') return null;

    try {
        const parsedUrl = new URL(url.trim());
        if (!/^https?:$/i.test(parsedUrl.protocol)) return null;

        if (parsedUrl.hostname === 'media.discordapp.net') {
            parsedUrl.hostname = 'cdn.discordapp.com';
            parsedUrl.search = '';
        }

        return parsedUrl.toString();
    } catch {
        return null;
    }
}

function resolveConcludedImageUrl(settings) {
    const candidates = [
        process.env.CONCLUDED_IMAGE_URL,
        settings?.overEmbed?.image,
        settings?.releaseEmbed?.image,
    ];

    for (const candidate of candidates) {
        const normalized = normalizeDiscordMediaUrl(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

function formatDiscordTimestamp(date) {
    return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
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

async function logAdvancedQuotaStatus(interaction, settings) {
    const quotaTarget = Number.parseInt(process.env.QUOTA_REQUIRED_SESSIONS || '2', 10);
    const quotaPeriodDays = Number.parseInt(process.env.QUOTA_PERIOD_DAYS || '7', 10);

    if (!Number.isFinite(quotaTarget) || quotaTarget < 1 || !Number.isFinite(quotaPeriodDays) || quotaPeriodDays < 1) {
        return;
    }

    const periodStart = new Date(Date.now() - quotaPeriodDays * 24 * 60 * 60 * 1000);
    const roleIds = getConfiguredRoleIds(settings?.staffRoleId, settings?.adminRoleId);
    const uniqueRoleIds = [...new Set(roleIds)];

    let staffMembers = [];
    if (uniqueRoleIds.length > 0) {
        await interaction.guild.members.fetch();
        staffMembers = interaction.guild.members.cache.filter(member =>
            uniqueRoleIds.some(roleId => member.roles.cache.has(roleId))
        ).map(member => member.id);
    } else {
        staffMembers = [interaction.user.id];
    }

    const quotaCounts = await SessionLog.aggregate([
        {
            $match: {
                guildId: interaction.guild.id,
                sessiontype: 'session',
                timeended: { $gte: periodStart },
            },
        },
        {
            $group: {
                _id: '$userId',
                count: { $sum: 1 },
            },
        },
    ]);

    const countByUserId = new Map(quotaCounts.map(entry => [String(entry._id), entry.count]));
    const participants = [...new Set(staffMembers)].map(userId => {
        const count = countByUserId.get(userId) || 0;
        return {
            userId,
            count,
            passed: count >= quotaTarget,
        };
    });

    await sendQuotaStatusLog({
        interaction,
        settings,
        title: 'Staff Quota Status',
        quotaName: 'Session Hosting Quota',
        periodLabel: `the last ${quotaPeriodDays} day(s)`,
        target: quotaTarget,
        participants,
    });
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
        const imageUrl = resolveConcludedImageUrl(settings);
        const host = interaction.user;
        const latestStartupSession = await StartupSession.findOne({
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
        }).sort({ createdAt: -1 });
        const startupDate = latestStartupSession?.createdAt ? new Date(latestStartupSession.createdAt) : null;
        const now = new Date();
        const startTime = startupDate ? formatDiscordTimestamp(startupDate) : 'Unknown';
        const endTime = formatDiscordTimestamp(now);
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
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined });

        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        await interaction.reply({ embeds: [embed] });

        await sendCommandLog({
            interaction,
            settings,
            title: 'Concluded Command Executed',
            description: `${interaction.user.tag} concluded a session.`,
            fields: [
                { name: 'Duration', value: duration, inline: true },
                { name: 'Notes', value: notes.length > 250 ? `${notes.slice(0, 247)}...` : notes },
            ],
        });

        await logAdvancedQuotaStatus(interaction, settings);
    },
};
