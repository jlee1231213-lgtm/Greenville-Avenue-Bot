const { ActivityType, PermissionFlagsBits } = require('discord.js');

const REPRESENTATIVE_ROLE_ID = '1443224410294063170';
const ANNOUNCEMENT_CHANNEL_ID = '1443224412089483330';
const STATUS_TRIGGERS = ['/gva', '/gvavenue'];

function getPresenceText(presence) {
    return presence?.activities
        ?.filter(activity => activity.type === ActivityType.Custom || activity.state || activity.name)
        .map(activity => `${activity.state || ''} ${activity.name || ''}`)
        .join(' ')
        .toLowerCase() || '';
}

function hasRepresentativeStatus(presence) {
    const text = getPresenceText(presence);
    return STATUS_TRIGGERS.some(trigger => text.includes(trigger));
}

async function findAnnouncementChannel(guild) {
    const representativeChannel = await guild.channels.fetch(ANNOUNCEMENT_CHANNEL_ID).catch(() => null);
    if (representativeChannel?.isTextBased()) return representativeChannel;

    if (guild.systemChannel?.isTextBased()) return guild.systemChannel;

    return guild.channels.cache.find(channel =>
        channel.isTextBased()
        && channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
    );
}

module.exports = {
    name: 'presenceUpdate',
    async execute(oldPresence, newPresence) {
        if (!newPresence?.guild || !hasRepresentativeStatus(newPresence)) return;

        const guild = newPresence.guild;
        const member = await guild.members.fetch(newPresence.userId).catch(() => null);
        if (!member || member.user.bot || member.roles.cache.has(REPRESENTATIVE_ROLE_ID)) return;

        const role = guild.roles.cache.get(REPRESENTATIVE_ROLE_ID)
            || await guild.roles.fetch(REPRESENTATIVE_ROLE_ID).catch(() => null);

        if (!role) {
            console.warn(`[WARN] GVA representative role ${REPRESENTATIVE_ROLE_ID} was not found in ${guild.name}.`);
            return;
        }

        try {
            await member.roles.add(role, 'Member has /gva or /gvavenue in their custom status');
        } catch (error) {
            console.error(`[ERROR] Could not give GVA representative role to ${member.user.tag}:`, error);
            return;
        }

        const channel = await findAnnouncementChannel(guild);
        if (!channel) {
            console.warn(`[WARN] No text channel found for GVA representative announcement in ${guild.name}.`);
            return;
        }

        try {
            await channel.send({
                content: `> <a:blue_heartburst:1493951094605353062>   Server Representative <a:blue_heartburst:1493951094605353062> 

<:gvry_ydot:1489356230785761382>  Thank You ${member} for supporting & being a proud representative of our server, Greenville Avenue™! You have been given the <@&${REPRESENTATIVE_ROLE_ID}> , which allows you to gain simple perks around the community!  
If you would like to receive these perks too, simply set your profile status as /gva, and you will be automatically roled by our bot!`,
                allowedMentions: {
                    users: [member.id],
                    roles: [REPRESENTATIVE_ROLE_ID],
                },
            });
        } catch (error) {
            console.error(`[ERROR] Could not send GVA representative announcement in ${guild.name}:`, error);
        }
    },
};
