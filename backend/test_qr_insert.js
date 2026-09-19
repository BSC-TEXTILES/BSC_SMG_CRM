const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'u101820758_bsc_smg_crm',
    password: 'Btpldvg@2026',
    database: 'u101820758_bsc_smg'
  });
  
  try {
    const id = 'id_test_123';
    const qrCodeId = 'QR-001';
    const name = "BSC-TEXTILES's Org";
    const description = '';
    const locationId = 1;
    const locationCode = 'BEL';
    const locationName = 'Belagavi';
    const sectionId = null;
    const sectionName = 'Kids';
    const feedbackFormId = null;
    const targetUrl = 'https://bsctextiles.in/feedback-public?qr=QR-001';
    const qrCodeDataUrl = '';
    const qrCodeSvg = '';
    const status = 'active';
    const createdBy = 1;
    const createdByName = 'System';
    
    await conn.query(`
      INSERT INTO FeedbackQrCode (
        id, qrCodeId, name, description, locationId, locationCode, locationName,
        sectionId, sectionName, feedbackFormId, targetUrl, qrCodeDataUrl, qrCodeSvg,
        status, createdBy, createdByName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, qrCodeId, name, description, locationId, locationCode, locationName,
      sectionId, sectionName, feedbackFormId, targetUrl,
      qrCodeDataUrl, qrCodeSvg, status, createdBy, createdByName
    ]);
    
    console.log('Inserted successfully!');
  } catch(e) {
    console.error('Error inserting:', e);
  }
  
  conn.end();
}

run().catch(console.error);
