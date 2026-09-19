const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'u101820758_bsc_smg_crm',
    password: 'Btpldvg@2026',
    database: 'u101820758_bsc_smg'
  });
  
  const hash = await bcrypt.hash('Test@2026', 10);
  console.log('New hash for Test@2026:', hash);
  
  await conn.query("UPDATE users SET password = ? WHERE email = 'test@gmail.com'", [hash]);
  console.log('Password updated for test@gmail.com in users table.');
  
  await conn.query("UPDATE User SET password = ? WHERE email = 'test@gmail.com'", [hash]);
  console.log('Password updated for test@gmail.com in User table (if exists).');
  
  conn.end();
}

run().catch(console.error);
