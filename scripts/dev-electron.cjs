const { spawn } = require('child_process');
const path = require('path');
const electronModule = require('electron');

// Get the actual path to the electron binary
const electronPath = typeof electronModule === 'string' ? electronModule : require('electron');

const env = { ...process.env };
// CRITICAL: Unset this to ensure the binary runs as Electron, not Node
delete env.ELECTRON_RUN_AS_NODE;

console.log('[DevLauncher] Starting Electron...');
console.log('[DevLauncher] Electron Path:', electronPath);

const child = spawn(electronPath, [path.join(__dirname, '../electron/main.cjs')], {
  env,
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  console.log(`[DevLauncher] Electron exited with code ${code}`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('[DevLauncher] Failed to start Electron:', err);
  process.exit(1);
});
