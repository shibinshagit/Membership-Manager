import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const portalRoot = path.resolve(desktopRoot, '..', 'portal');
const PORT = Number(process.env.DESKTOP_PORT || 3051);
const HOST = '127.0.0.1';

const userDataFallback = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'membership-portal-desktop'
);
const dataRoot =
  process.env.DESKTOP_USER_DATA ||
  (process.platform === 'darwin'
    ? userDataFallback
    : path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'membership-portal-desktop'
      ));

const uploadsDir = path.join(dataRoot, 'uploads');
const dbDir = path.join(dataRoot, 'db');
mkdirSync(uploadsDir, { recursive: true });
mkdirSync(dbDir, { recursive: true });

if (!existsSync(path.join(portalRoot, 'package.json'))) {
  console.error('portal/ not found next to desktop/');
  process.exit(1);
}

function waitForServer(url, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Portal dev server did not start: ${url}`));
          return;
        }
        setTimeout(tick, 400);
      });
    };
    tick();
  });
}

const nextEnv = {
  ...process.env,
  DESKTOP_MODE: '1',
  DATABASE_DRIVER: 'pglite',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: uploadsDir,
  PGLITE_DATA_DIR: dbDir,
  AUTH_SECRET: process.env.AUTH_SECRET || 'desktop-dev-secret',
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD || 'Admin@12345',
  SETUP_SECRET: process.env.SETUP_SECRET || 'desktop-setup-secret',
  PORT: String(PORT),
  NEXT_DIST_DIR: '.next-desktop',
};
delete nextEnv.ELECTRON_RUN_AS_NODE;
delete nextEnv.DATABASE_URL;

console.log(`[desktop-dev] starting portal next on http://${HOST}:${PORT}`);
console.log(`[desktop-dev] db=${dbDir}`);
console.log(`[desktop-dev] uploads=${uploadsDir}`);

const nextProc = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'dev', '--port', String(PORT), '--hostname', HOST, '--webpack'],
  {
    cwd: portalRoot,
    stdio: 'inherit',
    shell: true,
    env: nextEnv,
  }
);

let electronProc = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electronProc && !electronProc.killed) electronProc.kill();
  if (nextProc && !nextProc.killed) nextProc.kill();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

nextProc.on('exit', (code) => {
  if (!shuttingDown) shutdown(code || 0);
});

waitForServer(`http://${HOST}:${PORT}/login`)
  .then(() => {
    // Initialize schema for embedded desktop DB
    const secret = encodeURIComponent(nextEnv.SETUP_SECRET);
    return fetch(`http://${HOST}:${PORT}/api/setup?secret=${secret}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        console.log('[desktop-dev] setup', res.status, body.message || body.error || body);
      })
      .catch((err) => console.error('[desktop-dev] setup failed', err));
  })
  .then(() => {
    const electronEnv = {
      ...process.env,
      DESKTOP_MODE: '1',
      DESKTOP_DEV_URL: `http://${HOST}:${PORT}`,
      PORT: String(PORT),
    };
    delete electronEnv.ELECTRON_RUN_AS_NODE;

    electronProc = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['electron', '.'],
      {
        cwd: desktopRoot,
        stdio: 'inherit',
        shell: true,
        env: electronEnv,
      }
    );

    electronProc.on('exit', (code) => shutdown(code || 0));
  })
  .catch((err) => {
    console.error(err);
    shutdown(1);
  });
