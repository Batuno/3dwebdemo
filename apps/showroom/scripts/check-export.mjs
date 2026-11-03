// Checks export/ against what the Unreal scripts expect: files, node names, material names.
// Usage: node scripts/check-export.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../../../export');
let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};

const readGlb = (name) => {
  const b = fs.readFileSync(path.join(OUT, name));
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  const triangles = (json.meshes ?? []).flatMap((m) => m.primitives).reduce((n, p) => n + (json.accessors[p.indices]?.count ?? 0) / 3, 0);
  return {
    mb: b.length / 1048576,
    triangles,
    nodes: (json.nodes ?? []).map((n) => n.name ?? ''),
    materials: (json.materials ?? []).map((m) => m.name ?? ''),
  };
};
const has = (name) => fs.existsSync(path.join(OUT, name));

for (const f of ['hotspots.json', 'cameras.json', 'sun.json', 'interiors.json', 'topview_props.json', 'units.csv']) check(f, has(f));

const site = readGlb('site.glb');
check('site.glb has its groups', ['Ground', 'Amenities', 'Vegetation', 'Lamps', 'Cars', 'Garage', 'Context_City'].every((n) => site.nodes.includes(n)), site.nodes.filter((n) => !n.startsWith('Amenity_')).join(' '));
check('site.glb marks amenities', site.nodes.some((n) => n.startsWith('Amenity_')));
console.log(`      ${site.mb.toFixed(1)} MB, ${Math.round(site.triangles).toLocaleString()} triangles`);

for (const id of ['804A', '804B']) {
  const b = readGlb(`block_${id}.glb`);
  const floors = b.nodes.filter((n) => n.startsWith(`Floor_${id}_`) && !n.endsWith('_Lit'));
  const lit = b.nodes.filter((n) => n.endsWith('_Lit'));
  const units = b.nodes.filter((n) => n.startsWith(`Unit_${id}_`));
  check(`block_${id}.glb has 23 floors`, floors.length === 23, `${floors.length}`);
  check(`block_${id}.glb has lit windows per floor`, lit.length === 23, `${lit.length}`);
  check(`block_${id}.glb marks 276 units`, units.length === 276, `${units.length}`);
  check(`block_${id}.glb has void deck and roof`, b.nodes.includes(`Block_${id}_VoidDeck`) && b.nodes.includes(`Block_${id}_Roof`));
  console.log(`      ${b.mb.toFixed(1)} MB, ${Math.round(b.triangles).toLocaleString()} triangles`);
}

const WANTED = ['M_Oak', 'M_Linen', 'M_Sage', 'M_WarmWhite', 'M_Quartz', 'M_StoneTile', 'M_BlackMetal', 'M_Glass'];
for (const type of ['2RF_T1', '2RF_T2', '3R', '4R']) {
  const i = readGlb(`interior_${type}.glb`);
  check(`interior_${type}.glb has named materials`, WANTED.every((m) => i.materials.includes(m)), WANTED.filter((m) => !i.materials.includes(m)).join(' '));
  check(`interior_${type}.glb has ceiling and shell`, i.nodes.includes(`Room_${type}_Ceiling`) && i.nodes.includes(`Room_${type}_Shell`));
  check(`interior_${type}.glb has separate furniture`, i.nodes.filter((n) => n.startsWith(`Room_${type}_`)).length > 15);
  const t = readGlb(`topview_${type}.glb`);
  check(`topview_${type}.glb has cut walls`, t.materials.includes('M_PlanCut') && t.materials.includes('M_PlanOutline') && !t.nodes.includes(`Room_${type}_Ceiling`));
  console.log(`      ${i.mb.toFixed(1)} MB interior, ${Math.round(i.triangles).toLocaleString()} triangles`);
}

const hotspots = JSON.parse(fs.readFileSync(path.join(OUT, 'hotspots.json'), 'utf8'));
check('hotspots.json has placements for all types', Object.keys(hotspots.placements).length === 4);
const sun = JSON.parse(fs.readFileSync(path.join(OUT, 'sun.json'), 'utf8'));
check('sun.json has 7 times', sun.times.length === 7);
const cams = JSON.parse(fs.readFileSync(path.join(OUT, 'cameras.json'), 'utf8'));
check('cameras.json has the opening shot', !!cams.opening && !!cams.overview && !!cams.block_804A);
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
