// Keeps this checkout and GitHub in step: commits what changed, takes in the other side's work, pushes.
// Usage: node tools/sync.mjs [watch | list | undo | back <commit> | install | uninstall]
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const GIT_DIR = path.join(ROOT, '.git');
const REMOTE = 'origin';
const BRANCH = 'main';
const HOST = os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '-');
const QUIET_MS = 45_000;
const POLL_MS = 15_000;
const FETCH_MS = 60_000;
const MAX_PLAIN_FILE = 90 * 1048576;
const LOG = path.join(GIT_DIR, 'sync.log');
const PID = path.join(GIT_DIR, 'sync.pid');
const STARTUP = path.join(process.env.APPDATA ?? '', 'Microsoft/Windows/Start Menu/Programs/Startup/3d-bair-sync.vbs');

const log = (text) => {
  const line = `${new Date().toLocaleString('sv')}  ${text}`;
  console.log(line);
  fs.appendFileSync(LOG, `${line}\n`);
};

const git = (...args) => {
  const r = spawnSync('git', ['-c', 'core.editor=true', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1048576 });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

/** Never interrupt a rebase or merge someone is doing by hand, and only ever sync the shared branch. */
function busy() {
  const inProgress = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'index.lock'].some((f) => fs.existsSync(path.join(GIT_DIR, f)));
  return inProgress || git('branch', '--show-current').out !== BRANCH;
}

function changedFiles() {
  const out = spawnSync('git', ['status', '--porcelain', '-z', '-uall', '--no-renames'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1048576 }).stdout ?? '';
  return out.split('\0').filter(Boolean).map((e) => e.slice(3));
}

function lastChange(files) {
  let newest = 0;
  for (const f of files) {
    try {
      newest = Math.max(newest, fs.statSync(path.join(ROOT, f)).mtimeMs);
    } catch {
      // A deleted file has no time to read.
    }
  }
  return newest;
}

/** Each Unreal editor run adds this per-machine section, and it would flip back and forth between the two sides. */
function stripEditorNoise() {
  const ini = path.join(ROOT, 'unreal/BairShowroom/Config/DefaultEngine.ini');
  if (!fs.existsSync(ini)) return;
  const text = fs.readFileSync(ini, 'utf8');
  const clean = text.replace(/\r?\n?\[\/Script\/AndroidFileServerEditor[^\]]*\][^[]*/g, '\n').replace(/\n+$/, '\n');
  if (clean !== text) fs.writeFileSync(ini, clean);
}

function commitAll(prefix = 'sync') {
  stripEditorNoise();
  if (!git('add', '-A').ok) return false;
  const staged = git('diff', '--cached', '--name-only', '--diff-filter=AM').out.split('\n').filter(Boolean);
  for (const f of staged) {
    const size = fs.statSync(path.join(ROOT, f)).size;
    if (size > MAX_PLAIN_FILE && !git('check-attr', 'filter', '--', f).out.endsWith('lfs')) {
      git('reset', '-q', '--', f);
      log(`SKIPPED ${f}: ${Math.round(size / 1048576)} MB is too large for GitHub without Git LFS`);
    }
  }
  const files = git('diff', '--cached', '--name-only').out.split('\n').filter(Boolean);
  if (!files.length) return false;
  const names = files.slice(0, 3).map((f) => path.basename(f)).join(', ');
  const more = files.length > 3 ? ` +${files.length - 3}` : '';
  // Let GitHub Actions run so Pages can redeploy after synced edits.
  const ok = git('commit', '-q', '-m', `${prefix}(${HOST}): ${names}${more}`).ok;
  if (ok) log(`committed ${files.length} file(s): ${names}${more}`);
  return ok;
}

function reinstallIfNeeded(before) {
  if (git('rev-parse', `${before}:pnpm-lock.yaml`).out === git('rev-parse', 'HEAD:pnpm-lock.yaml').out) return;
  log('dependencies changed, installing');
  spawnSync(process.execPath, [path.join(ROOT, 'tools/start.mjs'), '--install-only'], { cwd: ROOT, stdio: 'inherit' });
}

/** Brings in the other side's commits. Overlapping edits never stop the sync: the newest wins and the older version is kept on a backup branch. */
function takeIn() {
  if (!git('fetch', '-q', REMOTE, BRANCH).ok) return false;
  const upstream = `${REMOTE}/${BRANCH}`;
  const behind = Number(git('rev-list', '--count', `HEAD..${upstream}`).out);
  if (!behind) return true;
  const before = git('rev-parse', 'HEAD').out;
  const ahead = Number(git('rev-list', '--count', `${upstream}..HEAD`).out);
  if (!ahead) {
    if (!git('merge', '-q', '--ff-only', upstream).ok) return false;
  } else if (!git('rebase', '-q', upstream).ok) {
    git('rebase', '--abort');
    const overlap = git('diff', '--name-only', `${before}...${upstream}`).out.split('\n').filter((f) => git('diff', '--name-only', `${upstream}...${before}`).out.split('\n').includes(f));
    const backup = `backup/${HOST}-${stamp()}`;
    git('branch', backup, before);
    git('push', '-q', REMOTE, backup);
    if (git('rebase', '-q', '-X', 'theirs', upstream).ok) {
      log(`OVERLAP in ${overlap.join(', ')}: this side's version was kept. The state before is on branch ${backup}`);
    } else {
      git('rebase', '--abort');
      git('reset', '-q', '--hard', upstream);
      log(`OVERLAP could not be merged: took the GitHub version. This side's work is safe on branch ${backup}`);
    }
  }
  log(`took in ${behind} commit(s) from GitHub`);
  reinstallIfNeeded(before);
  return true;
}

function pushOut() {
  for (let i = 0; i < 4; i++) {
    if (!Number(git('rev-list', '--count', `${REMOTE}/${BRANCH}..HEAD`).out) && git('rev-parse', '--verify', '-q', `${REMOTE}/${BRANCH}`).ok) return true;
    const r = git('push', '-q', REMOTE, BRANCH);
    if (r.ok) {
      log('pushed to GitHub');
      return true;
    }
    if (!takeIn()) break;
  }
  log('could not reach GitHub, will try again');
  return false;
}

function syncOnce(commit = true) {
  if (busy()) return log(`skipped: not on ${BRANCH}, or a git operation is in progress`);
  if (commit) commitAll();
  if (takeIn()) pushOut();
  else log('could not reach GitHub, will try again');
}

function running() {
  try {
    process.kill(Number(fs.readFileSync(PID, 'utf8')), 0);
    return true;
  } catch {
    return false;
  }
}

function watch() {
  if (running()) return console.log('Auto-sync is already running.');
  fs.writeFileSync(PID, String(process.pid));
  process.on('exit', () => fs.rmSync(PID, { force: true }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
  log(`auto-sync started: ${QUIET_MS / 1000}s after the last edit, changes go to GitHub`);
  syncOnce(false);
  let lastFetch = Date.now();
  setInterval(() => {
    if (busy()) return;
    const files = changedFiles();
    if (files.length) {
      // Wait for a pause in the editing. Taking in commits only with a clean tree means no half-edited file is ever touched.
      if (Date.now() - lastChange(files) >= QUIET_MS) {
        syncOnce();
        lastFetch = Date.now();
      }
    } else if (Date.now() - lastFetch >= FETCH_MS) {
      syncOnce(false);
      lastFetch = Date.now();
    }
  }, POLL_MS);
}

function list() {
  console.log(git('log', '-25', '--date=format:%m-%d %H:%M', '--format=%h  %ad  %<(14,trunc)%an  %s').out);
}

/** Going back adds a new commit with the old files, so nothing is lost and the other side simply receives it. */
function back(target, prefix) {
  if (busy()) return log(`stopped: not on ${BRANCH}, or a git operation is in progress`);
  commitAll();
  const hash = git('rev-parse', '--short', '--verify', '-q', `${target}^{commit}`);
  if (!hash.ok) return console.error(`No such commit: ${target}. See the list with: pnpm sync:list`);
  const subject = git('log', '-1', '--format=%s', hash.out).out.replace(' [skip ci]', '');
  if (!git('read-tree', '--reset', '-u', hash.out).ok) return console.error('Could not restore the files.');
  git('add', '-A');
  if (git('diff', '--cached', '--quiet').ok) return console.log('Already at that state.');
  git('commit', '-q', '-m', `${prefix}: back to ${hash.out} (${subject})`);
  log(`went back to ${hash.out}: ${subject}`);
  syncOnce(false);
}

/** Pressing undo again steps further back rather than undoing the undo. */
function undo() {
  const last = git('log', '-1', '--format=%s').out;
  const earlier = last.match(/^undo: back to ([0-9a-f]+)/);
  back(earlier ? `${earlier[1]}~1` : 'HEAD~1', 'undo');
}

function install() {
  if (process.platform !== 'win32') return console.log('Automatic start is set up for Windows only. Elsewhere, keep this running: pnpm sync:watch');
  const script = path.join(ROOT, 'tools/sync.mjs');
  fs.writeFileSync(STARTUP, `CreateObject("WScript.Shell").Run """${process.execPath}"" ""${script}"" watch", 0, False\r\n`);
  if (!running()) spawn(process.execPath, [script, 'watch'], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  console.log('Auto-sync is on and starts with Windows. To turn it off: node tools/sync.mjs uninstall');
}

function uninstall() {
  fs.rmSync(STARTUP, { force: true });
  if (running()) {
    const pid = fs.readFileSync(PID, 'utf8');
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', pid, '/f'], { stdio: 'ignore' });
    else process.kill(Number(pid));
    fs.rmSync(PID, { force: true });
  }
  console.log('Auto-sync is off.');
}

const [command, arg] = process.argv.slice(2);
if (!git('remote', 'get-url', REMOTE).ok) {
  console.log(`No "${REMOTE}" remote yet, nothing to sync.`);
} else if (!command) syncOnce();
else if (command === 'watch') watch();
else if (command === 'list') list();
else if (command === 'undo') undo();
else if (command === 'back' && arg) back(arg, 'back');
else if (command === 'install') install();
else if (command === 'uninstall') uninstall();
else console.log('Usage: node tools/sync.mjs [watch | list | undo | back <commit> | install | uninstall]');
