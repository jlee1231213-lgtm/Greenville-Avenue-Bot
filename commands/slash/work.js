

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Eco = require('../../models/eco');
const Settings = require('../../models/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn some cash.'),

  async execute(interaction) {
    console.log("/work command triggered", {
      user: interaction.user?.id,
      guild: interaction.guild?.id
    });
    await interaction.deferReply();
    const { guild, user } = interaction;

    let settings;
    try {
      settings = await Settings.findOne({ guildId: guild.id });
    } catch (err) {
      console.error("Error fetching settings:", err);
      return await interaction.editReply({ content: '❌ Error fetching settings from database.' });
    }
    const embedColor = settings?.embedcolor || "#ff9933";

    const cooldownTime = 30 * 60 * 1000;
    const now = Date.now();

    const workScenarios = [
      "You mowed your neighbour's lawn and got",
      "You washed cars in your area and earned",
      "You delivered pizza around town and received",
      "You babysat for a family friend and got",
      "You fixed someone's computer and were paid",
      "You helped paint a fence and earned",
      "You sold lemonade at a stand and made",
      "You walked dogs for the neighbourhood and got",
      "You washed windows downtown and earned",
      "You helped move furniture and received",
      "You did grocery deliveries and earned",
      "You repaired bicycles and got",
      "You worked at a fast food place and earned",
      "You cut someone's hedges and made",
      "You shoveled snow from driveways and earned",
      "You cleaned someone's house and received",
      "You ran errands for someone and got",
      "You taught piano lessons and made",
      "You gave swimming lessons and earned",
      "You worked at the farmer's market and got",
      "You sold handmade crafts and received",
      "You volunteered at an event and were tipped",
      "You helped clean a garage and got",
      "You washed a truck fleet and earned",
      "You sorted mail and were paid",
      "You carried groceries for someone and earned",
      "You cleaned an office building and made",
      "You helped at a construction site and earned",
      "You taught a coding class and got",
      "You worked as a tour guide and earned",
      "You did photography for a party and received",
      "You sold snacks at the park and earned",
      "You drove a delivery van and made",
      "You helped repair a roof and earned",
      "You assisted at a local shop and got",
      "You worked in a coffee shop and earned",
      "You washed dishes in a restaurant and made",
      "You handed out flyers and earned",
      "You did landscaping for someone and got",
      "You worked at a bookstore and earned",
      "You helped organize a garage sale and made",
      "You repaired a video game console and got",
      "You fixed a phone screen and earned",
      "You helped decorate for an event and made",
      "You DJed a party and earned",
      "You washed boats at the dock and got",
      "You helped harvest crops and earned",
      "You assisted in a library and got",
      "You worked at a gas station and earned",
      "You helped clean public park benches and made",
      "You gave someone driving lessons and earned"
    ];

    const scenario = workScenarios[Math.floor(Math.random() * workScenarios.length)];

    let userEco = await Eco.findOne({ userId: user.id });
    if (!userEco) {
      userEco = new Eco({ userId: user.id });
    }

    const lastWorkAt = userEco.lastWork ? new Date(userEco.lastWork).getTime() : null;
    if (lastWorkAt && now - lastWorkAt < cooldownTime) {
      const remaining = cooldownTime - (now - lastWorkAt);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      console.log("/work cooldown active", { user: user.id, remaining });
      return await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(`You need to wait **${minutes}m ${seconds}s** before working again.`)
        ],
        ephemeral: true
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let workStreak = userEco.workStreak || 0;
    if (!lastWorkAt) {
      workStreak = 1;
    } else {
      const lastWorkDate = new Date(lastWorkAt);
      const lastWorkDay = new Date(lastWorkDate);
      lastWorkDay.setHours(0, 0, 0, 0);

      if (lastWorkDay.getTime() === yesterday.getTime()) {
        workStreak += 1;
      } else if (lastWorkDay.getTime() !== today.getTime()) {
        workStreak = 1;
      }
    }

    const baseAmount = Math.floor(Math.random() * (250 - 50 + 1)) + 50;
    const streakBonus = Math.min(workStreak * 5, 50);
    const totalAmount = baseAmount + streakBonus;

    userEco.cash += totalAmount;
    userEco.lastWork = new Date(now);
    userEco.workStreak = workStreak;
    await userEco.save();

    const embed = new EmbedBuilder()
      .setTitle("Work Results")
      .setDescription(`${scenario} **$${totalAmount}**!`)
      .setColor(embedColor)
      .addFields(
        { name: 'Base Pay', value: `$${baseAmount}`, inline: true },
        { name: 'Streak Bonus', value: `$${streakBonus}`, inline: true },
        { name: 'Work Streak', value: `${workStreak} day(s)`, inline: true }
      )
      .setFooter({ text: `Total Cash: $${userEco.cash}` });

    return await interaction.editReply({ embeds: [embed] });
  }
};
