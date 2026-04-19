function parseRoleIds(value) {
  if (Array.isArray(value)) {
    return value.map(String).map(v => v.trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map(roleId => roleId.trim())
    .filter(Boolean);
}

function getConfiguredRoleIds(...values) {
  return values.flatMap(parseRoleIds);
}

function memberHasAnyConfiguredRole(member, ...values) {
  const roleIds = getConfiguredRoleIds(...values);
  if (roleIds.length === 0) {
    return false;
  }

  return member.roles.cache.some(role => roleIds.includes(role.id));
}

module.exports = {
  parseRoleIds,
  getConfiguredRoleIds,
  memberHasAnyConfiguredRole,
};
