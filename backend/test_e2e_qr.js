const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  // 1. Login
  const loginData = JSON.stringify({
    username: 'admin@bsctextiles.com',
    password: 'bsc@123'
  });
  
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);
  
  console.log('Login Response:', loginRes.statusCode, loginRes.data);
  const loginJson = JSON.parse(loginRes.data);
  const token = loginJson.token;
  
  if (!token) {
    console.error('No token received');
    return;
  }
  
  // 2. Create QR Code
  const qrData = JSON.stringify({
    name: "BSC-TEXTILES's Org",
    description: "Optional description for internal reference",
    locationId: 1,
    locationCode: "BEL",
    locationName: "Belagavi",
    sectionId: "",
    sectionName: "Kids",
    feedbackFormId: "",
    status: "active"
  });
  
  const qrRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/feedback-qr',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(qrData)
    }
  }, qrData);
  
  console.log('Create QR Response:', qrRes.statusCode, qrRes.data);
}

run().catch(console.error);
