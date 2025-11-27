const { exec } = require('child_process');
const path = require('path');

const distPath = path.join(__dirname, 'dist');
const port = process.env.PORT || 8080;

// Use vite preview
const vite = exec(`npx vite preview --port ${port} --host`, {
  cwd: __dirname,
  stdio: 'inherit'
});

vite.stdout?.pipe(process.stdout);
vite.stderr?.pipe(process.stderr);

vite.on('error', (err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  vite.kill();
  process.exit(0);
});
