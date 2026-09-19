const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'u101820758_bsc_smg_crm',
    password: 'Btpldvg@2026',
    database: 'u101820758_bsc_smg'
  });
  
  try {
    await conn.query("ALTER TABLE FeedbackQrCode DROP FOREIGN KEY feedbackqrcode_ibfk_1");
    console.log("Dropped foreign key");
  } catch(e) {
    console.log(e.message);
  }
  
  try {
    await conn.query("ALTER TABLE FeedbackQrCode ADD CONSTRAINT feedbackqrcode_ibfk_1 FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE RESTRICT");
    console.log("Added foreign key to locations");
  } catch(e) {
    console.log(e.message);
  }
  
  conn.end();
}
run().catch(console.error);
