// Cursor / CI may set ELECTRON_RUN_AS_NODE=1; that disables Electron's app API.
// Clear it before loading Electron. The Next child process sets it again on purpose.
if (process.env.ELECTRON_RUN_AS_NODE) {
  delete process.env.ELECTRON_RUN_AS_NODE;
}

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3050);
const HOST = '127.0.0.1';

let mainWindow = null;
let serverProcess = null;
let quitting = false;

function userDataPath(...parts) {
  return path.join(app.getPath('userData'), ...parts);
}

function resolveAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, '..', 'app');
}

function loadDesktopEnv() {
  const envPath = userDataPath('config.env');
  const exampleBundled = app.isPackaged
    ? path.join(process.resourcesPath, 'env.desktop.example')
    : path.join(__dirname, '..', 'resources', 'env.desktop.example');

  if (!fs.existsSync(envPath) && fs.existsSync(exampleBundled)) {
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    fs.copyFileSync(exampleBundled, envPath);
  }

  const env = {
    DESKTOP_MODE: '1',
    DATABASE_DRIVER: 'pglite',
    STORAGE_DRIVER: 'local',
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: HOST,
    LOCAL_STORAGE_DIR: userDataPath('uploads'),
    PGLITE_DATA_DIR: userDataPath('db'),
    AUTH_SECRET: 'desktop-change-me-in-config-env',
    ADMIN_INITIAL_PASSWORD: 'Admin@12345',
    SETUP_SECRET: 'desktop-setup-secret',
  };

  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }

  // Always force desktop embedded storage/runtime flags.
  env.DESKTOP_MODE = '1';
  env.DATABASE_DRIVER = 'pglite';
  env.STORAGE_DRIVER = 'local';
  env.LOCAL_STORAGE_DIR = env.LOCAL_STORAGE_DIR || userDataPath('uploads');
  env.PGLITE_DATA_DIR = env.PGLITE_DATA_DIR || userDataPath('db');
  env.PORT = String(PORT);
  env.HOSTNAME = HOST;
  env.NODE_ENV = 'production';
  delete env.DATABASE_URL;

  fs.mkdirSync(env.LOCAL_STORAGE_DIR, { recursive: true });
  fs.mkdirSync(env.PGLITE_DATA_DIR, { recursive: true });
  return env;
}

function waitForServer(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Server did not start within ${timeoutMs}ms`));
          return;
        }
        setTimeout(tick, 400);
      });
    };
    tick();
  });
}

function startNextServer(env) {
  const appRoot = resolveAppRoot();
  const serverJs = path.join(appRoot, 'server.js');
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Missing packaged app at ${serverJs}. Run "npm run prepare:portal" first.`
    );
  }

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: appRoot,
    env: {
      ...process.env,
      ...env,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[next] ${chunk}`);
  });
  serverProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[next] ${chunk}`);
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (!quitting && code && code !== 0) {
      dialog.showErrorBox(
        'Membership Portal',
        `The application server stopped unexpectedly (code ${code}).`
      );
      app.quit();
    }
  });
}

async function runFirstTimeSetup(env) {
  try {
    const port = Number(env.PORT || PORT);
    const secret = env.SETUP_SECRET ? `?secret=${encodeURIComponent(env.SETUP_SECRET)}` : '';
    const res = await fetch(`http://${HOST}:${port}/api/setup${secret}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Setup failed', body);
    } else {
      console.log('Setup ok', body.message || body);
    }
  } catch (error) {
    console.error('Setup request failed', error);
  }
}

function createWindow(targetUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: targetUrl ? 'Membership Portal (Desktop Dev)' : 'Membership Portal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(targetUrl || `http://${HOST}:${PORT}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function boot() {
  const env = loadDesktopEnv();
  const devUrl = process.env.DESKTOP_DEV_URL;

  if (devUrl) {
    // Attach to live portal `next dev` — same source as web, desktop env on that process.
    const url = new URL(devUrl);
    const port = Number(url.port || 3051);
    env.PORT = String(port);
    await waitForServer(`${url.origin}/login`);
    await runFirstTimeSetup(env);
    createWindow(devUrl);
    return;
  }

  startNextServer(env);
  await waitForServer(`http://${HOST}:${PORT}/login`);
  await runFirstTimeSetup(env);
  createWindow();
}

app.whenReady().then(() => {
  boot().catch((error) => {
    console.error(error);
    dialog.showErrorBox('Membership Portal failed to start', String(error?.message || error));
    app.quit();
  });
});

app.on('window-all-closed', () => {
  quitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  quitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
