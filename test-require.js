// Minimal test to check if Node.js can require models/settings.js
try {
  const Settings = require('./models/settings');
  console.log('SUCCESS: settings.js loaded');
  console.log(Settings);
} catch (err) {
  console.error('FAIL:', err);
  process.exit(1);
}
