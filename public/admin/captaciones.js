/* Panel: captaciones (ficha, tasación y contrato), firma en Ajustes y «Captar» en la calculadora.
   Usa las utilidades de admin.js (window.LIDI). */
(function () {
  'use strict';
  var L = window.LIDI;
  if (!L) return;
  var $ = L.$, $$ = L.$$, euros = L.euros, avisar = L.avisar, pedir = L.pedir, fallo = L.fallo;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var miles = function (n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var eur = function (n) { return n == null ? '—' : (n < 0 ? '-' : '') + euros(n); };
  var leerJson = function (sel, por) { var el = $(sel); try { return el ? JSON.parse(el.textContent || 'null') : por; } catch (e) { return por; } };

  /** Ventana con un texto y botones que pueden ser enlaces (los enlaces abiertos al pulsar no los bloquea el navegador). */
  function dialogo(titulo, cuerpoHtml, botones, alCerrar) {
    var d = document.createElement('dialog');
    d.className = 'pregunta';
    d.innerHTML = '<h2></h2><div class="cuerpo-dialogo">' + cuerpoHtml + '</div><div class="botonera"></div>';
    $('h2', d).textContent = titulo;
    var cerrar = function () { if (d.open && d.close) d.close(); d.remove(); if (alCerrar) alCerrar(); };
    botones.forEach(function (b) {
      var el = document.createElement(b.href ? 'a' : 'button');
      el.className = b.clase || 'boton secundario';
      el.textContent = b.texto;
      if (b.href) { el.href = b.href; el.target = '_blank'; el.rel = 'noopener'; }
      else el.type = 'button';
      el.addEventListener('click', function (e) { if (b.hacer) b.hacer(e, el); if (b.cierra !== false) setTimeout(cerrar, b.href ? 300 : 0); });
      $('.botonera', d).appendChild(el);
    });
    d.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(); });
    document.body.appendChild(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    return d;
  }
  function copiar(texto, el) {
    var hecho = function () { if (el) { var t = el.textContent; el.textContent = '¡Copiado!'; setTimeout(function () { el.textContent = t; }, 1600); } else avisar('Enlace copiado', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).then(hecho).catch(function () { prompt('Copia el enlace:', texto); });
    prompt('Copia el enlace:', texto);
    return Promise.resolve();
  }

  // ------------------------------------------------------------ tasación (ficha de captación y calculadora)
  var FUENTES = ['cochesnet', 'autoscout'];
  function pintarTasacion(caja, t, usar) {
    var res = $('[data-tasacion-resultado]', caja);
    if (!t) { res.innerHTML = ''; return; }
    var errores = (t.errores || []).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('');
    var busquedas = (t.busquedas || []).map(function (b) { return '<a href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer">Ver la búsqueda en ' + esc(b.fuente) + ' ↗</a>'; }).join(' · ');
    if (!t.n || t.n < 3) {
      res.innerHTML = '<p class="suave">' + (t.n ? 'Solo he encontrado ' + t.n + (t.n === 1 ? ' coche parecido' : ' coches parecidos') + (t.mediana ? ' (alrededor de ' + eur(t.mediana) + ')' : '') + ': pocos para fiarse.' : 'No he encontrado coches parecidos a la venta.') + ' Revisa la marca, el modelo, el año y los km, o míralo a mano.</p>' +
        (busquedas ? '<p class="suave">' + busquedas + '</p>' : '') + (errores ? '<ul class="suave errores-tasacion">' + errores + '</ul>' : '');
      return;
    }
    var fuentes = Object.keys(t.fuentes || {}).map(function (f) { return esc(f) + ' ' + t.fuentes[f]; }).join(', ');
    var grupos = [];
    if (t.profesionales && t.profesionales.mediana) grupos.push('Profesionales: <b>' + eur(t.profesionales.mediana) + '</b> (' + t.profesionales.n + ')');
    if (t.particulares && t.particulares.mediana) grupos.push('Particulares: <b>' + eur(t.particulares.mediana) + '</b> (' + t.particulares.n + ')');
    var filas = (t.comparables || []).map(function (c) {
      var titulo = esc(c.titulo || 'Anuncio');
      return '<tr><td>' + (c.url ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer">' + titulo + '</a>' : titulo) + '<div class="suave">' + esc([c.fuente, c.profesional === true ? 'profesional' : c.profesional === false ? 'particular' : null, c.provincia].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td>' + (c.anio || '') + '</td><td class="num">' + (c.km != null ? miles(c.km) + ' km' : '') + '</td><td class="num">' + (c.cv ? c.cv + ' CV' : '') + '</td><td class="num"><b>' + eur(c.precio) + '</b></td></tr>';
    }).join('');
    var f = t.filtros || {};
    var filtroTxt = [f.anioDesde ? 'de ' + f.anioDesde + ' a ' + f.anioHasta : null, f.kmHasta != null ? 'entre ' + miles(f.kmDesde) + ' y ' + miles(f.kmHasta) + ' km' : null, f.combustible, f.cambio, f.cv ? 'potencia parecida' : null].filter(Boolean).join(', ');
    res.innerHTML = '<div class="tasacion-cifra"><span class="suave">Precio de mercado estimado</span><b>' + eur(t.estimado) + '</b><span class="suave">entre ' + eur(t.p25) + ' y ' + eur(t.p75) + ' · ' + t.n + ' coches (' + fuentes + ')</span></div>' +
      (grupos.length ? '<p class="suave" style="margin:6px 0">' + grupos.join(' · ') + '</p>' : '') +
      (t.euros_por_1000_km ? '<p class="suave" style="margin:6px 0">Cada 1.000 km de más, unos ' + eur(t.euros_por_1000_km) + ' menos.</p>' : '') +
      '<div class="botonera" style="margin:8px 0"><button type="button" class="boton pequeno" data-usar-tasacion>Usar ' + eur(t.estimado) + ' como precio de venta</button></div>' +
      '<details><summary class="suave">Los coches parecidos (' + (t.comparables || []).length + ')' + (filtroTxt ? ': ' + esc(filtroTxt) : '') + '</summary><div class="tabla-desliza"><table class="tabla"><tbody>' + filas + '</tbody></table></div>' +
      (t.descartados ? '<p class="suave">Quitados ' + t.descartados + ' con precios fuera de mercado.</p>' : '') + (busquedas ? '<p class="suave">' + busquedas + '</p>' : '') + '</details>' +
      (errores ? '<ul class="suave errores-tasacion">' + errores + '</ul>' : '') +
      '<p class="suave" style="margin-top:6px">Tasado el ' + new Date(t.fecha).toLocaleDateString('es-ES') + '. Son precios de anuncio: lo que se paga al final suele ser algo menos.</p>';
    var b = $('[data-usar-tasacion]', res);
    if (b && usar) b.addEventListener('click', function () { usar(t.estimado); });
  }
  function tasar(caja, datos, captacionId, usar) {
    var boton = $('[data-tasar]', caja);
    var res = $('[data-tasacion-resultado]', caja);
    if (!datos.marca || !datos.modelo) { avisar('Pon la marca y el modelo para tasar.', 'error'); return Promise.resolve(); }
    var texto = boton.textContent;
    boton.disabled = true; boton.textContent = 'Tasando…';
    res.innerHTML = '<p class="suave">Buscando coches parecidos en coches.net y AutoScout24…</p>';
    var comparables = [], errores = [], busquedas = [];
    var NOMBRE = { cochesnet: 'coches.net', autoscout: 'AutoScout24' };
    var buscar = function (f, otra) {
      return pedir('/api/admin/tasar', 'POST', { fuente: f, datos: datos }).then(function (j) { return j.reintentar && !otra ? buscar(f, true) : j; });
    };
    return Promise.all(FUENTES.map(function (f) {
      return buscar(f).then(function (j) {
        comparables = comparables.concat(j.comparables || []);
        if (j.busqueda) busquedas.push({ fuente: NOMBRE[f], url: j.busqueda });
      }).catch(function (e) { if (e.message === 'sesion') throw e; errores.push(e.message); });
    })).then(function () {
      return pedir('/api/admin/tasar', 'POST', { calcular: true, datos: datos, comparables: comparables, busquedas: busquedas, errores: errores, captacion_id: captacionId || null });
    }).then(function (j) {
      pintarTasacion(caja, j.tasacion, usar);
      boton.textContent = 'Volver a tasar';
    }).catch(function (e) { fallo(e); res.innerHTML = ''; boton.textContent = texto; })
      .then(function () { boton.disabled = false; });
  }

  // ------------------------------------------------------------ nueva captación desde un enlace
  var nueva = $('[data-nueva-captacion]');
  if (nueva) nueva.addEventListener('submit', function (e) {
    e.preventDefault();
    var url = nueva.elements.url.value.trim();
    if (!url) return;
    var b = $('[type=submit]', nueva);
    b.disabled = true; b.textContent = 'Leyendo el anuncio…';
    pedir('/api/admin/captaciones', 'POST', { url: url }).then(function (j) {
      if (j.aviso) sessionStorage.setItem('lidi-aviso', j.aviso);
      location.href = '/admin/captaciones/' + j.id + '?nueva=1';
    }).catch(function (err) { fallo(err); b.disabled = false; b.textContent = 'Captar este coche'; });
  });

  // ------------------------------------------------------------ mensajes de «Vende tu coche»: a captación
  $$('[data-captar-mensaje]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.disabled = true;
      pedir('/api/admin/captaciones', 'POST', { mensaje_id: Number(b.getAttribute('data-captar-mensaje')) }).then(function (j) { location.href = '/admin/captaciones/' + j.id + '?nueva=1'; })
        .catch(function (err) { fallo(err); b.disabled = false; });
    });
  });

  // ------------------------------------------------------------ calculadora: captar el coche leído
  var captar = $('[data-captar]');
  var calc = $('[data-calculadora]');
  if (captar && calc) captar.addEventListener('click', function () {
    var a = L.anuncio || {};
    var el = calc.elements;
    var datos = Object.assign({}, a, { anio: el.anio.value || a.anio, km: el.km.value || a.km, precio: el.precio_compra.value || a.precio, titulo: el.titulo.value || a.titulo });
    captar.disabled = true;
    pedir('/api/admin/captaciones', 'POST', { url: el.url.value || null, datos: datos }).then(function (j) { location.href = '/admin/captaciones/' + j.id + '?nueva=1'; })
      .catch(function (err) { fallo(err); captar.disabled = false; });
  });
  var tasCalc = $('[data-tasacion-calc]');
  if (tasCalc && calc) $('[data-tasar]', tasCalc).addEventListener('click', function () {
    var el = calc.elements;
    var a = L.anuncio || {};
    var datos = { marca: el.marca.value, modelo: el.modelo.value, version: el.version.value, anio: el.anio.value, km: el.km.value, combustible: el.combustible.value, cambio: el.cambio.value, potencia_cv: el.potencia_cv.value, url: el.url.value, cochesnet: a.cochesnet || null };
    if (!datos.marca || !datos.modelo) { avisar('Lee primero un anuncio (necesito la marca y el modelo).', 'error'); return; }
    tasar(tasCalc, datos, null, function (precio) { el.precio_venta.value = precio; el.precio_venta.dispatchEvent(new Event('input', { bubbles: true })); avisar('Precio de venta puesto', 'ok'); });
  });

  // ------------------------------------------------------------ ficha de captación
  var ficha = $('[data-captacion]');
  if (ficha) {
    var id = ficha.getAttribute('data-captacion');
    var objetivo = leerJson('[data-objetivo]', {}) || {};
    var barra = $('[data-barra-guardar]', ficha);
    var estadoTxt = $('[data-estado-guardar]', ficha);
    var num = function (n) { var v = ficha.elements[n].value; return v === '' ? null : Number(v); };
    var datosCoche = function () {
      var d = {};
      $$('[data-dato]', ficha).forEach(function (el) { d[el.getAttribute('data-dato')] = el.value.trim(); });
      return d;
    };
    var leer = function () {
      var d = { datos: datosCoche() };
      ['matricula', 'precio_anuncio', 'precio_neto', 'gastos', 'precio_venta', 'vendedor_nombre', 'vendedor_telefono', 'vendedor_email', 'notas', 'estado'].forEach(function (k) { d[k] = ficha.elements[k].value.trim(); });
      d.titulo = [d.datos.marca, d.datos.modelo, d.datos.version].filter(Boolean).join(' ') || null;
      return d;
    };
    var inicial = JSON.stringify(leer());
    var sucio = false;
    var comisionEl = $('[data-comision]', ficha);
    var pintarComision = function () {
      var neto = num('precio_neto'), venta = num('precio_venta'), gastos = num('gastos') || 0;
      if (neto == null || venta == null) { comisionEl.textContent = '— pon el neto y el precio de venta'; comisionEl.className = ''; return; }
      var c = venta - neto - gastos;
      comisionEl.textContent = eur(c) + (venta ? ' (' + Math.round(c / venta * 1000) / 10 + ' %)' : '');
      comisionEl.className = c >= 0 ? 'verde' : 'rojo';
    };
    var ayudas = leerJson('[data-ayudas-estado-cap]', {}) || {};
    var cambio = function () {
      sucio = JSON.stringify(leer()) !== inicial;
      barra.classList.toggle('sucio', sucio);
      estadoTxt.textContent = sucio ? 'Cambios sin guardar' : 'Sin cambios';
      pintarComision();
      var ay = $('[data-ayuda-estado-cap]', ficha); if (ay) ay.textContent = ayudas[ficha.elements.estado.value] || '';
    };
    ficha.addEventListener('input', cambio);
    ficha.addEventListener('change', cambio);
    pintarComision();
    window.addEventListener('beforeunload', function (e) { if (sucio) { e.preventDefault(); e.returnValue = ''; } });
    var guardar = function (silencioso) {
      var todo = leer();
      // solo lo que ha cambiado: si mientras tanto el vendedor ha firmado, no se pisa lo que puso él
      var antes = JSON.parse(inicial);
      var d = {};
      Object.keys(todo).forEach(function (k) {
        if (k === 'datos') {
          var cambiados = {};
          Object.keys(todo.datos).forEach(function (x) { if (todo.datos[x] !== antes.datos[x]) cambiados[x] = todo.datos[x]; });
          if (Object.keys(cambiados).length) d.datos = cambiados;
        } else if (todo[k] !== antes[k]) d[k] = todo[k];
      });
      if (d.vendedor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.vendedor_email)) { avisar('El correo del vendedor no parece válido.', 'error'); ficha.elements.vendedor_email.focus(); return Promise.reject(new Error('sesion')); }
      return pedir('/api/admin/captaciones/' + id, 'PATCH', d).then(function (j) {
        inicial = JSON.stringify(todo); cambio();
        var chip = $('[data-estado-chip]'); if (chip && j.estado) { chip.textContent = j.estado; chip.className = 'chip estado-captacion e-' + j.estado.replace(/\s+/g, '-'); }
        if (!silencioso) avisar('Captación guardada', 'ok');
      });
    };
    ficha.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = $('[type=submit]', barra);
      b.disabled = true;
      guardar().catch(fallo).then(function () { b.disabled = false; });
    });

    // tasación: se guarda en la captación; si aún no hay, se tasa sola al abrir la ficha nueva
    var cajaTas = $('[data-tasacion]', ficha);
    var usarPrecio = function (precio) { ficha.elements.precio_venta.value = precio; cambio(); avisar('Precio de venta puesto. Guarda los cambios.', 'ok'); };
    var datosTasar = function () { var d = datosCoche(); d.url = objetivo.url; d.cochesnet = objetivo.cochesnet; return d; };
    var guardada = leerJson('[data-tasacion-guardada]', null);
    if (guardada) pintarTasacion(cajaTas, guardada, usarPrecio);
    $('[data-tasar]', cajaTas).addEventListener('click', function () { tasar(cajaTas, datosTasar(), id, usarPrecio); });
    if (!guardada && /[?&]nueva=1/.test(location.search) && objetivo.marca && objetivo.modelo) {
      history.replaceState(null, '', location.pathname);
      tasar(cajaTas, datosTasar(), id, usarPrecio);
    }

    // contrato
    var cajaK = $('[data-contrato-caja]');
    var wa = cajaK.getAttribute('data-wa') || '';
    var listoParaEnviar = function () {
      var faltan = [];
      if (!ficha.elements.vendedor_nombre.value.trim()) faltan.push(ficha.elements.vendedor_nombre);
      if (ficha.elements.precio_neto.value === '') faltan.push(ficha.elements.precio_neto);
      faltan.forEach(function (el) { el.classList.add('error'); });
      if (faltan.length) { faltan[0].focus(); avisar('Para el contrato hacen falta el nombre del vendedor y lo que recibe (precio neto).', 'error'); }
      return !faltan.length;
    };
    var mostrarEnlace = function (j, canal) {
      var botones = [];
      if (canal === 'whatsapp') botones.push({ texto: 'Abrir WhatsApp', href: j.whatsapp, clase: 'boton' });
      if (navigator.share) botones.push({ texto: 'Compartir…', cierra: false, hacer: function () { navigator.share({ title: 'Acuerdo para firmar', text: j.mensaje }).catch(function () {}); } });
      botones.push({ texto: 'Copiar el enlace', cierra: false, hacer: function (e, el) { copiar(j.enlace, el); } });
      if (canal !== 'whatsapp') botones.push({ texto: 'Abrir WhatsApp', href: j.whatsapp });
      botones.push({ texto: 'Cerrar' });
      dialogo(canal === 'correo' ? 'Contrato enviado por correo' : 'Contrato listo para enviar',
        (canal === 'correo' ? '<p>Se lo hemos mandado a <b>' + esc(ficha.elements.vendedor_email.value) + '</b>. También puedes mandárselo por WhatsApp:</p>' : '<p>Este es el mensaje con su enlace para firmar:</p>') +
        '<p class="mensaje-contrato">' + esc(j.mensaje).replace(/\n/g, '<br>') + '</p>', botones, function () { location.reload(); });
    };
    $$('[data-enviar-contrato]', cajaK).forEach(function (b) {
      b.addEventListener('click', function () {
        if (!listoParaEnviar()) return;
        var canal = b.getAttribute('data-enviar-contrato');
        var texto = b.textContent;
        b.disabled = true; b.textContent = 'Preparando…';
        (sucio ? guardar(true) : Promise.resolve()).then(function () {
          return pedir('/api/admin/captaciones/' + id + '/contrato', 'POST', { canal: canal });
        }).then(function (j) { mostrarEnlace(j, canal); }).catch(fallo).then(function () { b.disabled = false; b.textContent = texto; });
      });
    });
    var pendiente = $('[data-enlace]', cajaK);
    if (pendiente) {
      var enlace = pendiente.getAttribute('data-enlace');
      $('[data-copiar-enlace]', pendiente).addEventListener('click', function () { copiar(enlace, this); });
      $('[data-recordar]', pendiente).addEventListener('click', function () {
        var nombre = (ficha.elements.vendedor_nombre.value.trim().split(' ')[0]) || '';
        var msg = 'Hola' + (nombre ? ' ' + nombre : '') + ', te recuerdo el acuerdo para la venta de tu coche. Cuando puedas, léelo y fírmalo desde aquí:\n' + enlace;
        window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      });
      $('[data-anular]', pendiente).addEventListener('click', function () {
        var kid = this.getAttribute('data-anular');
        L.preguntar({ titulo: '¿Anular el contrato?', texto: 'El enlace que tiene el vendedor deja de funcionar. Luego puedes mandarle uno nuevo.', botones: [['anular', 'Anular', 'boton peligro'], ['cancelar', 'Cancelar', 'boton secundario']] }).then(function (r) {
          if (!r) return;
          pedir('/api/admin/captaciones/' + id + '/contrato', 'PATCH', { accion: 'anular', contrato_id: Number(kid) }).then(function () { sessionStorage.setItem('lidi-aviso', 'Contrato anulado'); location.reload(); }).catch(fallo);
        });
      });
    }

    var publicar = $('[data-publicar-captacion]');
    if (publicar) publicar.addEventListener('click', function (e) {
      if (sucio) { e.preventDefault(); guardar(true).then(function () { location.href = publicar.href; }).catch(fallo); return; }
      if (!publicar.getAttribute('data-firmado') && !confirm('El contrato todavía no está firmado. ¿Lo publicas igualmente?')) e.preventDefault();
    });
    var borrar = $('[data-borrar-captacion]');
    if (borrar) borrar.addEventListener('click', function () {
      L.preguntar({ titulo: '¿Borrar esta captación?', texto: 'Se borran también sus contratos (los firmados, descárgalos antes). Si solo no siguió adelante, ponla como «Descartado».', botones: [['borrar', 'Borrar', 'boton peligro'], ['cancelar', 'Cancelar', 'boton secundario']] }).then(function (r) {
        if (!r) return;
        sucio = false;
        pedir('/api/admin/captaciones/' + id, 'DELETE').then(function () { sessionStorage.setItem('lidi-aviso', 'Captación borrada'); location.href = '/admin/captaciones'; }).catch(fallo);
      });
    });
  }

  // ------------------------------------------------------------ PDF del contrato firmado
  function cargarPdf() {
    if (window.ContratoPDF) return Promise.resolve(window.ContratoPDF);
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = '/js/contrato-pdf.js';
      s.onload = function () { window.ContratoPDF ? ok(window.ContratoPDF) : mal(new Error('No se ha podido preparar el PDF.')); };
      s.onerror = function () { mal(new Error('No hay conexión con la web. Vuelve a intentarlo.')); };
      document.head.appendChild(s);
    });
  }
  $$('[data-pdf-contrato]').forEach(function (b) {
    b.addEventListener('click', function () {
      var texto = b.textContent;
      b.disabled = true; b.textContent = 'Preparando el PDF…';
      pedir('/api/admin/contratos/' + b.getAttribute('data-pdf-contrato'), 'GET').then(function (j) {
        return cargarPdf().then(function (pdf) { return pdf.descargar(j.pdf, 'contrato-' + j.pdf.id + '-' + String(j.pdf.firmante.nombre || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf'); });
      }).catch(fallo).then(function () { b.disabled = false; b.textContent = texto; });
    });
  });

  // ------------------------------------------------------------ Ajustes: la firma del dueño
  function crearPad(caja) {
    var lienzo = $('canvas', caja), ctx = lienzo.getContext('2d'), pista = $('.pista', caja);
    var trazos = 0, dibujando = false, ultimo = null;
    var ajustar = function () {
      var r = caja.getBoundingClientRect(), k = Math.min(window.devicePixelRatio || 1, 2);
      lienzo.width = Math.round(r.width * k); lienzo.height = Math.round(r.height * k);
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f4d'; ctx.fillStyle = '#0b1f4d';
    };
    var punto = function (e) { var r = lienzo.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    lienzo.addEventListener('pointerdown', function (e) { e.preventDefault(); dibujando = true; ultimo = punto(e); if (lienzo.setPointerCapture) lienzo.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.1, 0, Math.PI * 2); ctx.fill(); if (pista) pista.hidden = true; });
    lienzo.addEventListener('pointermove', function (e) { if (!dibujando) return; e.preventDefault(); var p = punto(e); ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ultimo = p; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { lienzo.addEventListener(t, function () { if (dibujando) { dibujando = false; trazos++; } }); });
    return {
      ajustar: ajustar,
      borrar: function () { ctx.clearRect(0, 0, lienzo.width, lienzo.height); trazos = 0; if (pista) pista.hidden = false; },
      png: function () {
        if (!trazos) return null;
        var w = lienzo.width, h = lienzo.height, d = ctx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0 || x1 - x0 < 20) return null;
        var m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
        var c = document.createElement('canvas'), k = Math.min(1, 900 / (x1 - x0));
        c.width = Math.round((x1 - x0) * k); c.height = Math.round((y1 - y0) * k);
        c.getContext('2d').drawImage(lienzo, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
        return c.toDataURL('image/png');
      },
    };
  }
  var cajaFirma = $('[data-firma-ajustes]');
  if (cajaFirma) {
    var lienzoCaja = $('[data-lienzo-firma]', cajaFirma);
    var pad = crearPad(lienzoCaja);
    var guardarF = $('[data-guardar-firma]', cajaFirma), repetir = $('[data-repetir-firma]', cajaFirma), img = $('[data-firma-guardada]', cajaFirma);
    if (!lienzoCaja.hidden) pad.ajustar();
    repetir.addEventListener('click', function () {
      if (img && !img.hidden) { img.hidden = true; lienzoCaja.hidden = false; guardarF.hidden = false; repetir.textContent = 'Borrar y repetir'; pad.ajustar(); return; }
      pad.borrar();
    });
    guardarF.addEventListener('click', function () {
      var png = pad.png();
      if (!png) { avisar('Firma en el recuadro antes de guardar.', 'error'); return; }
      guardarF.disabled = true;
      pedir('/api/admin/ajustes', 'POST', { accion: 'firma', firma: png }).then(function () { sessionStorage.setItem('lidi-aviso', 'Firma guardada'); location.hash = 'contratos'; location.reload(); }).catch(fallo).then(function () { guardarF.disabled = false; });
    });
  }
})();
