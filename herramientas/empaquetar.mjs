// Tras `astro build`: deja el Worker en un solo archivo (dist/_worker.js) para poder
// publicarlo arrastrando la carpeta dist al panel de Cloudflare Pages, y repasa _routes.json.
import { build } from 'esbuild';
import { rmSync, renameSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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

// PDF de los contratos firmados: lo monta el navegador (pdf-lib gasta demasiada CPU para el plan gratuito del Worker)
await build({
  entryPoints: [join(raiz, 'src', 'navegador', 'pdf.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2019',
  outfile: join(dist, 'js', 'contrato-pdf.js'),
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
});
renameSync(join(dist, '_worker.bundle.js'), join(dist, '_worker.js'));

// /stock (sin barra) también lo sirve el Worker; el adaptador solo apunta /stock/*
const rutasArchivo = join(dist, '_routes.json');
const rutas = JSON.parse(readFileSync(rutasArchivo, 'utf8'));
for (const r of ['/stock', '/admin/coche/*', '/admin/clientes', '/admin/captaciones', '/admin/imagenes', '/img-web/*']) if (!rutas.include.includes(r)) rutas.include.push(r);
rutas.include = [...new Set(rutas.include)].filter((r) => !['/_server-islands/*', '/_image'].includes(r));
// En Windows el adaptador a veces deja cada archivo como una regla (o con «\»), y Cloudflare no admite reglas de más
// de 100 caracteres ni más de 100 reglas: entonces se resume por carpetas y el Worker atiende todo lo demás.
// RESUMIR_RUTAS=1 fuerza este camino para probarlo.
const reglas = [...rutas.include, ...rutas.exclude];
if (process.env.RESUMIR_RUTAS || reglas.length > 100 || reglas.some((r) => r.length > 100 || r.includes('\\'))) {
  const exclude = [];
  for (const e of readdirSync(dist, { withFileTypes: true })) {
    if (e.name.startsWith('_')) { if (e.name === '_astro') exclude.push('/_astro/*'); continue; }
    if (e.isDirectory()) {
      // en /admin conviven archivos fijos y páginas del Worker: solo se excluyen los archivos
      if (e.name === 'admin') for (const f of readdirSync(join(dist, 'admin'))) exclude.push(`/admin/${f}`);
      else exclude.push(`/${e.name}/*`);
    } else exclude.push(e.name === '404.html' ? '/404' : `/${e.name}`);
  }
  rutas.include = ['/*'];
  rutas.exclude = exclude.filter((r) => r.length <= 100).slice(0, 99);
  console.log('Rutas resumidas por carpetas (el adaptador dio reglas que Cloudflare no admite).');
}
writeFileSync(rutasArchivo, JSON.stringify(rutas, null, 2) + '\n');

const kb = Math.round(readFileSync(join(dist, '_worker.js')).length / 1024);
console.log(`Worker empaquetado en dist/_worker.js (${kb} KB). Rutas del Worker: ${rutas.include.join(', ')}`);
