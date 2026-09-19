const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'u101820758_bsc_smg_crm',
    password: 'Btpldvg@2026',
    database: 'u101820758_bsc_smg'
  });
  const [rows] = await conn.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = 'u101820758_bsc_smg' AND TABLE_NAME = 'FeedbackQrCode' AND COLUMN_NAME = 'locationId'");
  console.log(rows);
  conn.end();
}
run().catch(console.error);
