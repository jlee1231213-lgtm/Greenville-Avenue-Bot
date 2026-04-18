
const Vehicle = require('../models/vehicle');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isAutocomplete() && interaction.commandName === 'unregister') {
            const userId = interaction.user.id;
            const focusedValue = interaction.options.getFocused() || "";

            const vehicles = await Vehicle.find({ UserID: userId });
            const vehicleNames = vehicles
                .map(v => `${v.brand} ${v.model} (${v.year})`)
                .filter(v => typeof v === 'string');

            const filtered = vehicleNames
                .filter(v => v.toLowerCase().includes(focusedValue.toLowerCase()))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(v => ({ name: v, value: v }))
            );
        }
    }
};
