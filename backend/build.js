const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const frontendDir = path.resolve(__dirname, '..', 'frontend');
const src = path.join(frontendDir, 'dist');
const backendDist = path.join(__dirname, 'dist');
const rootDist = path.join(__dirname, '..', 'dist');

console.log('[Build] Starting client build in:', frontendDir);
if (fs.existsSync(frontendDir)) {
    try {
        const frontendNodeModules = path.join(frontendDir, 'node_modules');
        const cmd = fs.existsSync(frontendNodeModules) ? 'npm run build' : 'npm install --legacy-peer-deps && npm run build';
        execSync(cmd, { cwd: frontendDir, stdio: 'inherit' });
    } catch (err) {
        console.warn('[Build] Warning: Frontend build failed in server environment:', err.message);
        if (fs.existsSync(src) || fs.existsSync(backendDist) || fs.existsSync(rootDist)) {
            console.log('[Build] Pre-built dist folder exists. Proceeding with existing production build.');
        } else {
            process.exit(1);
        }
    }
}

if (fs.existsSync(src)) {
    // Always force-overwrite the dist folder to ensure UI updates are deployed
    if (fs.existsSync(backendDist)) {
        fs.rmSync(backendDist, { recursive: true, force: true });
    }
    fs.cpSync(src, backendDist, { recursive: true });
    console.log('[Build] Copied client build to backend dist/');

    // Mirror to root dist if needed
    try {
        if (fs.existsSync(rootDist)) fs.rmSync(rootDist, { recursive: true, force: true });
        fs.cpSync(src, rootDist, { recursive: true });
        console.log('[Build] Copied client build to root dist/');
    } catch (e) {}
} else if (fs.existsSync(backendDist) || fs.existsSync(rootDist)) {
    console.log('[Build] Preserving existing pre-built dist folder for deployment.');
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
