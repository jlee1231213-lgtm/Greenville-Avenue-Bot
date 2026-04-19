const Ticket = require('../models/tickets');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isAutocomplete()) return;

        if (interaction.commandName === 'payticket') {
            const userId = interaction.user.id;
            const focusedValue = interaction.options.getFocused();

            const tickets = await Ticket.find({ UserID: userId });
            const choices = tickets.map(t => ({
                name: `${t.Offense} - $${t.Price}`,
                value: t._id.toString()
            }));

            const filtered = choices
                .filter(c => c.name.toLowerCase().includes(focusedValue.toLowerCase()))
                .slice(0, 25);

            await interaction.respond(filtered);
        }
    }
};
