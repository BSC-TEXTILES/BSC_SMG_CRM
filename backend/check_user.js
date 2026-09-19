const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'u101820758_bsc_smg_crm',
    password: 'Btpldvg@2026',
    database: 'u101820758_bsc_smg'
  });
  const [rows] = await conn.query("SELECT * FROM users WHERE email = 'test@gmail.com' OR username = 'test@gmail.com'");
  console.log(rows);
  conn.end();
}
run().catch(console.error);
