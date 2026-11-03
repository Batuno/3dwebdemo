// Dev tool: full-resolution screenshots of the running dev server in headless Edge/Chrome.
// Usage: node scripts/shot.mjs <name>=<hash>[@WxH][!js] ...
//   node scripts/shot.mjs overview=#/ unit=#/804A/12/325@1920x1080
// Saves to docs/shots/<name>.jpg and prints console errors and frame stats.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
const base = process.env.SHOT_URL ?? 'http://localhost:5173/';
const settle = Number(process.env.SHOT_SETTLE ?? 3500);
const outDir = process.env.SHOT_DIR ?? 'docs/shots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: [
    '--use-angle=d3d11',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
  protocolTimeout: 180000,
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${String(e.stack ?? e).slice(0, 900)}`));

let loaded = false;
for (const arg of process.argv.slice(2)) {
  const [name, rest] = arg.split(/=(.*)/s);
  const [specAndSize, js] = rest.split('!');
  const [hash, size] = specAndSize.split('@');
  const [w, h] = (size ?? '1600x900').split('x').map(Number);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  if (!loaded) {
    await page.goto(base + hash, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__sceneReady === true, { timeout: 150000 });
    loaded = true;
  } else {
    await page.evaluate((x) => {
      location.hash = x;
    }, hash);
  }
  if (js) await page.evaluate(js);
  await new Promise((r) => setTimeout(r, settle));
  const stats = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 > 1500) {
            const i = window.__stats ?? window.__renderer?.info.render;
            res({ fps: Math.round((n * 1000) / (performance.now() - t0)), calls: i?.calls, tris: i?.triangles });
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 88 });
  console.log(name, JSON.stringify(stats));
}
if (errors.length) console.log('CONSOLE:\n' + [...new Set(errors)].slice(0, 25).join('\n'));
await browser.close();
