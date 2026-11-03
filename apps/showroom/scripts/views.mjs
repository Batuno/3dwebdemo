// Dev tool: opens each view in a fresh page and saves a screenshot, reporting console errors.
// Usage: node scripts/views.mjs <out-dir> name=<url suffix>[@WxH] ...
//   node scripts/views.mjs ../../docs/phase4 dusk='?t=18:45#/' noon='?t=12:00#/804A@1920x1080'
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const base = process.env.SHOT_URL ?? 'http://localhost:5199/';
const settle = Number(process.env.SHOT_SETTLE ?? 6000);
const [outDir, ...specs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CANDIDATES.find((p) => fs.existsSync(p)),
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  protocolTimeout: 180000,
});

let failed = false;
for (const spec of specs) {
  const eq = spec.indexOf('=');
  const name = spec.slice(0, eq);
  const [suffix, size] = spec.slice(eq + 1).split('@');
  const [width, height] = (size ?? '1600x900').split('x').map(Number);
  const page = await browser.newPage();
  const errors = new Set();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.add(m.text().slice(0, 260));
  });
  page.on('pageerror', (e) => errors.add(String(e.stack ?? e).slice(0, 600)));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(base + suffix, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__sceneReady === true, { timeout: 150000 }).catch(() => errors.add('scene never became ready'));
  await new Promise((r) => setTimeout(r, settle));
  await page.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 86 });
  console.log(name, errors.size ? `ERRORS: ${[...errors].join(' ;; ')}` : 'ok');
  if (errors.size) failed = true;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
