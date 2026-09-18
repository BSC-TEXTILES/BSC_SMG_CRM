const apiRoutes = require('./src/routes/api');
const workflowRoutes = require('./src/routes/workflowRoutes');

console.log('Workflow routes stack length:', workflowRoutes.stack.length);
workflowRoutes.stack.forEach(layer => {
  if (layer.route) console.log('  Route:', layer.route.path);
});

console.log('API routes stack length:', apiRoutes.stack.length);
apiRoutes.stack.forEach(layer => {
  if (layer.route && layer.route.path && layer.route.path.includes('workflow')) {
    console.log('  API Route:', layer.route.path);
  }
  if (layer.name === 'router' && layer.handle && layer.handle.stack) {
    layer.handle.stack.forEach(l => {
      if (l.route && l.route.path && l.route.path.includes('workflow')) {
        console.log('  nested:', l.route.path);
      }
    });
  }
});