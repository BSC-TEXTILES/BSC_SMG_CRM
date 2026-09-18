const pool = require('./src/config/db');

async function fixMissingEmails() {
  try {
    console.log('Fixing missing emails...');
    
    // Fix hr@bsctextiles.com email
    await pool.query('UPDATE users SET email = ? WHERE username = ?', ['hr@bsctextiles.com', 'hr@bsctextiles.com']);
    console.log('✓ Fixed email for hr@bsctextiles.com');
    
    // Fix manager@bsctextiles.com email
    await pool.query('UPDATE users SET email = ? WHERE username = ?', ['manager@bsctextiles.com', 'manager@bsctextiles.com']);
    console.log('✓ Fixed email for manager@bsctextiles.com');
    
    // Deactivate testuser123 (test account)
    await pool.query('UPDATE users SET active = 0 WHERE username = ?', ['testuser123']);
    console.log('✓ Deactivated testuser123');
    
    // Verify
    const [users] = await pool.query('SELECT id, username, full_name, email, role, active FROM users WHERE active = 1 ORDER BY username');
    console.log('\nActive users after fixes:');
    console.table(users);
    
    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

fixMissingEmails();