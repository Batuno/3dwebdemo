// Runs the admin panel with its API, or everything together, on this computer. Works the same on Windows.
//   pnpm dev:admin   API on :8787 and the admin panel on http://localhost:5175/admin/
//   pnpm dev:all     the above, plus the showroom (:5173) and the website (:5174) talking to the API
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const mode = process.argv[2] === 'all' ? 'all' : 'admin';
const API = 'http://localhost:8787';

const apps = [
  ['api', '@bair/api', {}],
  ['admin', '@bair/admin', {}],
  ...(mode === 'all'
    ? [
        ['showroom', '@bair/showroom', { VITE_API_URL: API }],
        ['website', '@bair/website', { VITE_API_URL: API }],
      ]
    : []),
];

const children = apps.map(([name, pkg, env]) => {
  const child = spawn(`pnpm --filter ${pkg} dev`, { cwd: ROOT, shell: true, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `[${name}]`.padEnd(11);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of chunk.split(/\r?\n/)) if (line.trim()) process.stdout.write(`${prefix}${line}\n`);
    });
  }
  return child;
});

console.log(`\nAdmin panel: http://localhost:5175/admin/   API: ${API}`);
if (mode === 'all') console.log('Showroom: http://localhost:5173   Website: http://localhost:5174');
console.log('The first time, the API prints a setup code for creating the first account. Ctrl+C stops everything.\n');

const stop = () => {
  children.forEach((c) => c.kill());
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', (code) => code && code !== 0 && console.log(`A process stopped with code ${code}.`)));
