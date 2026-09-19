const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'u101820758_bsc_smg_crm',
    password: 'Btpldvg@2026',
    database: 'u101820758_bsc_smg'
  });
  const [rows1] = await conn.query("SHOW TABLES LIKE 'user'");
  const [rows2] = await conn.query("SHOW TABLES LIKE 'users'");
  console.log('user:', rows1);
  console.log('users:', rows2);
  conn.end();
}
run().catch(console.error);
