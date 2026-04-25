const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const StartupSession = require('../../models/startupsession');
const SessionLog = require('../../models/sessionlog');
const { activeStartupSessions } = require('./startup');
const { sendCommandLog, sendQuotaStatusLog } = require('../../utils/commandLogger');
const { getConfiguredRoleIds } = require('../../utils/roleHelpers');
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_SESSION_LOG_DURATION_MS = 20 * 60 * 1000;
const DEFAULT_CONCLUDED_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1450473391134871565/1489434332081950841/Screenshot_20260402_214940.jpg';
const CONCLUDED_STEP_TIMEOUT_MS = 10000;

function withTimeout(promise, fallbackValue, label, timeoutMs = CONCLUDED_STEP_TIMEOUT_MS) {
    let timeoutId;
    const timeout = new Promise(resolve => {
        timeoutId = setTimeout(() => {
            console.warn(`[WARN] /concluded ${label} timed out. Continuing.`);
            resolve(fallbackValue);
        }, timeoutMs);
    });

    return Promise.race([promise, timeout])
        .catch(error => {
            console.warn(`[WARN] /concluded ${label} failed:`, error?.message || error);
            return fallbackValue;
        })
        .finally(() => clearTimeout(timeoutId));
}

function normalizeDiscordMediaUrl(url) {
    if (typeof url !== 'string') return null;

    try {
        const parsedUrl = new URL(url.trim());
        if (!/^https?:$/i.test(parsedUrl.protocol)) return null;

                if (parsedUrl.hostname === 'media.discordapp.net') {
            parsedUrl.hostname = 'cdn.discordapp.com';
                }

                if ((parsedUrl.hostname === 'cdn.discordapp.com' || parsedUrl.hostname === 'media.discordapp.net')
                    && parsedUrl.pathname.includes('/attachments/')) {
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
        DEFAULT_CONCLUDED_IMAGE_URL,
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

function shouldLogSession(start, end) {
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false;
    return end - start >= MIN_SESSION_LOG_DURATION_MS;
}

async function purgeNonPinnedMessages(channel, protectedMessageIds = new Set()) {
    let before;

    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
        if (!fetched || fetched.size === 0) break;

        const unpinnedMessages = [...fetched.values()].filter(message =>
            !message.pinned && !protectedMessageIds.has(message.id)
        );
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
        await interaction.deferReply({ flags: 64 });

        const settings = await withTimeout(
            Settings.findOne({ guildId: interaction.guild.id }).lean().exec(),
            null,
            'settings lookup'
        );
        const embedColor = settings?.embedcolor || '#ab6cc4';
        const imageUrl = resolveConcludedImageUrl(settings);
        const host = interaction.user;
        const latestStartupSession = await withTimeout(
            StartupSession.findOne({
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
            }).sort({ createdAt: -1 }).lean().exec(),
            null,
            'startup session lookup'
        );
        const startupDate = latestStartupSession?.createdAt ? new Date(latestStartupSession.createdAt) : null;
        const now = new Date();
        const qualifiesForSessionLog = shouldLogSession(startupDate, now);
        const startTime = startupDate ? formatDiscordTimestamp(startupDate) : 'Unknown';
        const endTime = formatDiscordTimestamp(now);
        const duration = startupDate ? formatDuration(startupDate, now) : 'Unknown';
        const notes = interaction.options.getString('notes', true);

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription([
                `<:gvry_ydot:1489356230785761382> Thank you for joining the Greenville Avenue session hosted by <@${host.id}>. We hope you had an enjoyable experience throughout the session!`,
                '',
                '<:green_arrow_recolor:1489356754570580069>**| Greenville Avenue Session Information**',
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

        const concludedMessage = await withTimeout(
            interaction.channel.send({ embeds: [embed] }),
            null,
            'sending concluded message'
        );

        if (!concludedMessage) {
            return interaction.editReply({ content: 'I could not send the concluded message. Please check my channel permissions.' });
        }

        await interaction.editReply({ content: 'Session concluded successfully.' });

        setImmediate(() => {
            runConcludedCleanup({
                interaction,
                settings,
                latestStartupSession,
                startupDate,
                now,
                duration,
                qualifiesForSessionLog,
                notes,
                host,
                protectedMessageIds: new Set([concludedMessage.id]),
            }).catch(error => {
                console.error('[ERROR] /concluded background cleanup failed:', error);
            });
        });
    },
};

async function runConcludedCleanup({
    interaction,
    settings,
    latestStartupSession,
    startupDate,
    now,
    duration,
    qualifiesForSessionLog,
    notes,
    host,
    protectedMessageIds,
}) {
        await withTimeout(
            purgeNonPinnedMessages(interaction.channel, protectedMessageIds),
            null,
            'purging old messages',
            15000
        );

        await withTimeout(
            StartupSession.deleteMany({
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
            }),
            null,
            'deleting startup sessions'
        );

        for (const [sessionId, data] of activeStartupSessions.entries()) {
            if (data?.type === 'session' || data?.type === 'cohost') {
                activeStartupSessions.delete(sessionId);
            }
        }

        if (qualifiesForSessionLog && startupDate) {
            const sessionId = latestStartupSession?.messageId
                ? `startup-${interaction.guild.id}-${latestStartupSession.messageId}`
                : `concluded-${interaction.guild.id}-${interaction.channel.id}-${interaction.id}`;

            await withTimeout(
                SessionLog.updateOne(
                { sessionId },
                {
                    $set: {
                        guildId: interaction.guild.id,
                        sessiontype: 'session',
                        sessionId,
                        userId: host.id,
                        timestarted: startupDate,
                        timeended: now,
                    },
                },
                { upsert: true }
                ),
                null,
                'saving session log'
            );
        }

        await withTimeout(sendCommandLog({
            interaction,
            settings,
            title: 'Concluded Command Executed',
            description: `${interaction.user.tag} concluded a session.`,
            fields: [
                { name: 'Duration', value: duration, inline: true },
                { name: 'Logged', value: qualifiesForSessionLog ? 'Yes (20m+)' : 'No (<20m)', inline: true },
                { name: 'Notes', value: notes.length > 250 ? `${notes.slice(0, 247)}...` : notes },
            ],
        }), null, 'sending command log');

        await withTimeout(
            logAdvancedQuotaStatus(interaction, settings),
            null,
            'logging quota status',
            15000
        );
}
