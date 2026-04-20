const DEFAULT_STARTUP_EMBED = {
  title: '<:gvry_Ypin:1489356357735026778> __**Greenville Avenue – Session Start Up**__',
  description: `<:green_arrow_recolor:1489356754570580069>  $user is currently hosting a Greenville Avenue session.

All participants are required to carefully review and understand the Server Documentation, which outlines all session rules and expectations.

<:green_arrow_recolor:1489356754570580069>  Ensure you are not operating any prohibited vehicles unless you have been granted the appropriate permissions.

<:green_arrow_recolor:1489356754570580069>  Confirm that your Roblox account is properly verified with Greenville Avenue to prevent removal during checkpoint procedures.

-# Please note that a minimum of $reactions+ reactions is required before the session can officially proceed to the preparation phase.`,
  image: 'https://media.discordapp.net/attachments/1450473391134871565/1489434330404225164/Screenshot_20260402_213804.jpg?ex=69e62810&is=69e4d690&hm=a988d334b024c609e50857fa17c488fbc497bdafb4e7f15cd7b1d35080c0b891&=&format=webp&width=2160&height=1056',
};

const DEFAULT_SETUP_EMBED = {
  title: '> <a:loading:1495624404053262406> **Greenville Avenue, Setup!** <a:loading:1495624404053262406>',
  description: '<a:arrow3:1489298553942708364> $user is officially setting up! Please do **NOT** ping the host. Please patiently wait for the **Host** to release Early Access for server boosters, staff team, public services, and anyone with the Early Access role. This setup should take roughly **5-10** minutes until Early Access. Please wait until then.',
};

const DEFAULT_RELEASE_EMBED = {
  title: '<:blue_exclamation:1489356851782090904> **__Greenville Avenue — Session Release__**',
  description: `$user has officially released the roleplay session.
Before joining, all participants must review the Banned Vehicle List and ensure full compliance with all session rules and guidelines.

<:green_arrow_recolor:1489356754570580069> Session Details:
- Host: $user
- Peacetime Status: $pt
- FRP Speed Limit: $frplimit
- Law Enforcement Status: $leo

-# <:bell_tts:1489640619318968531>  Failure to comply with session rules may result in moderation actions.`,
  image: 'https://media.discordapp.net/attachments/1489657569030049844/1495495694700777542/Screenshot_20260419_214551.jpg?ex=69e67466&is=69e522e6&hm=20e0b4ecf6b358d8f706262befbfaab9d841a028fbc19feda21a97b951ef184d&=&format=webp&width=2160&height=908',
};

const DEFAULT_COHOST_EMBED = {
  title: '**__Greenville Avenue – Co-Host Notice__**',
  description: `<:green_arrow_recolor:1489356754570580069> $user has been assigned as the co-host for this session.
In the event the host is unavailable, please direct any questions or requests for assistance to the co-host.`,
};

const DEFAULT_EA_EMBED = {
  title: '<:blue_earlyentry:1493951246770372689> **__Greenville Avenue — Early Access Announcement__**',
  description: `<:green_arrow_recolor:1489356754570580069> $user has officially launched Early Access for the Greenville Avenue experience.

Members who have been granted access may now begin joining the session. Upon entry, please park your vehicle and remain stationary while awaiting further instructions from the host.
Please note that sharing this access link with individuals who are not authorized is strictly prohibited and will result in immediate moderation actions.`,
  image: 'https://media.discordapp.net/attachments/1450473391134871565/1489434331620573385/Screenshot_20260402_211715.jpg?ex=69e6d0d1&is=69e57f51&hm=a77f1f9b06b50de8d05ee12a0886ac7a98a75203afd0193d33a29b79e849c949&=&format=webp&width=2160&height=1030',
};

function isPlaceholderEmbed(embed, legacyTitle, legacyDescription) {
  if (!embed) return true;

  const title = String(embed.title || '').trim();
  const description = String(embed.description || '').trim();
  const normalizedTitle = title.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  const placeholderValues = new Set(['test', 'test test', 'testing', 'n/a']);

  return (
    !title ||
    !description ||
    (legacyTitle && legacyDescription && title === legacyTitle && description === legacyDescription) ||
    placeholderValues.has(normalizedTitle) ||
    placeholderValues.has(normalizedDescription)
  );
}

function isLegacyStartupEmbed(embed) {
  return isPlaceholderEmbed(embed, 'Startup Session Started by $user', 'React with ✅ to join the session!');
}

function isLegacyReleaseEmbed(embed) {
  return isPlaceholderEmbed(embed);
}

function isLegacySetupEmbed(embed) {
  const title = String(embed?.title || '');

  if (title.includes('1489298699669737482')) return true;

  return isPlaceholderEmbed(
    embed,
    '> <a:load:1489298699669737482> **Greenville Avenue, Setup!**<a:load:1489298699669737482>',
    '<a:arrow3:1489298553942708364> {user} is offically setting up! Please do **NOT** ping host. Please patiently wait for **Host** to release early access for, server boosters, staff team, and public services and anyone with the early access role. This setup should take roguhly **5-10** minutes untill Early Access. Please wait untill then.'
  );
}

function getDefaultEmbed(field) {
  if (field === 'startupEmbed') {
    return { ...DEFAULT_STARTUP_EMBED };
  }
  if (field === 'setupEmbed') {
    return { ...DEFAULT_SETUP_EMBED };
  }
  if (field === 'cohostEmbed') {
    return { ...DEFAULT_COHOST_EMBED };
  }
  if (field === 'eaEmbed') {
    return { ...DEFAULT_EA_EMBED };
  }
  if (field === 'releaseEmbed') {
    return { ...DEFAULT_RELEASE_EMBED };
  }

  return {};
}

module.exports = {
  DEFAULT_COHOST_EMBED,
  DEFAULT_EA_EMBED,
  DEFAULT_RELEASE_EMBED,
  DEFAULT_SETUP_EMBED,
  DEFAULT_STARTUP_EMBED,
  getDefaultEmbed,
  isLegacyReleaseEmbed,
  isLegacySetupEmbed,
  isLegacyStartupEmbed,
};
