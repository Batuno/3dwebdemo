// Puts the apps into one site: website at the root, showroom under /showroom/, admin panel under /admin/.
// GitHub Pages, Cloudflare (pnpm cf:deploy) and the API server on a computer all serve this dist/ folder.
import fs from 'node:fs';

fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('apps/website/dist', 'dist', { recursive: true });
fs.cpSync('apps/showroom/dist', 'dist/showroom', { recursive: true });
// The admin panel needs its API next to it, so it is only included when it was built (pnpm build, cf:deploy).
if (fs.existsSync('apps/admin/dist')) fs.cpSync('apps/admin/dist', 'dist/admin', { recursive: true });
fs.writeFileSync('dist/.nojekyll', '');
// Cloudflare reads this file; the same headers are set by apps/api/src/node/static.ts on a computer.
fs.writeFileSync(
  'dist/_headers',
  `/admin/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
`,
);

const tooBig = fs
  .readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => `${e.parentPath}/${e.name}`)
  .filter((p) => fs.statSync(p).size >= 25 * 1024 * 1024);
// GitHub rejects files over 100 MB and Cloudflare serves files up to 25 MB.
if (tooBig.length) throw new Error(`Files over the 25 MB limit of free hosting:\n${tooBig.join('\n')}`);
console.log('Assembled dist/');
