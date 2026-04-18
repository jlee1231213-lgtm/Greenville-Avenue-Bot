const Settings = require('../models/settings');
const Vehicle = require('../models/vehicle');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {

        if (interaction.isAutocomplete() && interaction.commandName === 'register') {
            const guildId = interaction.guild.id;
            const focusedValue = interaction.options.getFocused();
            const settings = await Settings.findOne({ guildId });
            const vehicleList = settings?.vehiclelist?.split('\n').map(v => v.trim()) || [];

            const filtered = vehicleList.filter(v => v.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
            await interaction.respond(
                filtered.map(v => ({ name: v, value: v }))
            );
        }

    }
};
