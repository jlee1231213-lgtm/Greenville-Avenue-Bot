const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Settings = require('../../models/settings');
const SessionLog = require('../../models/sessionlog');

function withTimeout(promise, fallbackValue, label) {
  let timeoutId;
  const timeout = new Promise(resolve => {
    timeoutId = setTimeout(() => {
      console.warn(`[WARN] /staff-profile ${label} timed out. Using fallback value.`);
      resolve(fallbackValue);
    }, 5000);
  });

  return Promise.race([promise, timeout])
    .catch(error => {
      console.warn(`[WARN] /staff-profile ${label} failed:`, error?.message || error);
      return fallbackValue;
    })
    .finally(() => clearTimeout(timeoutId));
}

async function safeDefer(interaction) {
  if (interaction.deferred || interaction.replied) return;

  await withTimeout(
    interaction.deferReply(),
    null,
    'defer reply'
  );
}

async function sendProfileResponse(interaction, payload) {
  let responsePromise;

  if (interaction.deferred) {
    responsePromise = interaction.editReply(payload);
  } else if (interaction.replied) {
    responsePromise = interaction.followUp({ ...payload, flags: 64 });
  } else {
    responsePromise = interaction.reply(payload);
  }

  return withTimeout(responsePromise, null, 'profile response');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-profile')
    .setDescription('Show a staff member\'s profile')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Staff member to check')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction);

    const user = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guild.id;
    const settings = await withTimeout(
      Settings.findOne({ guildId }).lean().exec(),
      null,
      'settings lookup'
    );
    const embedColor = settings?.embedcolor || '#ffffff';

    const [sessionCount, cohostCount] = await Promise.all([
      withTimeout(
        SessionLog.countDocuments({ guildId, userId: user.id, sessiontype: 'session' }).maxTimeMS(5000).exec(),
        0,
        'hosted session count'
      ),
      withTimeout(
        SessionLog.countDocuments({ guildId, userId: user.id, sessiontype: 'cohost' }).maxTimeMS(5000).exec(),
        0,
        'cohost session count'
      ),
    ]);

    const embed = new EmbedBuilder()
      .setTitle(`Staff Profile - ${user.tag}`)
      .setDescription(`**User:** <@${user.id}>\n**UserID**: ${user.id}\n\n**Sessions Hosted:** ${sessionCount}\n**Sessions Co-Hosted:** ${cohostCount}`)
      .setColor(embedColor)
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL() || undefined });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staffprofile_sessions_${user.id}`)
        .setLabel('Hosted Session(s)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`staffprofile_cohost_${user.id}`)
        .setLabel('Co-Hosted Session(s)')
        .setStyle(ButtonStyle.Secondary)
    );

    await sendProfileResponse(interaction, { embeds: [embed], components: [buttons] });
  }
};
