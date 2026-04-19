const VISIBLE_SLASH_COMMANDS = new Set([
    'startup',
    'setup',
    'cohost',
    'release',
    'register',
    'concluded',
    'ea',
    'ticket',
    'ticketsupport',
    'ban',
    'settings',
    'sendembed',
    'embed',
    'say',
    'staff-profile',
    'unregister',
    'payticket',
    'work',
    'balance',
]);

function isVisibleSlashCommand(commandName) {
    return VISIBLE_SLASH_COMMANDS.has(commandName);
}

module.exports = {
    VISIBLE_SLASH_COMMANDS,
    isVisibleSlashCommand,
};
