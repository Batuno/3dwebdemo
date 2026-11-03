// Writes everything the Unreal pipeline needs into export/ at the repository root, one fresh page per
// part because baking replaces texture settings on the live scene.
// Usage: pnpm --filter @bair/showroom export:unreal [part ...]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(ROOT, 'export');
const PORT = 5198;
const BASE = `http://localhost:${PORT}/#/dev/export`;

const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

fs.mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  protocolTimeout: 900000,
});

const chunks = new Map();
const writeChunk = (name, b64, last) => {
  const list = chunks.get(name) ?? [];
  list.push(Buffer.from(b64, 'base64'));
  chunks.set(name, list);
  if (!last) return;
  const data = Buffer.concat(list);
  fs.writeFileSync(path.join(OUT, name), data);
  chunks.delete(name);
  console.log(`  ${name}  ${(data.length / 1048576).toFixed(2)} MB`);
};

// Streams a large buffer to disk through base64 chunks.
const SAVE = `async (name, data) => {
  const blob = new Blob([data]);
  const size = 6 * 1024 * 1024;
  if (blob.size === 0) return window.__writeChunk(name, '', true);
  for (let i = 0; i < blob.size; i += size) {
    const b64 = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] ?? '');
      r.readAsDataURL(blob.slice(i, i + size));
    });
    await window.__writeChunk(name, b64, i + size >= blob.size);
  }
}`;

const problems = [];
const openPage = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => problems.push(String(e.stack ?? e).slice(0, 800)));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text().slice(0, 300));
  });
  // High quality gives the fullest tree crowns.
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('bair.quality', '"high"');
    } catch {
      // about:blank has no storage.
    }
  });
  await page.exposeFunction('__writeChunk', writeChunk);
  await page.goto(BASE, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof window.__runExport === 'function', { timeout: 120000 });
  return page;
};

try {
  const first = await openPage();
  const all = await first.evaluate(async () => (await import('/src/dev/exportGltf.ts')).EXPORT_PARTS);
  await first.close();
  const parts = process.argv.length > 2 ? process.argv.slice(2) : all;
  for (const part of parts) {
    console.log(part);
    const page = await openPage();
    await page.evaluate(
      async (name, save) => {
        await window.__runExport(name, eval(save));
      },
      part,
      SAVE,
    );
    await page.close();
  }
  const props = path.join(OUT, 'topview_props.json');
  if (fs.existsSync(props)) fs.copyFileSync(props, path.join(ROOT, 'unreal/topview_props.json'));
} finally {
  await browser.close();
  await server.close();
}
if (problems.length) console.log('PAGE PROBLEMS:\n' + [...new Set(problems)].slice(0, 12).join('\n'));
console.log('done');
process.exit(0);
