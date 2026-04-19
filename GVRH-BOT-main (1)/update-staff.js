const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const result = await db.collection('settings').updateOne(
      { guildId: '1489657568157765674' },
      { $set: { staffRoleId: '1489732067758440449' } },
      { upsert: true }
    );
    
    console.log('✓ Staff role ID updated to 1489732067758440449');
    console.log('Matched:', result.matchedCount, 'Modified:', result.modifiedCount);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
