// Tras `astro build`: deja el Worker en un solo archivo (dist/_worker.js) para poder
// publicarlo arrastrando la carpeta dist al panel de Cloudflare Pages, y repasa _routes.json.
import { build } from 'esbuild';
import { rmSync, renameSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const carpeta = join(dist, '_worker.js');
if (!existsSync(join(carpeta, 'index.js'))) throw new Error('No encuentro dist/_worker.js/index.js: ¿ha fallado astro build?');

await build({
  entryPoints: [join(carpeta, 'index.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  conditions: ['workerd', 'worker', 'browser'],
  external: ['cloudflare:*', 'node:*'],
  outfile: join(dist, '_worker.bundle.js'),
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
});
rmSync(carpeta, { recursive: true, force: true });
renameSync(join(dist, '_worker.bundle.js'), join(dist, '_worker.js'));

// /stock (sin barra) también lo sirve el Worker; el adaptador solo apunta /stock/*
const rutasArchivo = join(dist, '_routes.json');
const rutas = JSON.parse(readFileSync(rutasArchivo, 'utf8'));
for (const r of ['/stock', '/admin/coche/*', '/admin/clientes', '/admin/imagenes', '/img-web/*']) if (!rutas.include.includes(r)) rutas.include.push(r);
rutas.include = [...new Set(rutas.include)].filter((r) => !['/_server-islands/*', '/_image'].includes(r));
writeFileSync(rutasArchivo, JSON.stringify(rutas, null, 2) + '\n');

const kb = Math.round(readFileSync(join(dist, '_worker.js')).length / 1024);
console.log(`Worker empaquetado en dist/_worker.js (${kb} KB). Rutas del Worker: ${rutas.include.join(', ')}`);
