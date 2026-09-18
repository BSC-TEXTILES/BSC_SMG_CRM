const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/workflow/definitions',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => console.log('DATA:', chunk.toString()));
  res.on('end', () => console.log('Status:', res.statusCode));
});
req.on('error', e => console.error('Error:', e.message));
req.end();