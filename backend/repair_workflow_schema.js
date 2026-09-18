/**
 * One-time repair for the workflow schema on an existing install:
 * - drops foreign keys referencing the legacy `user` table
 * - relaxes actor columns (nullable) for public/system submissions
 * Idempotent — safe to run repeatedly.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./src/config/db');

(async () => {
  const fixed = [];
  for (const wfTable of ['WorkflowInstance', 'ApprovalRequest', 'ApprovalHistory', 'WorkflowNotification']) {
    const [fks] = await pool.query(
      `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [wfTable]
    );
    for (const fk of fks) {
      if (/^user(s)?$/i.test(fk.REFERENCED_TABLE_NAME || '')) {
        try {
          await pool.query(`ALTER TABLE \`${wfTable}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
          fixed.push(`${wfTable}.${fk.CONSTRAINT_NAME} dropped`);
        } catch (e) {
          console.log('drop failed:', wfTable, fk.CONSTRAINT_NAME, e.message);
        }
      }
    }
  }
  for (const ddl of [
    'ALTER TABLE WorkflowInstance MODIFY COLUMN submittedBy INT NULL',
    'ALTER TABLE ApprovalHistory MODIFY COLUMN actionByUserId INT NULL',
    'ALTER TABLE WorkflowNotification MODIFY COLUMN recipientRole VARCHAR(100) NULL'
  ]) {
    try {
      await pool.query(ddl);
      fixed.push(ddl.slice(0, 70));
    } catch (e) {
      console.log('alter skipped:', e.message.slice(0, 100));
    }
  }
  console.log('REPAIRS APPLIED:\n' + fixed.join('\n'));
  process.exit(0);
})();
