const { execSync } = require('child_process');
const PORT = process.env.PORT || 8210;

try {
  // Use serve for more reliable static file serving
  execSync(`npx serve dist -l ${PORT} -s`, { 
    stdio: 'inherit',
    cwd: __dirname
  });
} catch (error) {
  console.error('Failed to start server:', error.message);
  process.exit(1);
}
