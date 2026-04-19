const DEFAULT_STARTUP_EMBED = {
  title: '<:gvry_Ypin:1489356357735026778> __**Greenville Avenue – Session Start Up**__',
  description: `<:green_arrow_recolor:1489356754570580069>  $user is currently hosting a Greenville Avenue session.

All participants are required to carefully review and understand the Server Documentation, which outlines all session rules and expectations.

<:green_arrow_recolor:1489356754570580069>  Ensure you are not operating any prohibited vehicles unless you have been granted the appropriate permissions.

<:green_arrow_recolor:1489356754570580069>  Confirm that your Roblox account is properly verified with Greenville Avenue to prevent removal during checkpoint procedures.

-# Please note that a minimum of $reactions+ reactions is required before the session can officially proceed to the preparation phase.`,
  image: 'https://media.discordapp.net/attachments/1450473391134871565/1489434330404225164/Screenshot_20260402_213804.jpg?ex=69e62810&is=69e4d690&hm=a988d334b024c609e50857fa17c488fbc497bdafb4e7f15cd7b1d35080c0b891&=&format=webp&width=2160&height=1056',
};

function getDefaultEmbed(field) {
  if (field === 'startupEmbed') {
    return { ...DEFAULT_STARTUP_EMBED };
  }

  return {};
}

module.exports = {
  DEFAULT_STARTUP_EMBED,
  getDefaultEmbed,
};
