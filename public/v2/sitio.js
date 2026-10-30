/* Plantilla de concesionarios de NeumorStudio: menú, formularios, simulador, filtros del stock y galería. Sin dependencias. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  // Miles siempre agrupados ("9.995 €"), igual que en las tarjetas.
  var euros = function (n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '\u00a0€'; };

  function avisar(texto, tipo) {
    var caja = $('[data-avisos]');
    if (!caja) return;
    var d = document.createElement('div');
    d.className = 'aviso ' + (tipo || '');
    d.textContent = texto;
    caja.appendChild(d);
    setTimeout(function () { d.remove(); }, tipo === 'error' ? 7000 : 5000);
  }

  // ---------------------------------------------------------------- menú móvil
  var botonMenu = $('[data-menu-boton]');
  var menu = $('[data-menu]');
  if (botonMenu && menu) {
    botonMenu.addEventListener('click', function () {
      var abierto = menu.hasAttribute('data-abierto');
      if (abierto) menu.removeAttribute('data-abierto'); else menu.setAttribute('data-abierto', '');
      botonMenu.setAttribute('aria-expanded', String(!abierto));
      botonMenu.setAttribute('aria-label', abierto ? 'Abrir el menú' : 'Cerrar el menú');
      document.body.classList.toggle('menu-abierto', !abierto);
    });
  }

  // ---------------------------------------------------------------- textos legales
  $$('[data-abrir]').forEach(function (b) {
    b.addEventListener('click', function () {
      var d = document.getElementById('legal-' + b.getAttribute('data-abrir'));
      if (d && d.showModal) d.showModal();
    });
  });
  $$('dialog.legal').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  // ---------------------------------------------------------------- formularios → /api/formulario
  var MAX_FOTOS_BYTES = 3.5 * 1024 * 1024;

  function reducirFoto(archivo) {
    return new Promise(function (ok) {
      if (!/^image\//.test(archivo.type)) return ok(null);
      var url = URL.createObjectURL(archivo);
      var img = new Image();
      img.onload = function () {
        var max = 1280, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { ok(b ? new File([b], archivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : archivo); }, 'image/jpeg', 0.78);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(archivo); };
      img.src = url;
    });
  }

  $$('form[data-formulario]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var boton = $('button[type=submit]', form);
      $$('.error', form).forEach(function (c) { c.classList.remove('error'); });
      var nombre = form.elements.nombre;
      var tel = form.elements.telefono;
      var email = form.elements.email;
      var obligatorios = $$('[required]', form).filter(function (c) { return c.type === 'checkbox' ? !c.checked : !String(c.value).trim(); });
      obligatorios.forEach(function (c) { c.classList.add('error'); });
      if (obligatorios.length) { avisar(obligatorios[0].type === 'checkbox' ? 'Marca la casilla para continuar.' : 'Rellena los campos marcados.', 'error'); obligatorios[0].focus(); return; }
      var datos = new FormData(form);
      // "Teléfono o email" en un solo campo
      if (tel && /@/.test(tel.value) && (!email || !email.value)) { datos.set('email', tel.value.trim()); datos.set('telefono', ''); }
      if (!String(datos.get('telefono') || '').trim() && !String(datos.get('email') || '').trim()) { avisar('Indica un teléfono o un email para poder contestarte.', 'error'); (tel || email).focus(); return; }
      datos.set('pagina', location.href);
      var fotos = form.elements.fotos;
      var preparar = Promise.resolve();
      if (fotos && fotos.files && fotos.files.length) {
        datos.delete('fotos');
        preparar = Promise.all(Array.prototype.slice.call(fotos.files, 0, 10).map(reducirFoto)).then(function (lista) {
          var total = 0; // el envío pasa por Vercel: se queda muy por debajo de su límite (4,5 MB)
          lista.forEach(function (f) { if (f && total + f.size <= MAX_FOTOS_BYTES) { total += f.size; datos.append('fotos', f, f.name); } });
        });
      }
      var texto = boton.textContent;
      boton.disabled = true; boton.textContent = 'Enviando…';
      preparar.then(function () {
        return fetch('/api/formulario', { method: 'POST', body: datos, headers: { Accept: 'application/json' } });
      }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); }).then(function (j) {
        if (!j.ok) throw new Error(j.error === 'contacto' ? 'Indica un teléfono o un email.' : j.error === 'email' ? 'Ese email no parece correcto.' : 'No se ha podido enviar. Llámanos o escríbenos por WhatsApp.');
        avisar(form.getAttribute('data-exito') || 'Enviado. Te contestamos en cuanto podamos.', 'ok');
        form.reset();
        if (nombre) nombre.blur();
      }).catch(function (err) { avisar(err.message, 'error'); }).then(function () { boton.disabled = false; boton.textContent = texto; });
    });
  });

  // ---------------------------------------------------------------- compartir un coche (móvil: menú del sistema; si no, copia el enlace)
  $$('[data-compartir]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-compartir'), titulo = b.getAttribute('data-titulo') || document.title;
      if (navigator.share) { navigator.share({ title: titulo, text: titulo, url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { avisar('Enlace copiado. Ya puedes pegarlo donde quieras.'); }, function () { window.prompt('Copia el enlace:', url); });
      else window.prompt('Copia el enlace:', url);
    });
  });

  // ---------------------------------------------------------------- simulador de cuota
  $$('[data-simulador]').forEach(function (sim) {
    var importe = $('input[name=importe]', sim), plazo = $('input[name=plazo]', sim);
    var vImporte = $('[data-valor-importe]', sim), vPlazo = $('[data-valor-plazo]', sim), cuota = $('[data-cuota]', sim);
    var TIN = 0.0697;
    var calcular = function () {
      var p = Number(importe.value), n = Number(plazo.value), r = TIN / 12;
      var c = Math.round(p * r / (1 - Math.pow(1 + r, -n)));
      vImporte.textContent = euros(p); vPlazo.textContent = n + ' meses'; cuota.textContent = euros(c);
      var ci = $('[data-copia-importe]'), cp = $('[data-copia-plazo]');
      if (ci) ci.value = p; if (cp) cp.value = n;
    };
    importe.addEventListener('input', calcular);
    plazo.addEventListener('input', calcular);
    var sel = $('[data-coche-precio]', sim);
    if (sel) sel.addEventListener('change', function () {
      var precio = Number(sel.options[sel.selectedIndex].getAttribute('data-precio'));
      if (precio) { importe.value = String(Math.min(Number(importe.max), Math.max(Number(importe.min), Math.round(precio / 500) * 500))); calcular(); }
      var cc = $('[data-copia-coche]'); if (cc) cc.value = sel.value;
    });
    calcular();
  });

  // ---------------------------------------------------------------- filtros del stock
  var filtros = $('[data-filtros]');
  var lista = $('[data-lista]');
  if (filtros && lista) {
    var tarjetas = $$('[data-coche]', lista);
    var contador = $('[data-contador]'), vacio = $('[data-vacio]'), verVendidos = $('[data-ver-vendidos]');
    var masEntregas = $('[data-mas-entregas]');
    // en el móvil los filtros van plegados tras un botón (si no, ocupan una pantalla entera antes del primer coche)
    var botonFiltros = $('[data-boton-filtros]'), activos = $('[data-filtros-activos]');
    if (botonFiltros) botonFiltros.addEventListener('click', function () {
      var abierto = filtros.classList.toggle('abierto');
      botonFiltros.setAttribute('aria-expanded', String(abierto));
    });
    var aplicar = function () {
      var f = {
        marca: filtros.elements.marca.value, combustible: filtros.elements.combustible.value, cambio: filtros.elements.cambio.value,
        precio: Number(filtros.elements.precio.value) || 0, orden: filtros.elements.orden.value
      };
      var vendidos = verVendidos && verVendidos.checked;
      var visibles = [];
      tarjetas.forEach(function (t) {
        var p = Number(t.getAttribute('data-precio')) || 0;
        var ok = (vendidos || t.getAttribute('data-estado') !== 'Vendido')
          && (!f.marca || t.getAttribute('data-marca') === f.marca)
          && (!f.combustible || t.getAttribute('data-combustible') === f.combustible)
          && (!f.cambio || t.getAttribute('data-cambio') === f.cambio)
          && (!f.precio || (p > 0 && p <= f.precio));
        t.hidden = !ok;
        if (ok) visibles.push(t);
      });
      if (f.orden) {
        var clave = { 'precio-asc': function (t) { return Number(t.getAttribute('data-precio')) || 1e12; }, 'precio-desc': function (t) { return -(Number(t.getAttribute('data-precio')) || 0); }, km: function (t) { return Number(t.getAttribute('data-km')) || 1e12; }, anio: function (t) { return -(Number(t.getAttribute('data-anio')) || 0); } }[f.orden];
        visibles.slice().sort(function (a, b) { return clave(a) - clave(b); }).forEach(function (t) { lista.appendChild(t); });
      } else {
        tarjetas.forEach(function (t) { lista.appendChild(t); });
      }
      if (contador) contador.textContent = visibles.length + (visibles.length === 1 ? ' coche' : ' coches');
      if (vacio) vacio.hidden = visibles.length > 0;
      if (masEntregas) masEntregas.hidden = !vendidos;
      if (activos) {
        var n = ['marca', 'combustible', 'cambio', 'precio', 'orden'].filter(function (k) { return filtros.elements[k].value; }).length;
        activos.textContent = n ? '(' + n + ')' : '';
      }
      // la URL refleja los filtros (para compartir el enlace)
      var q = new URLSearchParams();
      ['marca', 'combustible', 'cambio', 'precio', 'orden'].forEach(function (k) { if (filtros.elements[k].value) q.set(k, filtros.elements[k].value); });
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
    };
    // valores iniciales desde la URL (buscador de la portada)
    var inicial = new URLSearchParams(location.search);
    ['marca', 'combustible', 'cambio', 'precio', 'orden'].forEach(function (k) {
      var v = inicial.get(k);
      if (v && filtros.elements[k] && $$('option', filtros.elements[k]).some(function (o) { return o.value === v; })) filtros.elements[k].value = v;
    });
    if (verVendidos && inicial.get('vendidos')) verVendidos.checked = true;
    filtros.addEventListener('change', aplicar);
    filtros.addEventListener('reset', function () { setTimeout(aplicar, 0); });
    if (verVendidos) verVendidos.addEventListener('change', aplicar);
    aplicar();
  }

  // ---------------------------------------------------------------- galería de la ficha y visor
  var galeria = $('[data-galeria]');
  if (galeria) {
    var principal = $('[data-galeria-principal]', galeria);
    var minis = $$('[data-foto]', galeria);
    var fotos = minis.length ? minis.map(function (m) { return m.getAttribute('data-foto'); }) : [principal.getAttribute('src')];
    var contador = $('[data-galeria-contador]', galeria);
    var actual = 0;
    var visor = $('[data-visor]'), visorImg = $('[data-visor-img]'), visorCont = $('[data-visor-contador]');
    var pintar = function () {
      var src = fotos[actual];
      principal.classList.add('cambiando');
      var precarga = new Image();
      precarga.onload = precarga.onerror = function () { principal.src = src; principal.classList.remove('cambiando'); };
      precarga.src = src;
      principal.alt = principal.alt.replace(/foto \d+/, 'foto ' + (actual + 1));
      minis.forEach(function (m, j) { m.setAttribute('aria-current', String(j === actual)); });
      if (minis[actual]) minis[actual].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      if (contador) contador.textContent = (actual + 1) + ' / ' + fotos.length;
      if (visor && visor.hasAttribute('data-abierto')) { visorImg.src = src; visorCont.textContent = (actual + 1) + ' / ' + fotos.length; }
    };
    var ir = function (i) { if (fotos.length < 2) return; actual = (i + fotos.length) % fotos.length; pintar(); };
    minis.forEach(function (m, i) { m.addEventListener('click', function () { ir(i); }); });
    $$('[data-galeria-paso]', galeria).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); ir(actual + Number(b.getAttribute('data-galeria-paso'))); }); });
    var abrirVisor = function () {
      if (!visor) return;
      visorImg.src = fotos[actual]; visorImg.alt = principal.alt;
      visorCont.textContent = (actual + 1) + ' / ' + fotos.length;
      visor.setAttribute('data-abierto', ''); document.body.style.overflow = 'hidden';
    };
    var cerrarVisor = function () { if (!visor) return; visor.removeAttribute('data-abierto'); document.body.style.overflow = ''; };
    principal.addEventListener('click', abrirVisor);
    if (visor) {
      $('[data-visor-cerrar]', visor).addEventListener('click', cerrarVisor);
      $$('[data-visor-paso]', visor).forEach(function (b) { b.addEventListener('click', function () { ir(actual + Number(b.getAttribute('data-visor-paso'))); }); });
      visor.addEventListener('click', function (e) { if (e.target === visor) cerrarVisor(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') ir(actual + 1); else if (e.key === 'ArrowLeft') ir(actual - 1); else if (e.key === 'Escape') cerrarVisor();
    });
    [principal, visorImg].forEach(function (el) {
      if (!el) return;
      var x0 = null;
      el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      el.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) { e.preventDefault(); ir(actual + (dx < 0 ? 1 : -1)); }
      });
    });
  }

  // ---------------------------------------------------------------- cabecera sólida al bajar
  var cabecera = $('.cabecera');
  if (cabecera) {
    var marcar = function () { cabecera.classList.toggle('solida', window.scrollY > 40 || document.body.classList.contains('menu-abierto')); };
    window.addEventListener('scroll', marcar, { passive: true });
    if (botonMenu) botonMenu.addEventListener('click', marcar);
    marcar();
  }

  // ---------------------------------------------------------------- aparición suave de los bloques al bajar
  var revela = $$('.revela');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('visto'); obs.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revela.forEach(function (el) { obs.observe(el); });
  } else {
    revela.forEach(function (el) { el.classList.add('visto'); });
  }
})();
