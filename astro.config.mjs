import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { SITIO } from './src/negocio.js';

// Web en Cloudflare Pages: las páginas que no dependen del stock se generan en el build
// (prerender); el resto y el panel se sirven desde un Worker con D1 (coches) y KV (fotos).
export default defineConfig({
  site: SITIO,
  vite: { define: { __BUILD__: JSON.stringify(Date.now().toString(36)) } },
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough', platformProxy: { enabled: false } }),
  trailingSlash: 'ignore',
  build: { format: 'file', inlineStylesheets: 'never' }, // /stock.html → /stock (mismas URLs que la web de Arbicars, sin barra final)
  compressHTML: false,
  // El origen de los formularios lo comprueba src/middleware.js: la web llega a través de Vercel y el Host que ve
  // Cloudflare es el de *.pages.dev, así que la comprobación de Astro los rechazaría.
  security: { checkOrigin: false },
});
