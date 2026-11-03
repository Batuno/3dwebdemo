// Generates small labelled test images and a manifest, so the panorama viewer can be checked without Unreal.
// Output is git-ignored. View with: http://localhost:5173/?manifest=renders-placeholder/manifest.json#/804A/12/325/living-1
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve(import.meta.dirname, '../public/renders-placeholder');
const SPOTS = ['4R_living-1', '4R_master-1', 'outdoor_court'];
const TIMES = { '0700': '#f0b48a', '0900': '#a9cbe8', 1200: '#5c9fe0', 1500: '#7fb0dc', 1730: '#eda56a', 1845: '#6a5a8c', 2100: '#10182e' };

const svg = (w, h, spot, key, color) => {
  const font = h / 14;
  const label = (x, text) => `<text x="${x}" y="${h * 0.42}" font-size="${font * 2}" font-weight="700" fill="#fff" text-anchor="middle">${text}</text>`;
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Arial">
    <rect width="${w}" height="${h / 2}" fill="${color}"/>
    <rect y="${h / 2}" width="${w}" height="${h / 2}" fill="#4d4a44"/>
    ${label(w * 0.5, 'N')}${label(w * 0.75, 'E')}${label(0, 'S')}${label(w, 'S')}${label(w * 0.25, 'W')}
    <text x="${w * 0.5}" y="${h * 0.62}" font-size="${font}" fill="#fff" text-anchor="middle">${spot} ${key}</text>
  </svg>`);
};

fs.rmSync(OUT, { recursive: true, force: true });
const panoramas = {};
for (const spot of SPOTS) {
  panoramas[spot] = {};
  const dir = path.join(OUT, 'pano', spot);
  fs.mkdirSync(dir, { recursive: true });
  for (const [key, color] of Object.entries(TIMES)) {
    const name = key.padStart(4, '0');
    await sharp(svg(2048, 1024, spot, name, color)).jpeg({ quality: 70 }).toFile(path.join(dir, `${name}.jpg`));
    await sharp(svg(512, 256, spot, name, color)).jpeg({ quality: 50 }).toFile(path.join(dir, `${name}_low.jpg`));
    panoramas[spot][name] = { full: `pano/${spot}/${name}.jpg`, low: `pano/${spot}/${name}_low.jpg` };
  }
}
fs.mkdirSync(path.join(OUT, 'topview'), { recursive: true });
await sharp(svg(1320, 840, 'topview', '4R', '#c9b18c')).jpeg({ quality: 70 }).toFile(path.join(OUT, 'topview/4R.jpg'));
fs.mkdirSync(path.join(OUT, 'stills/opening'), { recursive: true });
await sharp(svg(1600, 900, 'opening still', '1845', TIMES[1845])).jpeg({ quality: 70 }).toFile(path.join(OUT, 'stills/opening/1845.jpg'));
const manifest = { version: 1, panoramas, stills: { opening: { 1845: 'stills/opening/1845.jpg' } }, topviews: { '4R': { day: 'topview/4R.jpg' } } };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`wrote ${SPOTS.length} hotspots × ${Object.keys(TIMES).length} times to ${path.relative(process.cwd(), OUT)}`);
