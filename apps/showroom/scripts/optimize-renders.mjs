// Prepares Unreal output for the web: low-res panorama previews and 4096 px top views from the masters.
// Run before unreal/build_manifest.py. Usage: node scripts/optimize-renders.mjs [renders folder]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../public/renders'));
const LOW_WIDTH = 1536;
const WEB_LONG_SIDE = 4096;

let previews = 0;
const pano = path.join(ROOT, 'pano');
if (fs.existsSync(pano)) {
  for (const spot of fs.readdirSync(pano)) {
    for (const name of fs.readdirSync(path.join(pano, spot))) {
      if (!/^\d{4}\.jpg$/.test(name)) continue;
      const src = path.join(pano, spot, name);
      await sharp(fs.readFileSync(src)).resize(LOW_WIDTH).jpeg({ quality: 72, mozjpeg: true }).toFile(src.replace('.jpg', '_low.jpg'));
      previews++;
    }
  }
}

let plans = 0;
const master = path.join(ROOT, 'topview/master');
if (fs.existsSync(master)) {
  for (const name of fs.readdirSync(master)) {
    if (!name.endsWith('.jpg')) continue;
    await sharp(fs.readFileSync(path.join(master, name)))
      .resize(WEB_LONG_SIDE, WEB_LONG_SIDE, { fit: 'inside' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(ROOT, 'topview', name));
    plans++;
  }
}
console.log(`${previews} panorama previews, ${plans} top views`);
