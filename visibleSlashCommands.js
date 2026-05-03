const VISIBLE_SLASH_COMMANDS = new Set([
    'startup',
    'setup',
    'hatepings',
    'cohost',
    'release',
    'register',
    'role',
    'reinvites',
    'concluded',
    'ea',
    'ticket',
    'ticketsupport',
    'ban',
    'settings',
    'sendembed',
    'quotaembed',
    'embed',
    'say',
    'staff-profile',
    'unregister',
    'payticket',
    'work',
    'balance',
    'deposit',
    'withdraw',
    'rob',
    'slut',
    'leaderboard',
    'collect',
]);

function isVisibleSlashCommand(commandName) {
    return VISIBLE_SLASH_COMMANDS.has(commandName);
}

module.exports = {
    VISIBLE_SLASH_COMMANDS,
    isVisibleSlashCommand,
};
