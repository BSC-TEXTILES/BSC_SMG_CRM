const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'u101820758_bsc_smg_crm',
    password: 'Btpldvg@2026',
    database: 'u101820758_bsc_smg'
  });
  try {
    const [rows] = await conn.query("SELECT qrCodeId FROM FeedbackQrCode WHERE qrCodeId REGEXP '^QR-[0-9]+$' AND LENGTH(qrCodeId) <= 7 ORDER BY CAST(SUBSTRING(qrCodeId, 4) AS UNSIGNED) DESC LIMIT 1");
    console.log(rows);
  } catch(e) {
    console.error('Error:', e.message);
  }
  conn.end();
}
run().catch(console.error);
