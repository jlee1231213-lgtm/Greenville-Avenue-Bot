const { EmbedBuilder } = require('discord.js');
const Settings = require('../models/settings');
const SessionLog = require('../models/sessionlog');
const { memberHasAnyConfiguredRole } = require('../utils/roleHelpers');

function withTimeout(promise, fallbackValue, label) {
  let timeoutId;
  const timeout = new Promise(resolve => {
    timeoutId = setTimeout(() => {
      console.warn(`[WARN] staff profile ${label} timed out. Using fallback value.`);
      resolve(fallbackValue);
    }, 5000);
  });

  return Promise.race([promise, timeout])
    .catch(error => {
      console.warn(`[WARN] staff profile ${label} failed:`, error?.message || error);
      return fallbackValue;
    })
    .finally(() => clearTimeout(timeoutId));
}

async function safeDefer(interaction) {
  if (interaction.deferred || interaction.replied) return;

  await withTimeout(
    interaction.deferReply({ flags: 64 }),
    null,
    'defer reply'
  );
}

async function sendButtonResponse(interaction, payload) {
  let responsePromise;
  const editPayload = { ...payload };
  delete editPayload.flags;

  if (interaction.deferred) {
    responsePromise = interaction.editReply(editPayload);
  } else if (interaction.replied) {
    responsePromise = interaction.followUp({ ...payload, flags: 64 });
  } else {
    responsePromise = interaction.reply({ ...payload, flags: 64 });
  }

  return withTimeout(responsePromise, null, 'button response');
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const [prefix, type, userId] = interaction.customId.split('_');
    if (prefix !== 'staffprofile') return;

    try {
      await safeDefer(interaction);

      const guildId = interaction.guild.id;
      const settings = await withTimeout(
        Settings.findOne({ guildId }).lean().exec(),
        null,
        'settings lookup'
      );
      const embedColor = settings?.embedcolor || '#ab6cc4';
      const isViewingSelf = interaction.user.id === userId;
      const canViewOthers = memberHasAnyConfiguredRole(interaction.member, settings?.staffRoleId, settings?.adminRoleId);

      if (!isViewingSelf && !canViewOthers) {
        return sendButtonResponse(interaction, {
          content: "You can't view another user's staff profile history.",
        });
      }

      if (type === 'sessions') {
        const sessions = await withTimeout(
          SessionLog.find({ guildId, userId, sessiontype: 'session' })
            .sort({ timestarted: -1 })
            .limit(11)
            .maxTimeMS(5000)
            .lean()
            .exec(),
          [],
          'hosted sessions lookup'
        );
        const description = sessions.length
          ? sessions.map(s => {
              const start = s.timestarted.toLocaleString();
              const end = s.timeended ? s.timeended.toLocaleString() : 'Still Active';
              const duration = s.timeended ? ((s.timeended - s.timestarted)/1000).toFixed(0)+'s' : 'N/A';
              return `• **Started:** ${start} | **Ended:** ${end} | **Duration:** ${duration}`;
            }).join('\n')
          : 'No session records found.';

        const embed = new EmbedBuilder()
          .setTitle(`Sessions (${sessions.length})`)
          .setDescription(description)
          .setColor(embedColor);

        await sendButtonResponse(interaction, { embeds: [embed] });
      }

      if (type === 'cohost') {
        const cohosts = await withTimeout(
          SessionLog.find({ guildId, userId, sessiontype: 'cohost' })
            .sort({ timestarted: -1 })
            .limit(11)
            .maxTimeMS(5000)
            .lean()
            .exec(),
          [],
          'cohost sessions lookup'
        );
        const description = cohosts.length
          ? cohosts.map(s => {
              const start = s.timestarted.toLocaleString();
              const end = s.timeended ? s.timeended.toLocaleString() : 'Still Active';
              const duration = s.timeended ? ((s.timeended - s.timestarted)/1000).toFixed(0)+'s' : 'N/A';
              return `• **Started:** ${start} | **Ended:** ${end} | **Duration:** ${duration}`;
            }).join('\n')
          : 'No cohost records found.';

        const embed = new EmbedBuilder()
          .setTitle(`Cohost Sessions (${cohosts.length})`)
          .setDescription(description)
          .setColor(embedColor);

        await sendButtonResponse(interaction, { embeds: [embed] });
      }
    } catch (error) {
      console.error('Error handling staff profile interaction:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: 'Something went wrong while loading this staff profile view.' }).catch(() => {});
      } else {
        await interaction.reply({ content: 'Something went wrong while loading this staff profile view.', flags: 64 }).catch(() => {});
      }
    }
  }
};
