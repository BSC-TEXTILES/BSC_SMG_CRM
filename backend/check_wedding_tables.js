const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'u101820758_bsc_smg_crm', password: 'Btpldvg@2026', database: 'u101820758_bsc_smg' });
  const [tables] = await conn.query('SHOW TABLES LIKE "%wedding%"');
  console.log(tables);
  conn.end();
}
run().catch(console.error);
