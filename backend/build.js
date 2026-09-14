const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[Build] Starting client build...');
execSync('cd ../frontend && npm install --legacy-peer-deps && npm run build', {stdio: 'inherit'});

const src = '../frontend/dist';
if (fs.existsSync(src)) {
    // Always force-overwrite the dist folder to ensure UI updates are deployed
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.cpSync(src, 'dist', { recursive: true });
    console.log('[Build] Copied client build to dist/');

    // Mirror to root dist if needed
    const rootDist = path.join(__dirname, '..', 'dist');
    try {
        if (fs.existsSync(rootDist)) fs.rmSync(rootDist, { recursive: true, force: true });
        fs.cpSync(src, rootDist, { recursive: true });
        console.log('[Build] Copied client build to root dist/');
    } catch (e) {}
} else {
    console.warn('[Build] Warning: Client build directory not found at:', src);
}

// Touch restart.txt to signal Passenger/Hostinger to reload Node.js
try {
    const tmpDirs = [
        path.join(__dirname, 'tmp'),
        path.join(__dirname, '..', 'tmp')
    ];
    for (const d of tmpDirs) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'restart.txt'), String(Date.now()));
    }
    console.log('[Build] Touched restart.txt for Passenger server reload');
} catch (e) {}

console.log('[Build] Build complete.');
