const pool = require('./src/config/db');

async function fixDuplicateUsers() {
  try {
    console.log('Checking for duplicate users...');
    
    // Get all users
    const [users] = await pool.query('SELECT id, username, full_name, email, role, location_id, active, last_login_at, created_at FROM users ORDER BY username');
    console.log('Current users:');
    console.table(users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, active: u.active, last_login: u.last_login_at })));
    
    // Define duplicates to fix (keep the email-based username, deactivate the short username)
    const duplicates = [
      { keep: 'admin@bsctextiles.com', remove: 'admin' },
      { keep: 'greeter@bsctextiles.com', remove: 'greeter' },
      // Check if hr and manager also have duplicates
    ];
    
    // Check for hr duplicates
    const [hrUsers] = await pool.query("SELECT username FROM users WHERE username IN ('hr', 'hr@bsctextiles.com')");
    if (hrUsers.length === 2) {
      duplicates.push({ keep: 'hr@bsctextiles.com', remove: 'hr' });
    }
    
    // Check for manager duplicates
    const [mgrUsers] = await pool.query("SELECT username FROM users WHERE username IN ('manager', 'manager@bsctextiles.com')");
    if (mgrUsers.length === 2) {
      duplicates.push({ keep: 'manager@bsctextiles.com', remove: 'manager' });
    }
    
    console.log('\nDuplicate pairs to fix:');
    console.log(duplicates);
    
    for (const pair of duplicates) {
      const [keepUser] = await pool.query('SELECT id, username, last_login_at FROM users WHERE username = ?', [pair.keep]);
      const [removeUser] = await pool.query('SELECT id, username, last_login_at FROM users WHERE username = ?', [pair.remove]);
      
      if (keepUser.length === 0) {
        console.log(`⚠ Keep user ${pair.keep} not found, skipping`);
        continue;
      }
      if (removeUser.length === 0) {
        console.log(`⚠ Remove user ${pair.remove} not found, skipping`);
        continue;
      }
      
      console.log(`\nProcessing: keep=${pair.keep} (id=${keepUser[0].id}, last_login=${keepUser[0].last_login_at}), remove=${pair.remove} (id=${removeUser[0].id}, last_login=${removeUser[0].last_login_at})`);
      
      // Deactivate the duplicate (soft delete - set active=0)
      await pool.query('UPDATE users SET active = 0 WHERE id = ?', [removeUser[0].id]);
      console.log(`✓ Deactivated user ${pair.remove} (id=${removeUser[0].id})`);
      
      // Also remove from user_locations if exists
      try {
        await pool.query('DELETE FROM user_locations WHERE user_id = ?', [removeUser[0].id]);
        console.log(`✓ Removed user_locations for ${pair.remove}`);
      } catch (e) {
        console.log(`⚠ user_locations cleanup: ${e.message}`);
      }
      
      // Also remove from user_permissions if exists
      try {
        await pool.query('DELETE FROM user_permissions WHERE user_id = ?', [removeUser[0].id]);
        console.log(`✓ Removed user_permissions for ${pair.remove}`);
      } catch (e) {
        console.log(`⚠ user_permissions cleanup: ${e.message}`);
      }
    }
    
    console.log('\nVerifying remaining active users...');
    const [activeUsers] = await pool.query('SELECT id, username, full_name, email, role, active, last_login_at FROM users WHERE active = 1 ORDER BY username');
    console.table(activeUsers);
    
    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

fixDuplicateUsers();