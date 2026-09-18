const apiRoutes = require('./src/routes/api');

console.log('Checking workflow routes in API routes...');
apiRoutes.stack.forEach(function(layer) {
  if (layer.route && layer.route.path && layer.route.path.includes('workflow')) {
    console.log('  Direct route:', layer.route.path, layer.route.methods);
  }
  if (layer.name === 'router' && layer.handle && layer.handle.stack) {
    layer.handle.stack.forEach(function(l) {
      if (l.route && l.route.path && l.route.path.includes('workflow')) {
        console.log('  Nested route:', l.route.path, l.route.methods);
      }
    });
  }
});