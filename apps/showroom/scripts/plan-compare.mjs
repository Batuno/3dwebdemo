// Dev tool: renders each unit type from above and saves it next to its diagram from interior-design.pdf.
// Usage: pnpm exec vite --port 5199, then node scripts/plan-compare.mjs [type ...]
// Saves to docs/phase2/<type>.jpg at the repository root and prints console errors.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(ROOT, 'docs/phase2');
const BASE = process.env.SHOT_URL ?? 'http://localhost:5199/';

// Where each layout diagram sits on its PDF page, in pixels of the 4800 px wide page.
const scale = 4800 / 1300;
const DIAGRAMS = {
  '2RF_T1': { page: 1, x: [110, 560], y: [420, 935] },
  '2RF_T2': { page: 2, x: [115, 556], y: [420, 985] },
  '3R': { page: 3, x: [78, 645], y: [420, 930] },
  '4R': { page: 4, x: [75, 752], y: [420, 868] },
};

/** The PDF pages are single JPEG streams; pull them out without a PDF renderer. */
function pdfPages(file) {
  const b = fs.readFileSync(file);
  const pages = [];
  let i = 0;
  while ((i = b.indexOf(Buffer.from([0xff, 0xd8, 0xff]), i)) !== -1) {
    const stop = b.indexOf(Buffer.from('endstream'), i);
    if (stop < 0) break;
    let end = stop;
    while (end > i && !(b[end - 2] === 0xff && b[end - 1] === 0xd9)) end--;
    pages.push(b.subarray(i, end));
    i = stop;
  }
  return pages;
}

const label = (text, width) =>
  Buffer.from(
    `<svg width="${width}" height="44"><rect width="100%" height="100%" fill="#1b2024"/><text x="14" y="29" font-family="Segoe UI, Arial" font-size="20" fill="#fff">${text}</text></svg>`,
  );

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];

const pages = pdfPages(path.join(ROOT, 'reference/interior-design.pdf'));
const types = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(DIAGRAMS);
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CANDIDATES.find((p) => fs.existsSync(p)),
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  protocolTimeout: 180000,
});
const errors = new Set();

for (const type of types) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.add(`[${type}] ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => errors.add(`[${type}] ${String(e.stack ?? e).slice(0, 600)}`));
  await page.setViewport({ width: 2100, height: 1250, deviceScaleFactor: 1 });
  await page.goto(`${BASE}#/dev/plan/${type}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__sceneReady === true, { timeout: 150000 });
  await new Promise((r) => setTimeout(r, 2500));

  const top = await page.$('[data-testid="topview"]');
  const plan = await page.$('[data-testid="debug-plan"]');
  const topShot = await top.screenshot({ type: 'png' });
  const planShot = await plan.screenshot({ type: 'png' });
  await page.close();

  const d = DIAGRAMS[type];
  const height = 900;
  const diagram = await sharp(pages[d.page], { limitInputPixels: false })
    .extract({
      left: Math.round(d.x[0] * scale),
      top: Math.round(d.y[0] * scale),
      width: Math.round((d.x[1] - d.x[0]) * scale),
      height: Math.round((d.y[1] - d.y[0]) * scale),
    })
    .resize({ height })
    .png()
    .toBuffer();
  const render = await sharp(topShot).resize({ height }).png().toBuffer();
  const schematic = await sharp(planShot).resize({ height, fit: 'contain', background: '#ffffff' }).png().toBuffer();

  const parts = [
    { title: 'PDF layout diagram', img: diagram },
    { title: '3D top view (walls cut at 1.2 m)', img: render },
    { title: 'Measured plan: clearances, doors, hotspots', img: schematic },
  ];
  const sizes = await Promise.all(parts.map((p) => sharp(p.img).metadata()));
  const gap = 18;
  const width = sizes.reduce((s, m) => s + m.width + gap, gap);
  let x = gap;
  const layers = [];
  parts.forEach((p, i) => {
    layers.push({ input: label(p.title, sizes[i].width), left: x, top: gap });
    layers.push({ input: p.img, left: x, top: gap + 44 });
    x += sizes[i].width + gap;
  });
  await sharp({ create: { width, height: height + 44 + gap * 2, channels: 3, background: '#f2efe9' } })
    .composite(layers)
    .jpeg({ quality: 88 })
    .toFile(path.join(OUT, `${type}.jpg`));
  console.log('saved', type, `${width}x${height + 44 + gap * 2}`);
}
if (errors.size) console.log('CONSOLE ERRORS:\n' + [...errors].join('\n'));
await browser.close();
