const db = require('./src/config/db');
const feedbackQrController = require('./src/controllers/feedbackQrController');

async function run() {
  const req = {
    user: { id: 1, role: 'Super Admin', isGlobalAdmin: true, fullName: 'System' },
    body: {
      name: "BSC-TEXTILES's Org",
      description: 'Optional description for internal reference',
      locationId: '1',
      locationCode: 'BEL',
      locationName: 'Belagavi',
      sectionId: '',
      sectionName: 'Kids',
      feedbackFormId: '',
      status: 'active'
    },
    ip: '127.0.0.1'
  };

  const res = {
    status: function(code) {
      console.log('Status set to:', code);
      return this;
    },
    json: function(data) {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  };

  try {
    await feedbackQrController.createQrCode(req, res);
  } catch(e) {
    console.error('Crash:', e);
  }
  
  db.end();
}

run().catch(console.error);
