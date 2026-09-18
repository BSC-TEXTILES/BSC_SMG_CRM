const db = require('./backend/src/config/db');
const userMgmtController = require('./backend/src/controllers/userManagementController');
const bcrypt = require('bcryptjs');
const userSyncService = require('./backend/src/services/userSyncService');

async function run() {
  try {
    const username = 'testuser123';
    const password = 'password123';
    const role = 'HR';
    const fullName = 'Test User';
    
    // Simulate req, res
    const req = {
      body: { username, password, role, fullName },
      ip: '127.0.0.1',
      user: { username: 'admin' }
    };
    
    const res = {
      status: (code) => ({ json: (data) => console.log('Status', code, data) }),
      json: (data) => console.log('Response:', data)
    };
    
    // Test the validation first
    const { validateCreateUser } = require('./backend/src/validators/userValidator');
    await new Promise((resolve) => {
      validateCreateUser(req, res, resolve);
    });

    console.log("Validation passed");
    await userMgmtController.createUser(req, res);
  } catch (err) {
    console.error("Test failed:", err);
  }
  process.exit();
}

run();
