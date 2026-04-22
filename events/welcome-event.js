
const { EmbedBuilder } = require('discord.js');
const Settings = require('../models/settings');

const DEFAULT_WELCOME_DESCRIPTION = `> <:GVA:1489357718748659803> **__Welcome to Greenville Avenue__**

<:gvry_ygift:1489355964472627330> **__{user}__ Welcome To Greenville Avenue, Greenville Roleplay Server! Enjoy your stay, we hope you have an amazing experience!**

> <:gvry_ygift:1489355964472627330> **Make sure, to contact us via <#1443224411745292365> of Greenville Avenue! We read support requests, every day!**`;

const DEFAULT_WELCOME_IMAGE = 'https://cdn.discordapp.com/attachments/1474852098842820853/1489331686117212271/Screenshot_20260402_213214.jpg?ex=69d007b8&is=69ceb638&hm=f70c020ea32590f2b8957481a4103b31bcf02817376307a6b2b4ee2cd2014c1f&';

function extractChannelId(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/\d{17,20}/);
  return match ? match[0] : null;
}

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    if (!member.guild) return;

    const settings = await Settings.findOne({ guildId: member.guild.id });
    if (!settings || !settings.welcomechannelid) return;

    const channelId = extractChannelId(settings.welcomechannelid);
    if (!channelId) {
      console.warn(`[WARN] Invalid welcomechannelid for guild ${member.guild.id}: ${settings.welcomechannelid}`);
      return;
    }

    let channel = member.guild.channels.cache.get(channelId);
    if (!channel) {
      channel = await member.guild.channels.fetch(channelId).catch(() => null);
    }
    if (!channel || !channel.isTextBased()) {
      console.warn(`[WARN] Welcome channel not found or not text-based for guild ${member.guild.id}: ${channelId}`);
      return;
    }

    const embedData = settings.welcomeEmbed || {};
    const color = settings.embedcolor || '#ffffff';
    const userMention = `<@${member.id}>`;

    const title = embedData.title
      ? embedData.title.replace(/\$date/g, new Date().toLocaleDateString())
                       .replace(/\{user\}|\$user/g, userMention)
      : null;

    const description = embedData.description
      ? embedData.description.replace(/\$date/g, new Date().toLocaleDateString())
                             .replace(/\{user\}|\$user/g, userMention)
      : DEFAULT_WELCOME_DESCRIPTION.replace(/\{user\}|\$user/g, userMention);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description);

    if (title) {
      embed.setTitle(title);
    }

    const imageUrl = embedData.image || DEFAULT_WELCOME_IMAGE;
    if (typeof imageUrl === 'string' && /^https?:\/\//.test(imageUrl)) {
      embed.setImage(imageUrl);
    }

    channel.send({ content: userMention, embeds: [embed] }).catch(error => {
      console.error(`[ERROR] Failed to send welcome message in guild ${member.guild.id}:`, error?.message || error);
    });
  }
};
