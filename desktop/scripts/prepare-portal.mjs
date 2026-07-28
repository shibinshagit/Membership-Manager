import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..');
const portalRoot = path.join(repoRoot, 'portal');
const appOut = path.join(desktopRoot, 'app');

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DESKTOP_MODE: '1',
      DATABASE_DRIVER: 'pglite',
      STORAGE_DRIVER: 'local',
    },
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function detectPackageManager(dir) {
  if (existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function installPortalDeps() {
  const pm = detectPackageManager(portalRoot);
  if (pm === 'pnpm') run('pnpm', ['install'], portalRoot);
  else if (pm === 'yarn') run('yarn', ['install'], portalRoot);
  else run('npm', ['install'], portalRoot);
}

function buildPortal() {
  const pm = detectPackageManager(portalRoot);
  if (pm === 'pnpm') run('pnpm', ['run', 'build'], portalRoot);
  else if (pm === 'yarn') run('yarn', ['build'], portalRoot);
  else run('npm', ['run', 'build'], portalRoot);
}

function findServerJs(dir) {
  const direct = path.join(dir, 'server.js');
  if (existsSync(direct)) return direct;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    if (name.name === 'node_modules' || name.name === '.next') continue;
    const nested = path.join(dir, name.name, 'server.js');
    if (existsSync(nested)) return nested;
  }
  return null;
}

function copyStandalone() {
  const standalone = path.join(portalRoot, '.next', 'standalone');
  if (!existsSync(standalone)) {
    console.error('Missing portal/.next/standalone — Next build did not produce standalone output.');
    process.exit(1);
  }

  rmSync(appOut, { recursive: true, force: true });
  mkdirSync(appOut, { recursive: true });

  // Keep the full standalone tree (node_modules may be hoisted at the root).
  cpSync(standalone, appOut, { recursive: true });

  // Strip accidental traced backups / docs from the desktop package.
  for (const name of readdirSync(appOut)) {
    if (
      name.startsWith('blob-backup-') ||
      name.startsWith('db-backup-') ||
      name.endsWith('.md') ||
      name === 'Untitled' ||
      name === 'prisma' ||
      name === 'pnpm-lock.yaml' ||
      name === 'package-lock.json' ||
      name === 'tsconfig.tsbuildinfo'
    ) {
      rmSync(path.join(appOut, name), { recursive: true, force: true });
    }
  }

  const serverJs = findServerJs(appOut);
  if (!serverJs) {
    console.error('Could not find server.js inside .next/standalone');
    process.exit(1);
  }

  const serverDir = path.dirname(serverJs);

  // If Next nested the server under a subfolder, lift a thin launcher to app/server.js
  // so Electron can always start desktop/app/server.js.
  if (path.resolve(serverDir) !== path.resolve(appOut)) {
    writeFileSync(
      path.join(appOut, 'server.js'),
      `process.chdir(${JSON.stringify(serverDir)});\nrequire(${JSON.stringify(serverJs)});\n`
    );
  }

  const staticSrc = path.join(portalRoot, '.next', 'static');
  const staticDest = path.join(serverDir, '.next', 'static');
  mkdirSync(path.dirname(staticDest), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true });

  const publicSrc = path.join(portalRoot, 'public');
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, path.join(serverDir, 'public'), { recursive: true });
  }

  // Ensure embedded DB + pg drivers are available in the packaged server.
  run('npm', ['install', 'pg@^8.16.3', '@electric-sql/pglite@^0.3.4', '--omit=dev'], serverDir);

  writeFileSync(
    path.join(appOut, 'DESKTOP_BUILD.json'),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        serverJs: path.relative(appOut, serverJs),
        portalPackage: JSON.parse(
          readFileSync(path.join(portalRoot, 'package.json'), 'utf8')
        ).version,
      },
      null,
      2
    )
  );

  console.log(`Packaged Next standalone → ${appOut}`);
}

installPortalDeps();
buildPortal();
copyStandalone();
