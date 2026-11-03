// Puts both apps into one Pages site: website at the root, showroom under /showroom/.
import fs from 'node:fs';

fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('apps/website/dist', 'dist', { recursive: true });
fs.cpSync('apps/showroom/dist', 'dist/showroom', { recursive: true });
fs.writeFileSync('dist/.nojekyll', '');

const tooBig = fs
  .readdirSync('dist', { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => `${e.parentPath}/${e.name}`)
  .filter((p) => fs.statSync(p).size >= 100 * 1024 * 1024);
if (tooBig.length) throw new Error(`Files over the 100 MB limit:\n${tooBig.join('\n')}`);
console.log('Assembled dist/');
