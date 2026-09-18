const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/workflow/definitions',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => process.stdout.write(chunk));
  res.on('end', () => console.log('\nStatus:', res.statusCode));
});
req.on('error', e => console.error('Error:', e.message));
req.end();