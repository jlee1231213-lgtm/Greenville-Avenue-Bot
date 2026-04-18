
const { EmbedBuilder } = require('discord.js');
const Settings = require('../models/settings');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    if (!member.guild) return;

    const settings = await Settings.findOne({ guildId: member.guild.id });
    if (!settings || !settings.welcomechannelid) return;

    const channel = member.guild.channels.cache.get(settings.welcomechannelid);
    if (!channel) return;

    const embedData = settings.welcomeEmbed || {};
    const color = settings.embedcolor || '#ffffff';

    const title = embedData.title
      ? embedData.title.replace(/\$date/g, new Date().toLocaleDateString())
                       .replace(/\$user/g, `<@${member.id}>`)
      : 'Welcome!';

    const description = embedData.description
      ? embedData.description.replace(/\$date/g, new Date().toLocaleDateString())
                             .replace(/\$user/g, `<@${member.id}>`)
      : `Hello <@${member.id}>, welcome to the server!`;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description);

    if (embedData.image) embed.setImage(embedData.image);

    channel.send({ embeds: [embed] }).catch(() => {});
  }
};
