/* Página de firma del vendedor: rellena los huecos del texto al escribir, recoge la firma y descarga la copia en PDF. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function cargarPdf() {
    if (window.ContratoPDF) return Promise.resolve(window.ContratoPDF);
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = '/js/contrato-pdf.js';
      s.onload = function () { window.ContratoPDF ? ok(window.ContratoPDF) : mal(new Error('No se ha podido preparar el PDF.')); };
      s.onerror = function () { mal(new Error('No hay conexión. Vuelve a intentarlo.')); };
      document.head.appendChild(s);
    });
  }
  function descargar(token, boton, error) {
    var texto = boton.textContent;
    boton.disabled = true; boton.textContent = 'Preparando el PDF…'; error.hidden = true;
    fetch('/api/firmar/' + encodeURIComponent(token), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'No se ha podido descargar.');
        return cargarPdf().then(function (pdf) { return pdf.descargar(j.pdf, 'acuerdo-firmado-' + j.pdf.id + '.pdf'); });
      })
      .catch(function (e) { error.textContent = e.message || 'No se ha podido descargar.'; error.hidden = false; })
      .then(function () { boton.disabled = false; boton.textContent = texto; });
  }

  var firmado = $('[data-firmado]');
  if (firmado) $('[data-descargar]', firmado).addEventListener('click', function () { descargar(firmado.getAttribute('data-token'), this, $('[data-error]', firmado)); });

  var form = $('[data-firmar]');
  if (!form) return;
  var token = form.getAttribute('data-token');
  var error = $('[data-error]', form);
  // apunta que el vendedor ha abierto el enlace (solo un navegador de verdad: las vistas previas no ejecutan esto)
  if (!form.getAttribute('data-visto')) fetch('/api/firmar/' + encodeURIComponent(token), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"visto":true}' }).catch(function () {});

  // lo que escribe sale en el texto del acuerdo
  $$('input[type=text]', form).forEach(function (input) {
    var pintar = function () {
      $$('[data-hueco="' + input.name + '"]').forEach(function (h) {
        var v = input.value.trim();
        h.textContent = v || '…';
        h.classList.toggle('lleno', !!v);
      });
      if (input.value.trim()) input.classList.remove('error');
    };
    input.addEventListener('input', pintar);
    pintar();
  });

  // firma con el dedo o el ratón
  var caja = $('[data-lienzo]', form);
  var lienzo = $('canvas', caja);
  var pista = $('[data-pista]', caja);
  var ctx = lienzo.getContext('2d');
  var trazos = 0;
  var dibujando = false;
  var ultimo = null;
  function ajustar() {
    var r = caja.getBoundingClientRect();
    var k = Math.min(window.devicePixelRatio || 1, 2);
    var copia = trazos ? lienzo.toDataURL('image/png') : null;
    lienzo.width = Math.round(r.width * k);
    lienzo.height = Math.round(r.height * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f4d';
    if (copia) { var img = new Image(); img.onload = function () { ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = copia; }
  }
  ajustar();
  var ancho = window.innerWidth;
  window.addEventListener('resize', function () { if (Math.abs(window.innerWidth - ancho) > 40) { ancho = window.innerWidth; ajustar(); } });
  function punto(e) { var r = lienzo.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  lienzo.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    dibujando = true; ultimo = punto(e);
    lienzo.setPointerCapture && lienzo.setPointerCapture(e.pointerId);
    ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#0b1f4d'; ctx.fill();
    pista.hidden = true; caja.classList.remove('error');
  });
  lienzo.addEventListener('pointermove', function (e) {
    if (!dibujando) return;
    e.preventDefault();
    var p = punto(e);
    ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo = p;
  });
  var soltar = function () { if (dibujando) { dibujando = false; trazos++; } };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('pointerleave', soltar);
  $('[data-borrar-firma]', form).addEventListener('click', function () {
    ctx.clearRect(0, 0, lienzo.width, lienzo.height); trazos = 0; pista.hidden = false;
  });
  /** La firma recortada a lo dibujado, con fondo transparente, como PNG. */
  function firmaPng() {
    var w = lienzo.width, h = lienzo.height, datos = ctx.getImageData(0, 0, w, h).data;
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) {
      if (datos[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0 || x1 - x0 < 20) return null;
    var m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
    var c = document.createElement('canvas');
    var k = Math.min(1, 900 / (x1 - x0));
    c.width = Math.round((x1 - x0) * k); c.height = Math.round((y1 - y0) * k);
    c.getContext('2d').drawImage(lienzo, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.hidden = true;
    var d = {};
    var faltan = [];
    $$('input[type=text]', form).forEach(function (i) { d[i.name] = i.value.trim(); i.classList.remove('error'); if (i.required && !d[i.name]) faltan.push(i); });
    d.acepto = $('[name=acepto]', form).checked;
    d.firma = trazos ? firmaPng() : null;
    var mal = function (texto, el) { error.textContent = texto; error.hidden = false; if (el) { el.classList.add('error'); if (el.focus) el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
    if (faltan.length) { faltan.forEach(function (i) { i.classList.add('error'); }); return mal('Rellena los campos marcados.', faltan[0]); }
    if (!d.firma) return mal('Falta tu firma: dibújala en el recuadro.', caja);
    if (!d.acepto) return mal('Marca la casilla para confirmar que lo has leído.', $('[name=acepto]', form));
    var boton = $('[type=submit]', form);
    boton.disabled = true; boton.textContent = 'Firmando…';
    fetch('/api/firmar/' + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'La web ha tenido un problema. Vuelve a intentarlo.' }; }); })
      .then(function (j) {
        if (!j.ok) {
          var el = j.campo === 'firma' ? caja : j.campo ? $('[name="' + j.campo + '"]', form) : null;
          mal(j.error || 'No se ha podido firmar.', el);
          boton.disabled = false; boton.textContent = 'Firmar el acuerdo';
          return;
        }
        location.reload();
      })
      .catch(function () { mal('No hay conexión. Revisa la cobertura y vuelve a intentarlo.'); boton.disabled = false; boton.textContent = 'Firmar el acuerdo'; });
  });
})();
