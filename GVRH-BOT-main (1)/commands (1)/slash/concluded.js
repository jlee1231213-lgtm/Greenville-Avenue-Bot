const { SlashCommandBuilder } = require('discord.js');

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
        const imageUrl = 'https://media.discordapp.net/attachments/1450473391134871565/1492956124092039329/Screenshot_20260402_214940.jpg?ex=69dd373d&is=69dbe5bd&hm=9b392661e3f7da0bd7a522875f0d5adccf36e613e5d6f834fc04c81ffdb977b3&=&format=webp&width=2160&height=1046';
        const host = interaction.user;
        const startTime = interaction.options.getString('start_time');
        const endTime = interaction.options.getString('end_time');
        const duration = interaction.options.getString('duration');
        const notes = interaction.options.getString('notes') || 'No notes provided.';

        const content = [
            `<:gvry_ydot:1489356230785761382> Thank you for joining the session hosted by <@${host.id}>, we hope you had an enjoyable experience throughout the session!`,
            '',
            '<:green_arrow_recolor:1489356754570580069>**| Session Information**',
            `-# <:gvry_ydot:1489356230785761382> **Host:** <@${host.id}>`,
            `-# <:gvry_ydot:1489356230785761382> **Start Time:** ${startTime}`,
            `-# <:gvry_ydot:1489356230785761382> **End Time:** ${endTime}`,
            `-# <:gvry_ydot:1489356230785761382> **Duration:** \`${duration}\``,
            `-# <:gvry_ydot:1489356230785761382> **Notes:** ${notes}`,
            '',
            imageUrl
        ].join('\n');

        await interaction.reply({ content });
    },
};
