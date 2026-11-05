// Puts the whole project on Cloudflare's free plan: website, showroom, admin panel, API and database.
// No credit card is needed; see README.md, "Put it online for free".
//   pnpm cf:setup    sign in to Cloudflare and create the database (once)
//   pnpm cf:deploy   build everything and publish it (every time you want the latest online)
//   pnpm build:online  only the build, for running it all on a computer with pnpm start:server
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONFIG = path.join(ROOT, 'apps/api/wrangler.jsonc');
const WRANGLER = 'npx --yes wrangler@4.151.2';
const DB_NAME = 'bair-songolt';
const PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

const run = (cmd, opts = {}) => {
  console.log(`> ${cmd}`);
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit', ...opts });
  if (r.status !== 0) stop(`This step failed: ${cmd}`);
};
const capture = (cmd, input) => {
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', input, stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'] });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};
const stop = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};
const wrangler = (args) => `${WRANGLER} ${args} --config "${CONFIG}"`;

function ensureLogin() {
  if (capture(`${WRANGLER} whoami`).out.includes('You are logged in')) return;
  console.log('\nA browser window opens to sign in to Cloudflare (create a free account there if you have none).\n');
  run(`${WRANGLER} login`);
}

function setup() {
  ensureLogin();
  const config = fs.readFileSync(CONFIG, 'utf8');
  if (!config.includes(PLACEHOLDER)) {
    console.log('The database is already set up in apps/api/wrangler.jsonc. Next: pnpm cf:deploy');
    return;
  }
  const created = capture(wrangler(`d1 create ${DB_NAME}`));
  let id = created.out.match(/"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/)?.[1];
  if (!id) {
    // It may exist already, from an earlier run.
    const list = capture(`${WRANGLER} d1 list --json`);
    try {
      id = JSON.parse(list.out.slice(list.out.indexOf('['))).find((d) => d.name === DB_NAME)?.uuid;
    } catch {
      // Fall through to the message below.
    }
  }
  if (!id) stop(`Could not create the database. Wrangler said:\n${created.out}`);
  fs.writeFileSync(CONFIG, config.replace(PLACEHOLDER, id));
  console.log(`\nDatabase ${DB_NAME} created (${id}) and written to apps/api/wrangler.jsonc. Commit that file, then run: pnpm cf:deploy`);
}

/** The 3D files come through Git LFS; a build with the small pointer files instead would show an empty scene. */
function lfsPointers(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (lfsPointers(full)) return true;
    } else if (/\.(glb|ktx2|hdr)$/.test(entry.name) && fs.readFileSync(full).subarray(0, 24).toString().startsWith('version https://git-lfs')) return true;
  }
  return false;
}

/** Website, showroom and admin for one address: the sites call the API at "/" and the admin's cookie stays on one site. */
function build() {
  if (lfsPointers(path.join(ROOT, 'apps/showroom/public'))) run('git lfs pull');
  const env = { ...process.env, VITE_API_URL: '/' };
  run('pnpm --filter @bair/website build', { env: { ...env, VITE_BASE: '/' } });
  run('pnpm --filter @bair/showroom build', { env: { ...env, VITE_BASE: '/showroom/' } });
  run('pnpm --filter @bair/admin build', { env: { ...env, VITE_BASE: '/admin/' } });
  run('node tools/assemble-pages.mjs');
}

function deploy() {
  if (fs.readFileSync(CONFIG, 'utf8').includes(PLACEHOLDER)) stop('Run pnpm cf:setup first: there is no database yet.');
  ensureLogin();
  build();
  run(wrangler('deploy'));

  // The first deploy gets a setup code, which unlocks creating the first admin account.
  const secrets = capture(wrangler('secret list --format json'));
  if (!secrets.out.includes('SETUP_CODE')) {
    const code = randomBytes(6).toString('base64url');
    const put = capture(wrangler('secret put SETUP_CODE'), `${code}\n`);
    if (!put.ok) stop(`Could not set the setup code:\n${put.out}`);
    console.log(`\nSetup code for the first admin account: ${code}\nOpen <your address>/admin/ and create the account with it. Keep it private.`);
  }
  console.log('\nOnline. Wrangler printed the address above (…workers.dev). The admin panel is at /admin/.');
}

const command = process.argv[2];
if (command === 'setup') setup();
else if (command === 'deploy') deploy();
else if (command === 'build') build();
else console.log('Usage: node tools/cloudflare.mjs setup | deploy | build');

