// One step from a fresh clone to the running app: fetches the 3D files, installs what is needed, starts everything.
// Usage: node tools/start.mjs [--install-only] [--no-sync] [--no-open] [--no-admin]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const flags = new Set(process.argv.slice(2));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const pnpmVersion = pkg.packageManager.split('@')[1];

const line = (command, args) => [command, ...args].join(' ');
const works = (command, args) => spawnSync(line(command, args), { cwd: ROOT, shell: true, stdio: 'ignore' }).status === 0;
const run = (command, args) => {
  console.log(`> ${line(command, args)}`);
  return spawnSync(line(command, args), { cwd: ROOT, shell: true, stdio: 'inherit' }).status === 0;
};
const stop = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) stop(`Node 22 or newer is needed, this is ${process.version}. Get it from https://nodejs.org`);
if (!fs.existsSync(path.join(ROOT, '.git'))) stop('Run this from a git clone, not a ZIP download: the 3D files are only available through Git LFS.');

function lfsPointer(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (lfsPointer(full)) return true;
    } else if (/\.(glb|ktx2|hdr)$/.test(entry.name)) {
      const head = Buffer.alloc(24);
      const fd = fs.openSync(full, 'r');
      fs.readSync(fd, head, 0, 24, 0);
      fs.closeSync(fd);
      if (head.toString().startsWith('version https://git-lfs')) return true;
    }
  }
  return false;
}

if (!works('git', ['lfs', 'version'])) {
  const hint = process.platform === 'win32' ? 'winget install GitHub.GitLFS' : process.platform === 'darwin' ? 'brew install git-lfs' : 'sudo apt install git-lfs';
  stop(`Git LFS is needed for the 3D files. Install it with:\n  ${hint}\nthen run this again.`);
}
run('git', ['lfs', 'install', '--local']);
if (lfsPointer(path.join(ROOT, 'apps/showroom/public')) && !run('git', ['lfs', 'pull'])) stop('Could not download the 3D files. Check your connection and GitHub access.');

// The project's own scripts call pnpm by name, so it has to end up on the PATH for later commands too.
const hasPnpm = () => works('pnpm', ['--version']);
if (!hasPnpm() && !(run('corepack', ['enable', 'pnpm']) && hasPnpm()) && !(run('npm', ['install', '--global', `pnpm@${pnpmVersion}`]) && hasPnpm())) {
  stop(`Could not install pnpm. Install it with: npm install --global pnpm@${pnpmVersion}`);
}
if (!run('pnpm', ['install'])) stop('Could not install the libraries. See the message above.');
if (flags.has('--install-only')) process.exit(0);

const children = [];
if (!flags.has('--no-sync')) children.push(spawn(process.execPath, [path.join(ROOT, 'tools/sync.mjs'), 'watch'], { cwd: ROOT, stdio: 'inherit' }));
// The admin panel and its API run next to the showroom, which then sends its leads and statistics to it.
// The database stays on this computer in data/ (not synced: it holds buyers' phone numbers).
const admin = !flags.has('--no-admin');
if (admin) {
  for (const pkg of ['@bair/api', '@bair/admin']) children.push(spawn(line('pnpm', ['--filter', pkg, 'dev']), { cwd: ROOT, shell: true, stdio: 'inherit' }));
}
console.log('\nStarting the showroom at http://localhost:5173 (press Ctrl+C to stop)');
if (admin) console.log('Admin panel at http://localhost:5175/admin/ (the first time, it asks for the setup code the API prints below)');
console.log('');
const env = admin ? { ...process.env, VITE_API_URL: 'http://localhost:8787' } : process.env;
const dev = spawn(line('pnpm', ['dev', ...(flags.has('--no-open') ? [] : ['--open'])]), { cwd: ROOT, shell: true, stdio: 'inherit', env });
dev.on('exit', (code) => {
  children.forEach((c) => c.kill());
  process.exit(code ?? 0);
});
