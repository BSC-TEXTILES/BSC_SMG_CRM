const db = require('./backend/src/config/db');
async function fix() {
  try {
    await db.query("ALTER TABLE users ADD COLUMN section VARCHAR(150) NULL");
    console.log("Added section");
  } catch(e) { console.log(e.message) }
  try {
    await db.query("ALTER TABLE users ADD COLUMN joining_date DATE NULL");
    console.log("Added joining_date");
  } catch(e) { console.log(e.message) }
  process.exit();
}
fix();
