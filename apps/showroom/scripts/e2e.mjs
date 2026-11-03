// End-to-end smoke test against a running dev or preview server, in headless Edge/Chrome.
// Usage: node scripts/e2e.mjs [url]
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:5173/';
const exe = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  protocolTimeout: 180000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 860 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e).slice(0, 500)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
});

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = () => page.evaluate(() => location.hash);
const clickText = async (text, selector = 'button') => {
  const ok = await page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(t));
      if (!el) return false;
      el.click();
      return true;
    },
    text,
    selector,
  );
  return ok;
};
const textOnPage = (t) => page.evaluate((x) => document.body.innerText.includes(x), t);

await page.goto(base, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__sceneReady === true, { timeout: 150000 });
await page.waitForFunction(() => document.querySelectorAll('.block-label').length === 2 && document.querySelectorAll('.amenity-pill').length >= 9, { timeout: 30000 }).catch(() => {});

// Overview labels come from the data
const labels = await page.evaluate(() => [...document.querySelectorAll('.block-label')].map((e) => e.innerText));
check('overview has one label per block', labels.length === 2, JSON.stringify(labels.map((l) => l.split('\n')[0])));
check('block labels show counts and from-price', labels.every((l) => /боломжтой/.test(l) && /захиалгатай/.test(l) && /зарагдсан/.test(l) && /сая ₮-өөс/.test(l)));
const amenities = await page.evaluate(() => document.querySelectorAll('.amenity-pill').length);
check('amenity pills render', amenities >= 9, `${amenities}`);
check('disclaimer is shown', await textOnPage('Энэ бол демо'));

// Block flow
await page.evaluate(() => document.querySelector('.block-label').click());
await wait(800);
const h1 = await hash();
check('clicking a block label opens the block view', /^#\/804[AB]$/.test(h1), h1);
await wait(1500);
const floorButtons = await page.evaluate(() => document.querySelectorAll('.floor-tick').length);
check('floor ticks list 23 storeys', floorButtons === 23, `${floorButtons}`);
await page.evaluate(() => [...document.querySelectorAll('.floor-tick')].find((b) => b.textContent === '12').click());
await wait(1200);
const h2 = await hash();
check('choosing a storey opens the floor view', h2.endsWith('/12'), h2);
check('breadcrumb shows the storey', await textOnPage('12 давхар'));
check('floor legend present', await textOnPage('Төрлөөр'));
const badges = await page.evaluate(() => document.querySelectorAll('.unit-badge').length);
check('12 unit badges on the floor', badges === 12, `${badges}`);
await clickText('Боломжоор');
await wait(200);

// Unit flow via deep link
await page.evaluate(() => {
  location.hash = '#/804A/12/325';
});
await wait(6000);
check('deep link opens the right unit', await textOnPage('#12-325'));
check('price matches the formula (90 m² × 4,770,000 × 1.04)', await textOnPage('446,472,000 ₮'));
check('room list is in Mongolian', await textOnPage('Мастер унтлагын өрөө'));
check('room labels float in the scene', (await page.evaluate(() => document.querySelectorAll('.room-tag').length)) >= 6);

// Lead form validation
await clickText('Үзлэг товлох');
await wait(300);
await clickText('Илгээх');
await wait(200);
check('empty form shows validation errors', await textOnPage('Нэрээ оруулна уу'));
check('phone error is in Mongolian', await textOnPage('Утасны дугаар 8 оронтой'));
const inputs = await page.$$('form input');
await inputs[0].type('Бат');
await inputs[1].type('991122');
await clickText('Илгээх');
await wait(200);
check('short phone is rejected', await textOnPage('Утасны дугаар 8 оронтой'));
await inputs[1].type('33');
await page.evaluate(() => {
  const d = document.querySelector('form input[type=date]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(d, '2030-01-15');
  d.dispatchEvent(new Event('input', { bubbles: true }));
});
await clickText('15:00');
await clickText('Илгээх');
await wait(500);
const leads = await page.evaluate(() => JSON.parse(localStorage.getItem('bair.leads') ?? '[]'));
check('valid form saves a lead to localStorage', leads.length === 1 && leads[0].phone === '99112233' && leads[0].unitId === '804A-12-325', JSON.stringify(leads[0] ?? {}));
check('success toast appears', await textOnPage('хүлээн авлаа'));


// Floor stepping keeps the stack
await page.evaluate(() => document.querySelector('button[aria-label="Дээд давхар"]').click());
await wait(1500);
check('floor up keeps the same stack', (await hash()) === '#/804A/13/325', await hash());

// Parking add-on
await clickText('Зогсоол сонгох');
await wait(2500);
check('parking opens the garage', (await hash()) === '#/garage', await hash());
await page.evaluate(() => window.__store.getState().setGarageSelection('B1-005'));
await wait(300);
const bay = await page.evaluate(() => document.body.innerText.includes('B1-005'));
check('garage panel shows the selected bay', bay);

// Outdoor views and the amenity list
await page.evaluate(() => {
  location.hash = '#/outdoor/playground';
});
await wait(1500);
check('outdoor link opens the amenity list', await page.evaluate(() => !!document.querySelector('.amenity-list')));
check('breadcrumb names the amenity', await textOnPage('Хүүхдийн тоглоомын талбай'));
await clickText('Сагсны талбай', '.amenity-list button');
await wait(1200);
check('amenity list jumps to the court', (await hash()) === '#/outdoor/court', await hash());
const eye = await page.evaluate(() => window.__controls.camera.position.y);
check('outdoor camera stands at eye height', Math.abs(eye - 1.6) < 0.2, String(eye));

// Reset, and bad links
await page.evaluate(() => {
  location.hash = '#/nonsense/99';
});
await wait(600);
check('bad link falls back to the overview', (await page.evaluate(() => window.__store.getState().route.view)) === 'overview');

// Day and night
await page.evaluate(() => window.__store.getState().setTime(21 * 60));
await wait(2200);
await page.evaluate(() => window.__store.getState().setTime(12 * 60));
await wait(300);

check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
