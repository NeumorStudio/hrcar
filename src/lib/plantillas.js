// Direcciones de los coches y de sus fotos.
export const urlCoche = (c) => `/stock/${c.slug}`;
// Las fotos de serie viven en /img (ficheros de la web); las que sube el dueño desde el panel, en /fotos (KV).
export const fotoUrl = (f) => (f.startsWith('/') ? f : `/img/${f}`);
// Miniatura para listados (las subidas desde el panel tienen una de ~720 px; si no existe, /fotos sirve la grande).
export const fotoMini = (f) => (String(f).startsWith('/fotos/') ? f.replace(/(\.[a-z]+)$/i, '-m$1') : fotoUrl(f));
