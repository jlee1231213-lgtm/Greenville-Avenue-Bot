const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Settings = require('../../models/settings');
const StartupSession = require('../../models/startupsession');
const { activeStartupSessions } = require('./startup');
const { DEFAULT_RELEASE_EMBED, DEFAULT_STARTUP_EMBED } = require('../../utils/defaultEmbeds');

const DEFAULT_REINVITES_TITLE = '<:gvi_confetti:1493952437642461254> **__Greenville Avenue — Session Re-Invites__**';

async function deleteIfPossible(message) {
    if (!message || !message.deletable) return;
    await message.delete().catch(() => {});
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('concluded')
        .setDescription('Send a concluded session message')
        .addStringOption(option =>
            option
                .setName('start_time')
                .setDescription('Session start time')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('end_time')
                .setDescription('Session end time')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Session duration')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('notes')
                .setDescription('Any host notes')
                .setRequired(false)
        ),
    async execute(interaction) {
        const settings = await Settings.findOne({ guildId: interaction.guild.id });
        const embedColor = settings?.embedcolor || '#ab6cc4';
        const imageUrl = 'https://media.discordapp.net/attachments/1450473391134871565/1492956124092039329/Screenshot_20260402_214940.jpg?ex=69dd373d&is=69dbe5bd&hm=9b392661e3f7da0bd7a522875f0d5adccf36e613e5d6f834fc04c81ffdb977b3&=&format=webp&width=2160&height=1046';
        const host = interaction.user;
        const startTime = interaction.options.getString('start_time');
        const endTime = interaction.options.getString('end_time');
        const duration = interaction.options.getString('duration');
        const notes = interaction.options.getString('notes') || 'No notes provided.';

        const startupTitle = settings?.startupEmbed?.title || DEFAULT_STARTUP_EMBED.title;
        const setupTitle = settings?.setupEmbed?.title || null;
        const cohostTitle = settings?.cohostEmbed?.title || null;
        const releaseTitle = settings?.releaseEmbed?.title || DEFAULT_RELEASE_EMBED.title;
        const reinvitesTitle = settings?.reinvitesEmbed?.title || DEFAULT_REINVITES_TITLE;
        const recentMessages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
        const latestStartupSession = await StartupSession.findOne({
            guildId: interaction.guild.id,
            channelId: interaction.channel.id
        }).sort({ createdAt: -1 });

        const messageIdsToDelete = new Set();
        if (latestStartupSession?.messageId) {
            messageIdsToDelete.add(latestStartupSession.messageId);
        }

        for (const [, data] of activeStartupSessions.entries()) {
            if (!data?.messageId) continue;
            if (data.type === 'session' || data.type === 'cohost') {
                messageIdsToDelete.add(data.messageId);
            }
        }

        if (recentMessages) {
            for (const [, message] of recentMessages) {
                if (message.author?.id !== interaction.client.user.id) continue;

                const customIds = message.components.flatMap(row => row.components.map(component => component.customId)).filter(Boolean);
                const embedTitles = message.embeds.map(embed => embed.title).filter(Boolean);
                const isSessionReply = latestStartupSession?.messageId && message.reference?.messageId === latestStartupSession.messageId;
                const matchesKnownTitle = embedTitles.some(title => [startupTitle, setupTitle, cohostTitle, releaseTitle, reinvitesTitle].filter(Boolean).includes(title));
                const isSessionComponentMessage = customIds.includes('getlink') || customIds.includes('reinvites_link');

                if (isSessionReply || matchesKnownTitle || isSessionComponentMessage) {
                    messageIdsToDelete.add(message.id);
                }
            }
        }

        for (const messageId of messageIdsToDelete) {
            const message = recentMessages?.get(messageId) || await interaction.channel.messages.fetch(messageId).catch(() => null);
            await deleteIfPossible(message);
        }

        if (latestStartupSession) {
            await StartupSession.deleteMany({
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
            }).catch(() => {});
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
