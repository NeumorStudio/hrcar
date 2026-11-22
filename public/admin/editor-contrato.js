// Ajustes → Contratos: cambiar el texto del contrato de dos formas.
//  - Subir el PDF del concesionario: se lee aquí, en el navegador (el PDF no se manda a ningún sitio), se adivina qué
//    dato va en cada raya, se repasa y pasa al editor.
//  - Cambiar el texto como en Word, con los datos (DNI, matrícula…) en pastillas.
// Guarda en el formato de bloques() de src/lib/contrato.js («# » título, «## » apartado, «- » lista y {{campo}}),
// así que enviar, firmar y el PDF firmado no cambian.
(function () {
'use strict';
const raiz = document.querySelector('[data-editor-contrato]');
const L = window.LIDI;
if (!raiz || !L) return;
let datos;
try { datos = JSON.parse(document.querySelector('[data-ec-datos]').textContent); } catch (e) { return; }

const $ = (s) => raiz.querySelector(s);
const $$ = (s) => Array.prototype.slice.call(raiz.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const RAYA = '__________';
const PLANTILLA_SERIE = datos.serie;

// Los datos que se pueden poner, con nombres normales y de dónde salen (los mismos campos que CAMPOS en src/lib/contrato.js)
const GRUPOS = [
  ['Tus datos', [
    ['empresa_nombre', 'Tu empresa', 'Tu nombre o razón social. Sale de Ajustes'],
    ['empresa_nif', 'Tu NIF/CIF', 'Sale de Ajustes'],
    ['empresa_domicilio', 'Tu domicilio', 'Sale de Ajustes'],
    ['empresa_representante', 'Quién firma por ti', 'Sale de Ajustes'],
  ]],
  ['Del vendedor', [
    ['vendedor_nombre', 'Nombre del vendedor', 'Lo confirma él al firmar'],
    ['vendedor_dni', 'DNI del vendedor', 'Lo pone él al firmar'],
    ['vendedor_domicilio', 'Domicilio del vendedor', 'Lo pone él al firmar'],
    ['vendedor_telefono', 'Teléfono del vendedor', 'Sale de la captación'],
    ['vendedor_email', 'Correo del vendedor', 'Sale de la captación'],
  ]],
  ['Del coche', [
    ['coche', 'Marca y modelo', 'Marca, modelo y versión. Sale de la captación'],
    ['matricula', 'Matrícula', 'Si no la tienes, la pone él al firmar'],
    ['bastidor', 'Bastidor', 'Opcional; lo puede poner él al firmar'],
    ['km', 'Kilómetros', 'Sale de la captación'],
    ['anio', 'Año', 'Sale de la captación'],
  ]],
  ['Del acuerdo', [
    ['precio_neto', 'Lo que recibe el vendedor', 'En euros. Sale de la captación'],
    ['gastos', 'Lo que inviertes tú', 'En euros. Sale de la captación; solo aparece si lo marcas al enviar'],
    ['plazo_dias', 'Días de exclusiva', 'Sale de Ajustes'],
    ['garantia_meses', 'Meses de garantía', 'Sale de Ajustes'],
    ['penalizacion', 'Compensación por romper la exclusiva', 'Sale de Ajustes'],
    ['ciudad', 'Ciudad de la firma', 'Sale de Ajustes'],
    ['fecha', 'Fecha de la firma', 'Se pone sola al firmar'],
  ]],
];
const DATOS = {};
GRUPOS.forEach(([grupo, lista]) => lista.forEach(([k, corto, pista]) => { DATOS[k] = { corto, pista, grupo }; }));

// «Ver con un ejemplo»: tus datos de Ajustes y un vendedor y un coche inventados
const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
const EJEMPLO = Object.assign({
  empresa_nombre: 'Tu empresa', empresa_nif: 'B12345674', empresa_domicilio: 'Tu domicilio', empresa_representante: 'Quien firma por ti',
  vendedor_nombre: 'María López García', vendedor_dni: '12345678Z', vendedor_domicilio: 'Calle Betis 10, Sevilla', vendedor_telefono: '600 000 000', vendedor_email: 'maria@ejemplo.com',
  coche: 'SEAT León 1.5 TSI FR', matricula: '1234 BCD', bastidor: 'VSSZZZ5FZLR000000', km: '48.000', anio: '2020',
  precio_neto: '14.500 €', gastos: '350 €', plazo_dias: '60', garantia_meses: '12', penalizacion: '1.000 € + IVA', ciudad: 'Sevilla', fecha: hoy,
}, Object.fromEntries(Object.entries(datos.empresa || {}).filter(([, v]) => v != null && String(v).trim() !== '')));

/** Igual que bloques() de src/lib/contrato.js: título, apartado, párrafo y lista. */
function bloques(texto) {
  const salida = [];
  for (const b of String(texto).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) {
    if (b.startsWith('# ')) { salida.push({ tipo: 'titulo', texto: b.slice(2).trim() }); continue; }
    if (b.startsWith('## ')) { salida.push({ tipo: 'apartado', texto: b.slice(3).trim() }); continue; }
    let parrafo = []; let lista = [];
    const cerrar = () => {
      if (parrafo.length) salida.push({ tipo: 'parrafo', texto: parrafo.join(' ') });
      if (lista.length) salida.push({ tipo: 'lista', items: lista });
      parrafo = []; lista = [];
    };
    for (const linea of b.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const item = /^[-•●]\s+(.*)$/.exec(linea);
      if (item) { if (parrafo.length && !lista.length) { salida.push({ tipo: 'parrafo', texto: parrafo.join(' ') }); parrafo = []; } lista.push(item[1]); }
      else { if (lista.length) cerrar(); parrafo.push(linea); }
    }
    cerrar();
  }
  return salida;
}

// ------------------------------------------------------------------ pestañas
const pestanas = { pdf: [$('#ec-tab-pdf'), $('#ec-panel-pdf')], texto: [$('#ec-tab-texto'), $('#ec-panel-texto')] };
function abrir(cual) {
  for (const [k, [tab, panel]] of Object.entries(pestanas)) {
    const si = k === cual;
    tab.setAttribute('aria-selected', String(si));
    tab.tabIndex = si ? 0 : -1;
    panel.hidden = !si;
  }
  cerrarMenu();
}
$('#ec-tab-pdf').addEventListener('click', () => abrir('pdf'));
$('#ec-tab-texto').addEventListener('click', () => abrir('texto'));
$('.ec-pestanas').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const otra = $('#ec-tab-pdf').getAttribute('aria-selected') === 'true' ? 'texto' : 'pdf';
  abrir(otra); pestanas[otra][0].focus();
});

// ------------------------------------------------------------------ editor
const editor = $('#ec-editor');
try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* navegadores antiguos */ }

const pastilla = (k) => (k
  ? `<span class="ec-dato" contenteditable="false" data-campo="${k}">${esc(DATOS[k].corto)}</span>`
  : '<span class="ec-dato ec-raya" contenteditable="false" data-campo="">raya en blanco</span>');
const enLinea = (t) => esc(t).replace(/\{\{\s*([a-z_]+)\s*\}\}|_{3,}/g, (m, k) => (k ? (DATOS[k] ? pastilla(k) : m) : pastilla('')));

function cargar(plantilla) {
  editor.innerHTML = bloques(plantilla).map((b) => {
    if (b.tipo === 'titulo') return `<h1>${enLinea(b.texto)}</h1>`;
    if (b.tipo === 'apartado') return `<h2>${enLinea(b.texto)}</h2>`;
    if (b.tipo === 'lista') return `<ul>${b.items.map((i) => `<li>${enLinea(i)}</li>`).join('')}</ul>`;
    return `<p>${enLinea(b.texto)}</p>`;
  }).join('');
  olvidarCambios();
  actualizar();
}

/** Del editor al formato que guarda el panel (# título, ## apartado, - lista, {{dato}}). */
function serializar() {
  const salida = [];
  const enTexto = (n) => {
    if (n.nodeType === 3) return n.textContent.replace(/ /g, ' ');
    if (n.nodeType !== 1) return '';
    if (n.classList.contains('ec-dato')) return n.dataset.campo ? `{{${n.dataset.campo}}}` : ` ${RAYA} `;
    if (n.tagName === 'BR') return ' ';
    return Array.prototype.map.call(n.childNodes, enTexto).join('');
  };
  const limpio = (n) => enTexto(n).replace(/\s+/g, ' ').trim();
  const BLOQUE = /^(H[1-6]|P|DIV|UL|OL|BLOCKQUOTE|PRE|SECTION)$/;
  const recorrer = (padre) => {
    let suelto = '';
    const soltar = () => { const t = suelto.replace(/\s+/g, ' ').trim(); if (t) salida.push({ tipo: 'p', t }); suelto = ''; };
    for (const n of padre.childNodes) {
      if (n.nodeType === 1 && BLOQUE.test(n.tagName)) {
        soltar();
        if (n.tagName === 'UL' || n.tagName === 'OL') {
          const items = Array.prototype.map.call(n.querySelectorAll('li'), limpio).filter(Boolean);
          if (items.length) salida.push({ tipo: 'ul', items });
        } else if (n.tagName === 'DIV' && Array.prototype.some.call(n.children, (c) => BLOQUE.test(c.tagName))) {
          recorrer(n);
        } else {
          const t = limpio(n);
          if (t) salida.push({ tipo: n.tagName === 'H1' ? 'h1' : /^H[2-6]$/.test(n.tagName) ? 'h2' : 'p', t });
        }
      } else if (n.nodeType === 1 && n.tagName === 'BR') soltar();
      else suelto += enTexto(n);
    }
    soltar();
  };
  recorrer(editor);
  let s = '';
  salida.forEach((b, i) => {
    const txt = b.tipo === 'h1' ? `# ${b.t}` : b.tipo === 'h2' ? `## ${b.t}` : b.tipo === 'ul' ? b.items.map((x) => `- ${x}`).join('\n') : b.t;
    s += i === 0 ? txt : (b.tipo === 'ul' && salida[i - 1].tipo === 'p' ? '\n' : '\n\n') + txt;
  });
  return s;
}
const tiene = (t, k) => new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`).test(t);

let guardada = null;
let serie = null;
function actualizar() {
  const t = serializar();
  // comprobación: lo importante que debería salir
  const rayas = (t.match(/_{3,}/g) || []).length;
  const clave = [['vendedor_nombre', 'Nombre del vendedor'], ['vendedor_dni', 'DNI del vendedor'], ['coche', 'Marca y modelo'], ['precio_neto', 'Lo que recibe el vendedor']];
  $('#ec-comprobacion').innerHTML = '<span class="ec-tit">Tu contrato dice:</span>'
    + clave.map(([k, n]) => (tiene(t, k) ? `<span class="ec-chip ec-si">✓ ${n}</span>` : `<span class="ec-chip ec-no">Falta: ${n}</span>`)).join('')
    + (rayas ? `<span class="ec-chip ec-no">${rayas} ${rayas === 1 ? 'raya en blanco' : 'rayas en blanco'}</span>` : '');
  if (guardada !== null) {
    $('#ec-estado').textContent = t === guardada ? (t === serie ? 'Es el contrato de serie.' : 'Guardado.') : 'Tienes cambios sin guardar.';
  }
  if (!$('#ec-zona-ver').hidden) pintarVista(t);
}
editor.addEventListener('input', actualizar);
editor.addEventListener('paste', (e) => {
  e.preventDefault();
  const t = (e.clipboardData || window.clipboardData).getData('text/plain');
  apuntar();
  document.execCommand('insertText', false, t);
});

// ------------------------------------------------------------------ deshacer
// El editor guarda sus propias fotos del texto: el deshacer del navegador no ve los cambios de formato hechos a mano.
const atras = [];
const adelante = [];
let tecleando = null;
const botonDeshacer = $('.ec-herramientas [data-cmd="deshacer"]');
function cursorActual() {
  const s = getSelection();
  if (!s.rangeCount || !editor.contains(s.anchorNode)) return null;
  const c = [];
  let n = s.anchorNode;
  while (n && n !== editor) { c.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n)); n = n.parentNode; }
  return { c, o: s.anchorOffset };
}
const fotoActual = () => ({ html: editor.innerHTML, cursor: cursorActual() });
const pintarDeshacer = () => { botonDeshacer.disabled = !atras.length; };
/** Guarda cómo está el texto justo antes de un cambio. */
function apuntar() {
  clearTimeout(tecleando); tecleando = null;
  const f = fotoActual();
  if (!atras.length || atras[atras.length - 1].html !== f.html) { atras.push(f); if (atras.length > 100) atras.shift(); }
  adelante.length = 0;
  pintarDeshacer();
}
function olvidarCambios() { clearTimeout(tecleando); tecleando = null; atras.length = 0; adelante.length = 0; pintarDeshacer(); }
function ponerFoto(f) {
  editor.innerHTML = f.html;
  let n = f.cursor ? editor : null;
  if (n) for (const i of f.cursor.c) n = n ? n.childNodes[i] : null;
  if (n) {
    editor.focus({ preventScroll: true });
    const r = document.createRange();
    r.setStart(n, Math.min(f.cursor.o, n.nodeType === 3 ? n.length : n.childNodes.length));
    r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  actualizar();
}
function deshacer() {
  clearTimeout(tecleando); tecleando = null;
  while (atras.length && atras[atras.length - 1].html === editor.innerHTML) atras.pop();
  if (atras.length) { adelante.push(fotoActual()); ponerFoto(atras.pop()); }
  pintarDeshacer();
}
function rehacer() {
  if (!adelante.length) return;
  atras.push(fotoActual());
  ponerFoto(adelante.pop());
  pintarDeshacer();
}
editor.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); } else if (k === 'y') { e.preventDefault(); rehacer(); }
});
editor.addEventListener('beforeinput', (e) => {
  if (e.inputType === 'historyUndo') { e.preventDefault(); deshacer(); return; }
  if (e.inputType === 'historyRedo') { e.preventDefault(); rehacer(); return; }
  // lo que se escribe de seguido se deshace de una vez
  if (!tecleando) apuntar();
  clearTimeout(tecleando);
  tecleando = setTimeout(() => { tecleando = null; }, 1000);
});

// dónde estaba el cursor, para insertar el dato ahí aunque se pulse fuera
let rango = null;
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (s.rangeCount && editor.contains(s.anchorNode)) rango = s.getRangeAt(0).cloneRange();
});
function volverAlCursor() {
  const s = getSelection();
  // la selección de ahora manda: «selectionchange» llega con retraso
  if (s.rangeCount && editor.contains(s.anchorNode)) rango = s.getRangeAt(0).cloneRange();
  editor.focus({ preventScroll: true });
  let r = rango && editor.contains(rango.startContainer) ? rango : null;
  if (!r) { r = document.createRange(); r.selectNodeContents(editor.lastElementChild || editor); r.collapse(false); }
  s.removeAllRanges(); s.addRange(r);
}

// ------------------------------------------------------------------ apartado, texto y lista
// A mano y no con execCommand: Chrome corta el párrafo en el primer dato azul y mete unas etiquetas dentro de otras.
const ES_BLOQUE = /^(P|H[1-6]|DIV|UL|OL|LI|BLOCKQUOTE|PRE|SECTION)$/;
const reemplazos = new Map();
function cambiarEtiqueta(el, etiqueta) {
  const nuevo = document.createElement(etiqueta);
  while (el.firstChild) nuevo.appendChild(el.firstChild);
  el.replaceWith(nuevo);
  reemplazos.set(el, nuevo);
  return nuevo;
}
/** Deja el editor solo con párrafos, apartados y listas: el texto suelto va a un párrafo y los div pasan a párrafo. */
function ordenar() {
  let suelto = null;
  Array.prototype.slice.call(editor.childNodes).forEach((n) => {
    if (n.nodeType === 1 && ES_BLOQUE.test(n.tagName)) {
      suelto = null;
      if (n.tagName === 'DIV' && !n.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,li,div')) cambiarEtiqueta(n, 'p');
      return;
    }
    if (!suelto && n.nodeType === 3 && !n.textContent.trim()) return;
    if (!suelto) { suelto = document.createElement('p'); editor.insertBefore(suelto, n); }
    suelto.appendChild(n);
  });
}
/** Los párrafos, apartados o puntos de lista que toca la selección. */
function tocados(r) {
  const todos = [];
  Array.prototype.forEach.call(editor.children, (n) => {
    if (n.tagName === 'UL' || n.tagName === 'OL') Array.prototype.forEach.call(n.children, (li) => todos.push(li));
    else todos.push(n);
  });
  const dentro = todos.filter((u) => r.intersectsNode(u));
  if (dentro.length || r.startContainer !== editor) return dentro;
  const junto = editor.childNodes[r.startOffset - 1] || editor.childNodes[r.startOffset];
  if (!junto || junto.nodeType !== 1) return [];
  const u = junto.tagName === 'UL' || junto.tagName === 'OL' ? junto.lastElementChild : junto;
  return u ? [u] : [];
}
function aBloque(u, etiqueta) {
  if (u.tagName !== 'LI') { if (u.tagName.toLowerCase() !== etiqueta) cambiarEtiqueta(u, etiqueta); return; }
  // un punto sale de su lista: lo que va detrás queda en otra lista
  const lista = u.parentNode;
  const detras = [];
  for (let n = u.nextElementSibling; n; n = n.nextElementSibling) detras.push(n);
  if (detras.length) { const otra = document.createElement(lista.tagName); detras.forEach((n) => otra.appendChild(n)); lista.after(otra); }
  lista.after(u);
  cambiarEtiqueta(u, etiqueta);
  if (!lista.children.length) lista.parentNode.removeChild(lista);
}
function aLista(u) {
  const li = cambiarEtiqueta(u, 'li');
  const previo = li.previousElementSibling;
  if (previo && previo.tagName === 'UL') previo.appendChild(li);
  else { const ul = document.createElement('ul'); li.replaceWith(ul); ul.appendChild(li); }
}
function unirListas() {
  Array.prototype.slice.call(editor.children).forEach((n) => {
    const previo = n.previousElementSibling;
    if (n.tagName === 'UL' && previo && previo.tagName === 'UL') { while (n.firstChild) previo.appendChild(n.firstChild); editor.removeChild(n); }
  });
}
function formato(c) {
  volverAlCursor();
  const s = getSelection();
  if (!s.rangeCount) return;
  apuntar();
  const r0 = s.getRangeAt(0);
  const g = { sc: r0.startContainer, so: r0.startOffset, ec: r0.endContainer, eo: r0.endOffset };
  reemplazos.clear();
  const vivo = (n) => { while (reemplazos.has(n)) n = reemplazos.get(n); return n; };
  const rangoGuardado = () => {
    const sc = vivo(g.sc); const ec = vivo(g.ec);
    if (!editor.contains(sc) || !editor.contains(ec)) return null;
    const r = document.createRange();
    try { r.setStart(sc, g.so); r.setEnd(ec, g.eo); } catch (e) { return null; }
    return r;
  };
  ordenar();
  const r = rangoGuardado();
  const us = r ? tocados(r) : [];
  if (c === 'lista') {
    if (us.length && us.every((u) => u.tagName === 'LI')) us.forEach((u) => aBloque(u, 'p'));
    else us.forEach((u) => { if (u.tagName !== 'LI') aLista(u); });
    unirListas();
  } else us.forEach((u) => aBloque(u, c));
  const fin = rangoGuardado();
  if (fin) { s.removeAllRanges(); s.addRange(fin); }
  actualizar();
}

$$('.ec-herramientas [data-cmd]').forEach((b) => {
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    const c = b.dataset.cmd;
    if (c === 'deshacer') deshacer(); else formato(c);
  });
});

// la barra de herramientas se queda pegada justo debajo de la cabecera del panel
const cabecera = document.querySelector('.cabecera');
const pegarBarra = () => { raiz.style.setProperty('--ec-arriba', `${cabecera ? cabecera.offsetHeight : 0}px`); };
pegarBarra();
addEventListener('resize', pegarBarra);
// lleva la página hasta un elemento sin que la cabecera fija lo tape
const irA = (el) => {
  const tope = el.getBoundingClientRect().top + window.scrollY - (cabecera ? cabecera.offsetHeight : 0) - 12;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: Math.max(0, tope), behavior: quieto ? 'auto' : 'smooth' });
};

// ------------------------------------------------------------------ menú de datos
const menu = document.createElement('div');
menu.className = 'ec-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
const fondoMenu = document.createElement('div');
fondoMenu.className = 'ec-fondo-menu'; fondoMenu.hidden = true;
document.body.append(fondoMenu, menu);
const estrecho = () => matchMedia('(max-width: 720px)').matches;

let pastillaActiva = null;
function abrirMenu(ancla, cambiando) {
  pastillaActiva = cambiando || null;
  $$('.ec-dato.ec-activo').forEach((d) => d.classList.remove('ec-activo'));
  if (pastillaActiva) pastillaActiva.classList.add('ec-activo');
  const actual = pastillaActiva ? pastillaActiva.dataset.campo : null;
  menu.innerHTML = `<div class="ec-titulo-menu"><span>${pastillaActiva ? 'Cambiar este dato' : '¿Qué dato pongo aquí?'}</span><button class="ec-cerrar" type="button" aria-label="Cerrar">×</button></div>`
    + GRUPOS.map(([grupo, lista]) => `<h3>${grupo}</h3>` + lista.map(([k, corto, pista]) =>
      `<button class="ec-op" role="menuitem" type="button" data-k="${k}"${k === actual ? ' aria-current="true"' : ''}><b>${esc(corto)}${k === actual ? ' ✓' : ''}</b><span>${esc(pista)}</span></button>`).join('')).join('')
    + (pastillaActiva ? '<h3>Otra cosa</h3><button class="ec-op ec-quitar" role="menuitem" type="button" data-k="-"><b>Quitar este dato</b><span>Se borra del texto</span></button>' : '');
  menu.hidden = false;
  const movil = estrecho();
  fondoMenu.hidden = !movil;
  if (movil) {
    menu.style.left = ''; menu.style.top = '';
    // la hoja tapa media pantalla: el dato que se cambia sube a la franja de arriba, bajo la barra
    if (pastillaActiva) {
      const r = ancla.getBoundingClientRect();
      const barra = $('.ec-herramientas');
      const arriba = (cabecera ? cabecera.offsetHeight : 0) + (barra ? barra.offsetHeight : 0) + 16;
      const abajo = menu.getBoundingClientRect().top - 16;
      if (r.bottom > abajo || r.top < arriba) window.scrollBy({ top: r.top - arriba, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  } else {
    const r = ancla.getBoundingClientRect();
    const ancho = menu.offsetWidth;
    let left = r.left + scrollX;
    left = Math.max(8, Math.min(left, scrollX + document.documentElement.clientWidth - ancho - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${r.bottom + scrollY + 6}px`;
    // si el menú no cabe por abajo, sube un poco la página (sin que el dato se meta bajo la cabecera)
    const sobra = menu.getBoundingClientRect().bottom - window.innerHeight + 12;
    const margen = r.top - (cabecera ? cabecera.offsetHeight : 0) - 12;
    if (sobra > 0 && margen > 0) window.scrollBy({ top: Math.min(sobra, margen), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  const primera = menu.querySelector('.ec-op');
  if (primera) primera.focus({ preventScroll: true });
}
function cerrarMenu() {
  menu.hidden = true; fondoMenu.hidden = true;
  $$('.ec-dato.ec-activo').forEach((d) => d.classList.remove('ec-activo'));
  pastillaActiva = null;
}
const insertar = $('#ec-insertar');
insertar.addEventListener('mousedown', (e) => e.preventDefault());
insertar.addEventListener('click', (e) => { e.stopPropagation(); if (menu.hidden) abrirMenu(insertar); else cerrarMenu(); });
editor.addEventListener('click', (e) => {
  const d = e.target.closest('.ec-dato');
  if (d) { e.stopPropagation(); abrirMenu(d, d); }
});
menu.addEventListener('mousedown', (e) => e.preventDefault());
menu.addEventListener('click', (e) => {
  e.stopPropagation();
  if (e.target.closest('.ec-cerrar')) { cerrarMenu(); return; }
  const op = e.target.closest('.ec-op');
  if (!op) return;
  const k = op.dataset.k;
  const cambiar = pastillaActiva;
  cerrarMenu();
  editor.focus({ preventScroll: true });
  const s = getSelection();
  if (cambiar && editor.contains(cambiar)) {
    const r = document.createRange(); r.selectNode(cambiar);
    s.removeAllRanges(); s.addRange(r);
    apuntar();
    if (k === '-') document.execCommand('delete');
    else { document.execCommand('insertHTML', false, marcar(pastilla(k))); colocarNuevo(); }
  } else {
    volverAlCursor();
    apuntar();
    // espacio delante si va pegado a una palabra o a «:», y detrás si lo que sigue no es ya un espacio o un signo
    let antes = ''; let sigue = '';
    if (s.rangeCount) {
      const rr = s.getRangeAt(0); const a = rr.startContainer; const n = rr.endContainer;
      const previo = a.nodeType === 3 ? null : a.childNodes[rr.startOffset - 1];
      const siguiente = n.nodeType === 3 ? null : n.childNodes[rr.endOffset];
      antes = a.nodeType === 3 ? a.textContent.charAt(rr.startOffset - 1) : (previo ? previo.textContent : '').slice(-1);
      sigue = n.nodeType === 3 ? n.textContent.charAt(rr.endOffset) : (siguiente ? siguiente.textContent : '').charAt(0);
    }
    const delante = antes && !/[\s («"'¿¡]/.test(antes) ? '&nbsp;' : '';
    const detras = sigue && /[\s .,;:)»"'?!]/.test(sigue) ? '' : '&nbsp;';
    document.execCommand('insertHTML', false, `${delante}${marcar(pastilla(k))}${detras}`);
    colocarNuevo();
  }
  actualizar();
});
// Chrome, al insertar al final del último párrafo, deja el dato suelto fuera del párrafo: se mete dentro y el cursor queda detrás
const marcar = (html) => html.replace('<span', '<span data-nuevo');
function colocarNuevo() {
  const nuevo = editor.querySelector('[data-nuevo]');
  if (!nuevo) return;
  nuevo.removeAttribute('data-nuevo');
  if (nuevo.parentNode === editor) {
    const previo = nuevo.previousElementSibling;
    let destino = previo && /^(P|H[1-6]|DIV)$/.test(previo.tagName) ? previo
      : previo && /^(UL|OL)$/.test(previo.tagName) ? previo.lastElementChild : null;
    if (!destino) { destino = document.createElement('p'); editor.insertBefore(destino, nuevo); }
    const ultimo = destino.lastChild;
    if (ultimo && ultimo.nodeType === 3 && !/[\s (]$/.test(ultimo.textContent)) destino.append(' ');
    // lo que se haya quedado suelto detrás (el espacio) va con él
    const resto = [];
    for (let n = nuevo.nextSibling; n && !(n.nodeType === 1 && /^(P|H[1-6]|DIV|UL|OL)$/.test(n.tagName)); n = n.nextSibling) resto.push(n);
    destino.append(nuevo, ...resto);
  }
  if (!nuevo.nextSibling || (nuevo.nextSibling.nodeType === 3 && !nuevo.nextSibling.textContent)) nuevo.after(' ');
  const r = document.createRange();
  const tras = nuevo.nextSibling;
  if (tras.nodeType === 3 && /^[\s ]/.test(tras.textContent)) r.setStart(tras, 1); else r.setStartAfter(nuevo);
  r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
fondoMenu.addEventListener('click', cerrarMenu);
document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) cerrarMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { cerrarMenu(); editor.focus(); } });

// ------------------------------------------------------------------ ver con un ejemplo
function pintarVista(t) {
  if (t === undefined) t = serializar();
  const conValores = (s) => esc(s).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => `<mark>${esc(EJEMPLO[k] != null ? EJEMPLO[k] : RAYA)}</mark>`);
  $('#ec-vista').innerHTML = bloques(t).map((b) => {
    if (b.tipo === 'titulo') return `<h1>${conValores(b.texto)}</h1>`;
    if (b.tipo === 'apartado') return `<h2>${conValores(b.texto)}</h2>`;
    if (b.tipo === 'lista') return `<ul>${b.items.map((i) => `<li>${conValores(i)}</li>`).join('')}</ul>`;
    return `<p>${conValores(b.texto)}</p>`;
  }).join('');
}
function modo(ver) {
  $('#ec-modo-editar').setAttribute('aria-pressed', String(!ver));
  $('#ec-modo-ver').setAttribute('aria-pressed', String(ver));
  $('#ec-zona-editar').hidden = ver;
  $('#ec-zona-ver').hidden = !ver;
  cerrarMenu();
  if (ver) pintarVista();
}
$('#ec-modo-editar').addEventListener('click', () => modo(false));
$('#ec-modo-ver').addEventListener('click', () => modo(true));

// ------------------------------------------------------------------ guardar y volver al de serie
const botonGuardar = $('#ec-guardar');
let guardando = false;
botonGuardar.addEventListener('click', () => {
  const t = serializar();
  const faltan = [['precio_neto', 'Lo que recibe el vendedor'], ['vendedor_dni', 'DNI del vendedor']].filter(([k]) => !tiene(t, k)).map(([, n]) => `«${n}»`);
  if (!t) { L.avisar('El contrato está vacío. Escribe el texto o vuelve al contrato de serie.', 'error'); return; }
  if (faltan.length) {
    L.avisar(`Al contrato le falta ${faltan.join(' y ')}. Ponlo con «Insertar dato» donde deba ir.`, 'error');
    return;
  }
  guardando = true; botonGuardar.disabled = true;
  L.pedir('/api/admin/ajustes', 'POST', { accion: 'plantilla', plantilla: t }).then(() => {
    guardada = t;
    sessionStorage.setItem('lidi-aviso', 'Contrato guardado. Los próximos contratos saldrán con este texto.');
    location.hash = 'contratos';
    location.reload();
  }).catch((err) => { guardando = false; botonGuardar.disabled = false; L.fallo(err); });
});
const botonSerie = $('#ec-serie');
if (botonSerie) {
  botonSerie.addEventListener('click', () => { $('#ec-confirmar').hidden = false; $('#ec-si-serie').focus(); });
  $('#ec-no-serie').addEventListener('click', () => { $('#ec-confirmar').hidden = true; });
  $('#ec-si-serie').addEventListener('click', (e) => {
    const b = e.currentTarget;
    guardando = true; b.disabled = true;
    L.pedir('/api/admin/ajustes', 'POST', { accion: 'plantilla', restaurar: true }).then(() => {
      sessionStorage.setItem('lidi-aviso', 'Vuelve a estar el contrato de serie.');
      location.hash = 'contratos';
      location.reload();
    }).catch((err) => { guardando = false; b.disabled = false; L.fallo(err); });
  });
}
// si se va de la página con cambios sin guardar, el navegador pregunta
addEventListener('beforeunload', (e) => {
  if (guardando || guardada === null || serializar() === guardada) return;
  e.preventDefault(); e.returnValue = '';
});

// ------------------------------------------------------------------ leer el PDF
/** pdf.js (copiado de node_modules al construir, en /js): solo se descarga cuando eligen un PDF. */
function cargarLector() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((ok, mal) => {
    const sinLector = () => Object.assign(new Error('sin lector'), { motivo: 'lector' });
    const s = document.createElement('script');
    s.src = '/js/pdf.min.js';
    s.onload = () => (window.pdfjsLib ? ok(window.pdfjsLib) : mal(sinLector()));
    s.onerror = () => { s.remove(); mal(sinLector()); };
    document.head.appendChild(s);
  });
}

async function leerPdf(bytes) {
  const lib = await cargarLector();
  lib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
  // isEvalSupported: false, para que un PDF con fuentes raras no pueda ejecutar código (CVE-2024-4367)
  const pdf = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const lineas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const { items } = await pagina.getTextContent();
    const enPagina = [];
    for (const it of items) {
      if (!it.str || (!it.str.trim() && !it.width)) continue;
      const x = it.transform[4]; const y = it.transform[5];
      const alto = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
      let l = enPagina.find((o) => Math.abs(o.y - y) < alto * 0.5);
      if (!l) { l = { y, alto, partes: [] }; enPagina.push(l); }
      l.partes.push({ x, w: it.width, s: it.str });
    }
    enPagina.sort((a, b) => b.y - a.y);
    for (const l of enPagina) {
      l.partes.sort((a, b) => a.x - b.x);
      let t = ''; let fin = null;
      for (const p of l.partes) {
        if (fin !== null && p.x - fin > l.alto * 0.18 && !/\s$/.test(t) && !/^\s/.test(p.s)) t += ' ';
        t += p.s; fin = p.x + p.w;
      }
      // algunos PDF guardan «á» como «a» + tilde suelta (y «í» como «ı» + tilde): se juntan
      t = t.normalize('NFC').replace(/ı́/g, 'í').replace(/\s+/g, ' ').trim();
      if (t && !/^(p[aá]g(ina)?\.?\s*)?\d{1,3}(\s*(de|\/)\s*\d{1,3})?$/i.test(t)) lineas.push({ pagina: n, y: l.y, alto: l.alto, texto: t });
    }
  }
  pdf.destroy();
  return { paginas: pdf.numPages, lineas };
}

const esTitulo = (t) => {
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '').length;
  return letras.length >= 4 && t.length <= 90 && mayus / letras.length >= 0.85 && !/_{2,}/.test(t) && !/^([•●▪]|-\s)/.test(t);
};
// «PRIMERA.» en mayúsculas o «Primera.» con punto; «1.», «2)»; y viñetas. No vale «primera vez» a media frase.
const EMPIEZA_CLAUSULA = new RegExp('^((PRIMER|SEGUND|TERCER|CUART|QUINT|SEXT|S[EÉ]PTIM|OCTAV|NOVEN|D[EÉ]CIM|UND[EÉ]CIM|DUOD[EÉ]CIM)[AO]?\\b'
  + '|(Primer|Segund|Tercer|Cuart|Quint|Sext|S[eé]ptim|Octav|Noven|D[eé]cim|Und[eé]cim|Duod[eé]cim)[ao]?\\s*[.:–-]'
  + '|\\d{1,2}[.)º]\\s|[•●▪]\\s?|-\\s)');
const VINETA = /^([•●▪]\s?|-\s)/;
const HUECO_SIMPLE = /_{2,}|\.{5,}|…{2,}/;
// «1. Encargo» o «Primera. Objeto» solos en su línea, cortos y sin rayas: título de apartado
const pareceApartado = (t) => /^(\d{1,2}[.)º]|[A-ZÁÉÍÓÚ][a-záéíóú]+[ao]\s*[.:–-])\s*\S/.test(t) && EMPIEZA_CLAUSULA.test(t)
  && t.length <= 60 && !/[,;:]$/.test(t) && !HUECO_SIMPLE.test(t) && t.split(' ').length <= 8;
// las líneas de firma del final («Firma, Vendedor: …», «Fdo.: …»)
const FIRMA = /^(fdo|firmado|firma\b|firma del|firma de)/;
// «Vendedor: Fulano», «Con fecha: …»: una línea que empieza por una etiqueta corta con dos puntos
const ETIQUETA = /^[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ.ºª ]{1,28}:\s*\S/;

/** Líneas → párrafos: por el espacio entre líneas, los títulos en mayúsculas y las cláusulas («PRIMERA.», «1.»). */
function aParrafos(lineas) {
  const saltos = [];
  for (let i = 1; i < lineas.length; i++) if (lineas[i].pagina === lineas[i - 1].pagina) saltos.push(lineas[i - 1].y - lineas[i].y);
  const ordenados = saltos.filter((s) => s > 0).sort((a, b) => a - b);
  const normal = ordenados.length ? ordenados[Math.floor(ordenados.length * 0.3)] : 14;
  const parrafos = [];
  let previa = null;
  for (const l of lineas) {
    const actual = parrafos[parrafos.length - 1];
    const pegada = !!previa && l.pagina === previa.pagina && previa.y - l.y <= normal * 1.35;
    const cerrada = !previa || /[.:;]$/.test(previa.texto);
    // una línea que sigue una frase sin terminar («…en adelante EL» + «PROPIETARIO.») nunca es un título
    const sigue = !!actual && pegada && !cerrada && !previa.titulo;
    // un título largo puede ocupar dos líneas seguidas en mayúsculas
    if (actual && actual.titulo && pegada && !cerrada && esTitulo(l.texto) && !EMPIEZA_CLAUSULA.test(l.texto)) {
      actual.texto += ` ${l.texto}`; l.titulo = true; previa = l; continue;
    }
    l.titulo = !sigue && esTitulo(l.texto);
    const nuevo = !actual || !previa
      || (l.pagina === previa.pagina ? !pegada : /[.:;]$/.test(actual.texto) || pareceApartado(actual.texto))
      || l.titulo || previa.titulo || EMPIEZA_CLAUSULA.test(l.texto)
      // «1. Encargo» solo en su línea y luego el texto: el título va aparte
      || (actual.texto === previa.texto && pareceApartado(previa.texto) && /^[A-ZÁÉÍÓÚÑ¿¡«"(]/.test(l.texto))
      // una lista de «Etiqueta: dato», cada uno en su línea
      || (ETIQUETA.test(l.texto) && ETIQUETA.test(previa.texto))
      // «Firma, Vendedor: …» después de una frase terminada
      || (cerrada && FIRMA.test(norm(l.texto)));
    if (nuevo) parrafos.push({ texto: l.texto, titulo: l.titulo });
    else if (/[a-záéíóúñ]-$/.test(actual.texto) && /^[a-záéíóúñ]/.test(l.texto)) actual.texto = actual.texto.slice(0, -1) + l.texto;
    else actual.texto += ` ${l.texto}`;
    previa = l;
  }
  // tipo de cada párrafo
  let hayTitulo = false;
  parrafos.forEach((p, i) => {
    if (p.titulo) { p.tipo = !hayTitulo && i < 3 ? 'titulo' : 'apartado'; hayTitulo = true; }
    else if (pareceApartado(p.texto)) p.tipo = 'apartado';
    else if (VINETA.test(p.texto)) { p.tipo = 'item'; p.texto = p.texto.replace(VINETA, ''); }
    else p.tipo = 'parrafo';
  });
  // la zona de firmas del final se quita: el panel pone las firmas solo
  let corte = -1;
  parrafos.forEach((p, i) => { if (/firman|en prueba de conformidad|por duplicado/i.test(norm(p.texto))) corte = i; });
  // desde el final, en el bloque de párrafos cortos: a partir del primer «Firma…» todo es la zona de firmas
  // (nombres y DNI debajo de cada firma)
  // si suben un contrato que ya sacó el panel, firmado: el registro de la firma del final también fuera
  const PIE = /(registro de la firma electronica|huella sha-?256|este documento se firmo de forma electronica)/;
  let pie = parrafos.findIndex((p) => PIE.test(norm(p.texto)));
  if (pie < 0) pie = parrafos.length;
  // debajo de cada firma: «Firma…», «Fdo.…» o el nombre con su DNI (corto y sin frase)
  const esFirma = (t) => FIRMA.test(t) || (t.length <= 120 && /\b(dni|nie|nif)\b/.test(t) && !/[.;]$/.test(t) && !/\b(con|provist[oa])\b/.test(t));
  let primeraFirma = pie;
  for (let i = pie - 1; i >= 0; i--) {
    const t = norm(parrafos[i].texto);
    if (esFirma(t)) primeraFirma = i;
    else if (t.length >= 70) break;
  }
  let quitadas = 0;
  const finales = parrafos.filter((p, i) => {
    const firma = FIRMA.test(norm(p.texto));
    const despuesDeFirmar = (corte >= 0 && i > corte && (p.texto.length < 70 || firma)) || i >= primeraFirma;
    if (firma || despuesDeFirmar) { quitadas++; return false; }
    return true;
  });
  return { parrafos: finales, quitadas };
}

const HUECO = /(?:_{2,}|\.{5,}|…+)\s*de\s+(?:_{2,}|\.{5,}|…+)\s+del?\s+(?:20|19)?(?:_{2,}|\.{3,}|…+)|_{2,}|\.{5,}|…{2,}/gi;
const VENDEDOR = /vendedor|propietari|cliente|comitente|mandante|titular|transmitente/g;
const EMPRESA = /asesor|concesionari|empresa|compraventa|mandatari|intermediari|agencia|sociedad|en nombre de|en representacion/g;

/** De qué parte habla el texto alrededor de la raya: la última mencionada antes; si no, la primera después. */
function ladoEmpresa(antes, despues) {
  const ultima = (t, re) => { let m; let p = -1; re.lastIndex = 0; while ((m = re.exec(t))) p = m.index; return p; };
  const v = ultima(antes, VENDEDOR); const e = ultima(antes, EMPRESA);
  if (v >= 0 || e >= 0) return e > v;
  const v2 = despues.search(new RegExp(VENDEDOR.source)); const e2 = despues.search(new RegExp(EMPRESA.source));
  if (v2 < 0) return e2 >= 0;
  return e2 >= 0 && e2 < v2;
}

// ------------------------------------------------------------------ contratos ya rellenos
// Muchos suben el contrato del último coche, con el nombre, la fecha y la matrícula escritos. Esos datos se reconocen
// y se cambian por datos del panel, para que cada contrato salga con los suyos. Solo los que sabemos qué son.
const MAY = 'A-ZÁÉÍÓÚÑÜ';
const PAL = `[${MAY}][A-Za-z${MAY}áéíóúñü'’-]*`;
const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
const CIFRA = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,2})?';
// palabras que cortan un nombre escrito en mayúsculas («D. JUAN PÉREZ CON DNI…»)
const NO_NOMBRE = /^(con|dni|nie|nif|cif|mayor|vecin[oa]|domicilio|provist[oa]|titular|en|como|que|mediante|actuando|nacid[oa]|residente|natural|el|al|por|para|y)$/;
const recortarNombre = (v) => {
  const pal = v.split(/\s+/); const fuera = pal.findIndex((x, i) => i > 0 && NO_NOMBRE.test(norm(x)));
  const quedan = (fuera > 0 ? pal.slice(0, fuera) : pal);
  while (quedan.length && /^(de|del|la|las|los|y)$/i.test(quedan[quedan.length - 1])) quedan.pop();
  return quedan.length >= 2 ? quedan.join(' ') : '';
};
// Cada patrón: el último grupo es el dato (o todo, si no hay grupos) y va siempre al final de lo encontrado.
// dato(m, antes, despues, parrafo) dice qué es, con el texto normalizado de alrededor; '' = no lo sabemos y se deja.
const RELLENOS = [
  { re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, dato: (m, a, d) => (ladoEmpresa(a, d) ? '' : 'vendedor_email') },
  { re: /\b(?=[A-HJ-NPR-Z0-9]*\d)(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])[A-HJ-NPR-Z0-9]{17}\b/g, dato: () => 'bastidor' },
  { re: /\b[ABCDEFGHJNPQRSUVW]-?\d{7}[0-9A-J]\b/g, dato: () => 'empresa_nif' },
  { re: /\b[XYZ]?\d{7,8}[\s-]?[A-HJ-NP-TV-Z]\b/g, dato: (m, a, d) => (ladoEmpresa(a, d) ? 'empresa_nif' : 'vendedor_dni') },
  { re: /\b\d{4}[\s-]?[BCDFGHJKLMNPRSTVWXYZ]{3}\b/g, dato: () => 'matricula' },
  { re: /(?:[Mm]atr[ií]cula|MATR[IÍ]CULA)\s*(?:n[ºo.]*\s*)?:?\s*([A-Z]{1,2}[\s-]?\d{4}[\s-]?[A-Z]{1,3})(?![\w])/g, dato: () => 'matricula' },
  { re: /(?:tel[eé]fono|tel[fé]?\.?|tlf\.?|tfno\.?|m[oó]vil)\s*(?:de contacto)?\s*:?\s*((?:\+34[\s.-]?)?[6789](?:[\s.-]?\d){8})(?!\d)/gi, dato: (m, a, d) => (ladoEmpresa(a, d) ? '' : 'vendedor_telefono') },
  { re: new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${MESES})\\s+(?:de|del)\\s+\\d{4}\\b|\\b\\d{1,2}[/.-]\\d{1,2}[/.-](?:\\d{4}|\\d{2})\\b`, 'gi'),
    dato: (m, a) => (/(fecha|\ba|\bel dia|\bhoy)\s*:?\s*$/.test(a.slice(-30)) ? 'fecha' : '') },
  { re: new RegExp(`\\b[Ee]n\\s+(${PAL}(?:\\s+(?:de(?:l| la)?\\s+)?${PAL}){0,3})(?=\\s*,?\\s+a\\s+(?:\\d|(?:${MESES})))`, 'g'), dato: () => 'ciudad' },
  // un importe: «24.000 €», «1.000 € + IVA»; si va detrás de «Precio de salida», también la etiqueta (ver más abajo)
  { re: new RegExp(`((?:[Pp]recio de (?:salida|venta)|PRECIO DE (?:SALIDA|VENTA))(?:\\s+(?:acordad[oa]|ACORDAD[OA]))?\\s*:?\\s*)?(\\b${CIFRA}\\s*(?:€|euros?\\b|eur\\b|EUROS?\\b)(?:\\s*\\+\\s*IVA)?)`, 'gi'),
    dato: (m, a) => {
      if (/(penaliz|indemniz|compensaci|incumpl)/.test(a.slice(-90))) return 'penalizacion';
      if (m[1] || /(precio|importe|cantidad|percib|recib|neto|suma|tasaci|valor)/.test(a.slice(-60))) return 'precio_neto';
      if (/(gasto|invert|inversion|a su cargo|a cargo de)/.test(a.slice(-60))) return 'gastos';
      return '';
    } },
  { re: new RegExp(`\\b(${CIFRA})(?=\\s*(?:km|kms|kil[oó]metros)\\b)`, 'gi'), dato: () => 'km' },
  { re: /\b(\d{1,3})(?=\s*d[ií]as\b)/gi, dato: (m, a) => (/(exclusiv|periodo|duracion|vigencia|plazo)/.test(a.slice(-50)) ? 'plazo_dias' : '') },
  { re: /\b(\d{1,2})(?=\s*mes(?:es)?\b)/gi, dato: (m, a, d) => (/garant/.test(a.slice(-40) + d.slice(0, 30)) ? 'garantia_meses' : '') },
  { re: /(?:\ba[ñn]o|\bAÑO)\s*(?:de\s+(?:matriculaci[oó]n|fabricaci[oó]n))?\s*:?\s*((?:19|20)\d{2})\b/gi, dato: () => 'anio' },
  { re: new RegExp(`(?:\\b(?:D|Dña|Dna|Sr|Sra)\\.\\s*|\\b(?:Don|Doña|DON|DOÑA)\\s+|\\b(?:[Nn]ombre(?: y apellidos)?|NOMBRE|[Vv]endedor|VENDEDOR|[Pp]ropietari[oa]|PROPIETARI[OA]|[Cc]liente|CLIENTE|[Tt]itular|TITULAR|[Aa]sesor|ASESOR|[Rr]epresentante|REPRESENTANTE|[Gg]erente|GERENTE)\\s*:\\s*)(${PAL}(?:\\s+(?:(?:de|del|la|las|los|y)\\s+)*${PAL}){1,6})`, 'g'),
    recortar: recortarNombre,
    dato: (m, a, d) => {
      const etiqueta = norm(m[0].slice(0, m[0].length - m[1].length));
      if (/(vendedor|propietari|cliente|titular)/.test(etiqueta)) return 'vendedor_nombre';
      if (/(asesor|representante|gerente)/.test(etiqueta)) return 'empresa_representante';
      return ladoEmpresa(a, d) ? 'empresa_representante' : 'vendedor_nombre';
    } },
  // «…y de otra, el VENDEDOR, Fulano Pérez, con DNI…»
  { re: new RegExp(`\\b(?:el|la|El|La|EL|LA)\\s+(VENDEDOR|[Vv]endedor|PROPIETARI[OA]|[Pp]ropietari[oa]|ASESOR|[Aa]sesor|REPRESENTANTE|[Rr]epresentante)\\s*,\\s*(${PAL}(?:\\s+(?:(?:de|del|la|las|los|y)\\s+)*${PAL}){1,6})(?=\\s*,)`, 'g'),
    recortar: recortarNombre,
    dato: (m) => (/(asesor|representante)/.test(norm(m[1])) ? 'empresa_representante' : 'vendedor_nombre') },
  { re: /\b(?:con\s+)?domicilio(?:\s+(?:social|a efectos de notificaciones))?\s*(?:en|:)\s*([^;_]{5,90}?)(?=\s*(?:,\s*(?:con|y|provist[oa]|titular|mayor|en adelante|DNI|NIE|NIF|CIF|tel[eé]fono)\b|\s+(?:y|con)\s+(?:DNI|NIE|NIF|CIF|D\.N\.I)|;|\.\s|\.$|$))/gi,
    dato: (m, a, d) => (ladoEmpresa(a, d) ? 'empresa_domicilio' : 'vendedor_domicilio') },
  { re: /(?:\b(?:[Mm]arca y modelo|MARCA Y MODELO|[Vv]eh[ií]culo|VEH[IÍ]CULO)\s*:|\b(?:[Mm]arca|MARCA)\s*:?)\s*([A-Z0-9ÁÉÍÓÚÑ][^,;:]{1,50}?)(?=\s*(?:,|;|\.\s|\.$|$|\b(?:con|y)\s+(?:matr|bastidor|n[uú]mero)|\b(?:[Mm]atr[ií]cula|MATR[IÍ]CULA|[Bb]astidor|BASTIDOR)\b))/g,
    dato: () => 'coche' },
];
// «Precio de salida acordado: 24.000 €»: el panel pone ahí lo que recibe el vendedor (no el precio de venta), así que
// la etiqueta se cambia también, para que el contrato diga lo que es
const ETIQUETA_PERCIBE = 'Cantidad que percibirá el Vendedor: ';
/** La etiqueta que va delante de un dato escrito: la de antes, o la nueva si pasa a ser lo que recibe el vendedor. */
const etiquetaDe = (x) => (!x.etiqueta || x.elegido === '=' ? '' : x.elegido === 'precio_neto' ? ETIQUETA_PERCIBE : x.etiqueta.replace(/\s*$/, ' '));

/** Los datos ya escritos en un párrafo: [{ini, fin, dato, etiqueta}] sin solaparse (gana el primer patrón). */
function buscarRellenos(texto) {
  const hallados = [];
  for (const r of RELLENOS) {
    const re = new RegExp(r.re.source, r.re.flags);
    let m;
    while ((m = re.exec(texto))) {
      if (!m[0]) { re.lastIndex++; continue; }
      const grupo = m.length > 1 ? m[m.length - 1] : m[0];
      if (!grupo) continue;
      let ini = m.index + m[0].length - grupo.length;
      const valor = r.recortar ? r.recortar(grupo) : grupo;
      if (!valor || HUECO_SIMPLE.test(valor)) continue;
      const fin = ini + valor.length;
      const dato = r.dato(m, norm(texto.slice(0, ini)), norm(texto.slice(fin)), norm(texto));
      if (!dato) continue;
      // la etiqueta «Precio de salida» entra en el dato, para cambiarla
      let etiqueta = '';
      if (dato === 'precio_neto' && m.length > 2 && m[1]) { etiqueta = m[1]; ini -= m[1].length; }
      if (hallados.some((h) => ini < h.fin && h.ini < fin)) continue;
      hallados.push({ ini, fin, dato, etiqueta });
    }
  }
  return hallados;
}

/** Qué dato va en la raya, por las palabras de alrededor. '' si no lo sabe. */
function adivinar(antesRaw, despuesRaw, parrafoRaw, esFecha) {
  if (esFecha) return 'fecha';
  const antes = norm(antesRaw); const a = antes.slice(-60); const d = norm(despuesRaw).slice(0, 30); const p = norm(parrafoRaw);
  const emp = ladoEmpresa(antes, norm(despuesRaw));
  if (/(^|[\s.,])en\s*$/.test(a) && /^\s*,?\s*a\s/.test(d)) return 'ciudad';
  if (/(lugar|ciudad|localidad)\s*:?\s*(de\s*)?$/.test(a)) return 'ciudad';
  if (/fecha\s*:?\s*$/.test(a)) return 'fecha';
  if (/(dni|nie|nif|cif|d\.n\.i\.?|documento|pasaporte)[^_]{0,14}$/.test(a)) return emp ? 'empresa_nif' : 'vendedor_dni';
  if (/(domicilio|direccion|residente|vecino de|calle)[^_]{0,16}$/.test(a)) return emp ? 'empresa_domicilio' : 'vendedor_domicilio';
  if (/(telefono|tlf|tfno|movil)[^_]{0,12}$/.test(a)) return 'vendedor_telefono';
  if (/(correo|e-?mail)[^_]{0,20}$/.test(a)) return 'vendedor_email';
  if (/matricula[^_]{0,14}$/.test(a)) return 'matricula';
  if (/(bastidor|vin|chasis)[^_]{0,16}$/.test(a)) return 'bastidor';
  if (/^\s*(km|kms|kilometros)\b/.test(d) || /(kilometr|\bkm)[^_]{0,12}$/.test(a)) return 'km';
  if (/^\s*dias/.test(d)) return 'plazo_dias';
  if (/^\s*mes(es)?\b/.test(d)) return 'garantia_meses';
  if (/(\bano\b|matriculacion)[^_]{0,14}$/.test(a)) return 'anio';
  if (/(penaliz|indemniz|incumpl|retira|por su cuenta|compensaci)/.test(p) && !/precio[^_]{0,25}$/.test(a)) return 'penalizacion';
  if (/(precio|importe|cantidad|suma)[^_]{0,30}$/.test(a) || /^\s*(euros|eur\b|€)/.test(d)) return 'precio_neto';
  if (/(marca|modelo|vehiculo|automovil|turismo|coche|version)[^_]{0,26}$/.test(a)) return 'coche';
  if (/(en nombre de|en representacion de|razon social|mercantil|la empresa)[^_]{0,8}$/.test(a)) return 'empresa_nombre';
  if (/(\bd\.|\bdna\.|\bdon\b|\bdona\b|\bsr\.|\bsra\.|nombre( y apellidos)?|d\.\/dna\.|d\/dna\.?)[^_]{0,8}$/.test(a)) return emp ? 'empresa_representante' : 'vendedor_nombre';
  if (/(vendedor|propietari\w*|cliente|titular)\s*,?\s*$/.test(a)) return 'vendedor_nombre';
  if (/(asesor|concesionari\w*|mandatari\w*)\s*,?\s*$/.test(a)) return 'empresa_representante';
  if (/\bde\s*$/.test(a) && emp) return 'empresa_nombre';
  return '';
}

/** Parte cada párrafo en trozos de texto, rayas y datos ya escritos; adivina cada raya. */
function buscarHuecos(parrafos) {
  const huecos = [];
  for (const p of parrafos) {
    const t = p.texto;
    const rayas = [];
    const re = new RegExp(HUECO.source, 'gi');
    let m;
    while ((m = re.exec(t))) rayas.push({ ini: m.index, fin: m.index + m[0].length, esFecha: /\sde\s/i.test(m[0]) });
    const escritos = buscarRellenos(t).filter((r) => !rayas.some((x) => r.ini < x.fin && x.ini < r.fin));
    const trozos = rayas.concat(escritos).sort((a, b) => a.ini - b.ini);
    // el texto de alrededor, con las rayas y los datos escritos como «___»
    const sinRayas = (desde, hasta) => {
      let s = ''; let i = desde;
      for (const x of trozos) {
        if (x.fin <= desde || x.ini >= hasta) continue;
        s += `${t.slice(i, Math.max(i, x.ini))}___`; i = Math.max(i, x.fin);
      }
      return s + t.slice(i, hasta);
    };
    p.partes = [];
    let desde = 0;
    for (const x of trozos) {
      if (x.ini > desde) p.partes.push(t.slice(desde, x.ini));
      const antes = sinRayas(0, x.ini);
      const despues = sinRayas(x.fin, t.length);
      let h;
      if (x.dato) {
        h = { n: huecos.length + 1, antes, despues, sugerido: x.dato, elegido: x.dato, escrito: true, valor: t.slice(x.ini, x.fin), etiqueta: x.etiqueta };
      } else {
        const sugerido = adivinar(antes, despues, t, x.esFecha);
        h = { n: huecos.length + 1, antes, despues, sugerido, elegido: sugerido };
      }
      huecos.push(h); p.partes.push(h);
      desde = x.fin;
    }
    if (desde < t.length) p.partes.push(t.slice(desde));
  }
  return huecos;
}

/** Lo que sale en la plantilla en lugar de una raya o de un dato escrito. */
function enPlantilla(x) {
  if (x.elegido === '=') return x.valor; // dejar lo que ponía
  return etiquetaDe(x) + (x.elegido ? `{{${x.elegido}}}` : RAYA);
}

/** Párrafos con sus datos elegidos → formato del panel. */
function aPlantilla(parrafos) {
  const salida = [];
  for (const p of parrafos) {
    const t = p.partes.map((x) => (typeof x === 'string' ? x : enPlantilla(x))).join('').replace(/\s+/g, ' ').trim()
      // los importes del panel ya llevan «euros» o «€ + IVA»: «____ euros» no puede quedar «9.000 euros euros»
      .replace(/(\{\{(?:precio_neto|gastos|penalizacion)\}\})\s*(?:€|euros?\b|eur\b)(?:\s*\+\s*IVA\b)?/gi, '$1');
    if (!t) continue;
    if (p.tipo === 'titulo') salida.push({ tipo: 't', s: `# ${t}` });
    else if (p.tipo === 'apartado') salida.push({ tipo: 't', s: `## ${t}` });
    else if (p.tipo === 'item') {
      const ult = salida[salida.length - 1];
      if (ult && ult.tipo !== 't') { ult.s += `\n- ${t}`; ult.tipo = 'l'; } else salida.push({ tipo: 'l', s: `- ${t}` });
    } else salida.push({ tipo: 'p', s: t });
  }
  return salida.map((b) => b.s).join('\n\n');
}

// ------------------------------------------------------------------ pantalla de revisión
let leido = null;
function opciones(elegido, h) {
  return (h && h.escrito ? `<option value="="${elegido === '=' ? ' selected' : ''}>Dejar lo que pone: «${esc(recorte(h.valor, 32, false))}»</option>` : '')
    + `<option value=""${elegido ? '' : ' selected'}>${h && h.escrito ? 'Poner una raya en blanco' : 'Dejar la raya en blanco'}</option>`
    + GRUPOS.map(([grupo, lista]) => `<optgroup label="${grupo}">${lista.map(([k, corto]) => `<option value="${k}"${k === elegido ? ' selected' : ''}>${esc(corto)}</option>`).join('')}</optgroup>`).join('');
}
function recorte(t, n, alFinal) {
  t = t.replace(/\s+/g, ' ');
  if (t.length <= n) return t;
  if (alFinal) { const c = t.slice(-n); return `…${c.slice(c.indexOf(' ') + 1)}`; }
  const c = t.slice(0, n); return `${c.slice(0, c.lastIndexOf(' '))}…`;
}
const textoAqui = (h) => (h.elegido === '=' ? h.valor : h.elegido ? DATOS[h.elegido].corto : 'aquí');
const notaPrecio = (h) => (h.etiqueta && h.elegido === 'precio_neto' ? '. Pasa a decir «Cantidad que percibirá el Vendedor», porque el panel pone aquí lo que recibe él, no el precio de venta.' : '');
function pintarRevision() {
  const { huecos, nombre, paginas, quitadas } = leido;
  const rayas = huecos.filter((h) => !h.escrito); const escritos = huecos.filter((h) => h.escrito);
  const adivinados = rayas.filter((h) => h.sugerido).length;
  const leidoTxt = `Hemos leído «${esc(nombre)}»: ${paginas} ${paginas === 1 ? 'página' : 'páginas'}`;
  const nRayas = `${rayas.length} ${rayas.length === 1 ? 'raya' : 'rayas'} para rellenar`;
  const nEscritos = `${escritos.length} ${escritos.length === 1 ? 'dato ya escrito' : 'datos ya escritos'}`;
  const deEscritos = 'Los datos escritos (nombres, fecha, matrícula, importes…) los hemos cambiado por datos del panel, para que cada contrato salga con los del vendedor y el coche de ese momento.';
  let resumen;
  if (rayas.length && escritos.length) resumen = `<b>${leidoTxt}, ${nRayas} y ${nEscritos}.</b>${deEscritos} De las rayas hemos adivinado ${adivinados} de ${rayas.length}. Repásalo: si algo no es, cámbialo.`;
  else if (escritos.length) resumen = `<b>${leidoTxt}. Está relleno: hemos encontrado ${nEscritos}.</b>${deEscritos} Repásalos: si alguno no es, cámbialo o deja lo que ponía.`;
  else if (rayas.length) resumen = `<b>${leidoTxt} y ${nRayas}.</b>Hemos adivinado ${adivinados} de ${rayas.length}. Repásalas: si alguna no es, cámbiala.`;
  else resumen = `<b>Hemos leído «${esc(nombre)}», pero no tiene rayas ni datos que sepamos reconocer.</b>Pásalo al editor y pon los datos con «Insertar dato».`;
  $('#ec-resumen').innerHTML = resumen + (quitadas ? ' La zona de firmas del final la quitamos, porque el panel pone las firmas él solo.' : '');
  let nr = 0; let ne = 0;
  $('#ec-lista-huecos').innerHTML = huecos.map((h) => `
    <li class="ec-hueco${h.elegido ? '' : ' ec-falta'}" data-n="${h.n}">
      <div class="ec-cabeza"><span>${h.escrito ? `Dato escrito ${++ne}` : `Raya ${++nr}`}</span>${h.escrito ? '<span class="ec-etiqueta ec-ok">Reconocido</span>' : h.sugerido ? '<span class="ec-etiqueta ec-ok">Adivinado</span>' : '<span class="ec-etiqueta ec-mira">Elige qué va</span>'}</div>
      <p class="ec-contexto">${esc(recorte(h.antes, 70, true))}<span class="ec-etq">${esc(etiquetaDe(h))}</span><span class="ec-aqui">${esc(textoAqui(h))}</span>${esc(recorte(h.despues, 40, false))}</p>
      ${h.escrito ? `<p class="ec-ponia">Ponía: «${esc(h.valor)}»<span class="ec-cambia">${esc(notaPrecio(h))}</span></p>` : ''}
      <label class="ec-elegir">¿Qué va aquí? <select data-n="${h.n}">${opciones(h.elegido, h)}</select></label>
    </li>`).join('');
  contarFaltan();
}
function contarFaltan() {
  const n = leido.huecos.filter((h) => !h.elegido).length;
  $('#ec-faltan').textContent = n ? `${n} ${n === 1 ? 'raya se quedará en blanco' : 'rayas se quedarán en blanco'}` : '';
}
$('#ec-lista-huecos').addEventListener('change', (e) => {
  const sel = e.target.closest('select'); if (!sel) return;
  const h = leido.huecos[Number(sel.dataset.n) - 1];
  h.elegido = sel.value;
  const li = sel.closest('.ec-hueco');
  li.classList.toggle('ec-falta', !h.elegido);
  li.querySelector('.ec-aqui').textContent = textoAqui(h);
  li.querySelector('.ec-etq').textContent = etiquetaDe(h);
  const cambia = li.querySelector('.ec-cambia'); if (cambia) cambia.textContent = notaPrecio(h);
  contarFaltan();
});

function mostrar(paso) {
  $('#ec-paso-subir').hidden = paso !== 'subir';
  $('#ec-leyendo').hidden = paso !== 'leyendo';
  $('#ec-paso-revisar').hidden = paso !== 'revisar';
  if (paso !== 'subir') $('#ec-error-pdf').hidden = true;
}
function falloPdf(t) { mostrar('subir'); const e = $('#ec-error-pdf'); e.textContent = t; e.hidden = false; }

async function abrirPdf(bytes, nombre) {
  mostrar('leyendo');
  try {
    const { paginas, lineas } = await leerPdf(bytes);
    const total = lineas.reduce((s, l) => s + l.texto.length, 0);
    if (total < 40) return falloPdf('Este PDF parece una foto o un escaneo: no tiene texto que leer. Escribe el contrato en «Cambiar el texto aquí».');
    const { parrafos, quitadas } = aParrafos(lineas);
    const huecos = buscarHuecos(parrafos);
    leido = { nombre, paginas, parrafos, huecos, quitadas };
    mostrar('revisar');
    pintarRevision();
    irA($('#ec-resumen'));
  } catch (err) {
    console.error(err);
    if (err && err.motivo === 'lector') return falloPdf('No se ha podido cargar el lector de PDF. Revisa la conexión y vuelve a probar.');
    if (err && err.name === 'PasswordException') return falloPdf('Este PDF tiene contraseña. Ábrelo, guárdalo sin contraseña y vuelve a subirlo.');
    falloPdf('No hemos podido abrir este archivo. ¿Seguro que es un PDF?');
  }
}
function leerArchivo(f) {
  if (!f) return;
  if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return falloPdf('Eso no es un PDF. Si lo tienes en Word, guárdalo como PDF y súbelo.');
  if (f.size > 15 * 1024 * 1024) return falloPdf('El PDF pesa demasiado (más de 15 MB).');
  f.arrayBuffer().then((b) => abrirPdf(new Uint8Array(b), f.name), () => falloPdf('No hemos podido abrir este archivo. ¿Seguro que es un PDF?'));
}
$('#ec-archivo').addEventListener('change', (e) => { leerArchivo(e.target.files[0]); e.target.value = ''; });
const zona = $('#ec-zona');
zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('ec-encima'); });
zona.addEventListener('dragleave', () => zona.classList.remove('ec-encima'));
zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('ec-encima'); leerArchivo(e.dataTransfer.files[0]); });
$('#ec-otro').addEventListener('click', () => { leido = null; mostrar('subir'); });

let antesDeImportar = null;
$('#ec-pasar').addEventListener('click', () => {
  antesDeImportar = serializar();
  cargar(aPlantilla(leido.parrafos));
  $('#ec-banner-texto').textContent = `Hemos pasado «${leido.nombre}» al editor. Repásalo y pulsa «Guardar el contrato».`;
  $('#ec-banner').hidden = false;
  modo(false);
  abrir('texto');
  irA($('.ec-pestanas'));
});
$('#ec-deshacer-import').addEventListener('click', () => {
  if (antesDeImportar != null) cargar(antesDeImportar);
  $('#ec-banner').hidden = true;
});

// ------------------------------------------------------------------ al abrir la página
// lo guardado y el de serie, pasados por el editor, para comparar con lo que hay en cada momento
cargar(PLANTILLA_SERIE);
serie = serializar();
cargar(datos.plantilla || PLANTILLA_SERIE);
guardada = serializar();
actualizar();
})();
