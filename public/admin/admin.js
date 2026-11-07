/* Panel del concesionario (plantilla de NeumorStudio): formularios, asistente de alta, fotos y acciones rápidas. Sin dependencias. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var euros = function (n) { return String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; };
  var fecha = function (f) { return f ? String(f).slice(0, 10).split('-').reverse().join('/') : ''; };
  // búsqueda sin tildes ni mayúsculas; todas las palabras tienen que estar; «clasea» encuentra «Clase A»
  var llano = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  var coincide = function (texto, busqueda) {
    var t = llano(texto), junto = t.replace(/[\s.-]/g, '');
    return llano(busqueda).split(' ').filter(Boolean).every(function (p) { return t.indexOf(p) !== -1 || junto.indexOf(p.replace(/[.-]/g, '')) !== -1; });
  };

  /** Aviso abajo. `accion` = { texto, hacer } añade un botón (p. ej. «Deshacer»). */
  function avisar(texto, tipo, accion) {
    var caja = $('[data-avisos]');
    if (!caja) return;
    var d = document.createElement('div');
    d.className = 'aviso ' + (tipo || '');
    d.textContent = texto;
    if (accion) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'accion-aviso';
      b.textContent = accion.texto;
      b.addEventListener('click', function () { d.remove(); accion.hacer(); });
      d.appendChild(b);
    }
    caja.appendChild(d);
    setTimeout(function () { d.remove(); }, accion ? 9000 : tipo === 'error' ? 8000 : 4000);
  }

  /** Llamada a la API del panel con mensajes de error en castellano. */
  function pedir(url, metodo, cuerpo) {
    var op = { method: metodo, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
    if (cuerpo instanceof FormData) op.body = cuerpo;
    else if (cuerpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(cuerpo); }
    return fetch(url, op).catch(function () {
      throw new Error('No hay conexión con la web. Revisa la cobertura o el wifi y vuelve a intentarlo.');
    }).then(function (r) {
      return r.json().catch(function () {
        return { ok: false, error: r.status >= 500 ? 'La web ha tenido un problema (error ' + r.status + '). Vuelve a intentarlo en un momento.' : 'Respuesta inesperada de la web (error ' + r.status + ').' };
      }).then(function (j) {
        if (r.status === 401 && j.error === 'sesion') {
          // la sesión caducó: a entrar y luego de vuelta aquí (lo que estuviera escribiendo queda guardado como borrador)
          location.href = '/admin/entrar?volver=' + encodeURIComponent(location.pathname + location.search);
          throw new Error('sesion');
        }
        if (j.error === 'origen') throw new Error('Abre el panel desde la dirección de la web y vuelve a intentarlo.');
        if (!r.ok || !j.ok) throw new Error(j.error || 'No se ha podido guardar.');
        return j;
      });
    });
  }
  var fallo = function (err) { if (err && err.message !== 'sesion') avisar(err.message, 'error'); };
  // lo comparten los otros scripts del panel (captaciones.js)
  window.LIDI = { $: $, $$: $$, euros: euros, avisar: avisar, pedir: pedir, fallo: fallo, preguntar: function (o) { return preguntar(o); }, traerDeEnlace: function (u) { return traerDeEnlace(u); }, datosFormulario: function (f) { return datosFormulario(f); } };

  /** Pide al servidor que traiga la imagen de un enlace (de un anuncio, por ejemplo). Devuelve un Blob. */
  function traerDeEnlace(url) {
    return fetch('/api/admin/fotos/desde-url?url=' + encodeURIComponent(url), { credentials: 'same-origin' }).catch(function () {
      throw new Error('No hay conexión con la web. Revisa la cobertura o el wifi y vuelve a intentarlo.');
    }).then(function (r) {
      if (r.ok) return r.blob();
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && j.error === 'sesion') {
          location.href = '/admin/entrar?volver=' + encodeURIComponent(location.pathname + location.search);
          throw new Error('sesion');
        }
        throw new Error(j.error || 'No se ha podido traer la imagen de ese enlace.');
      });
    });
  }

  function datosFormulario(form) {
    var d = {};
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'file') return;
      if (el.type === 'checkbox') d[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
      else d[el.name] = el.value;
    });
    return d;
  }

  /**
   * Pregunta con botones (en vez de confirm/prompt del navegador, que no dejan explicar ni elegir bien).
   * o = { titulo, texto, campos (html), botones: [[id, texto, clase]], principal, validar(d), leer(d), alAbrir(d) }
   * Devuelve { boton, datos } o null si se cierra.
   */
  function preguntar(o) {
    return new Promise(function (ok) {
      var d = document.createElement('dialog');
      d.className = 'pregunta';
      d.innerHTML = '<h2></h2><p class="suave"></p>' + (o.campos || '') + '<div class="botonera"></div>';
      $('h2', d).textContent = o.titulo;
      $('p', d).textContent = o.texto || '';
      var cerrado = false;
      var cerrar = function (id) {
        if (cerrado) return;
        cerrado = true;
        var datos = id && o.leer ? o.leer(d) : null;
        if (d.open && d.close) d.close();
        d.remove();
        ok(id ? { boton: id, datos: datos } : null);
      };
      o.botones.forEach(function (b) {
        var x = document.createElement('button');
        x.type = 'button';
        x.className = b[2] || 'boton secundario';
        x.textContent = b[1];
        x.addEventListener('click', function () {
          if (b[0] === o.principal && o.validar && !o.validar(d)) return;
          cerrar(b[0] === 'cancelar' ? null : b[0]);
        });
        $('.botonera', d).appendChild(x);
      });
      d.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(null); });
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && o.principal) {
          e.preventDefault();
          if (!o.validar || o.validar(d)) cerrar(o.principal);
        }
      });
      document.body.appendChild(d);
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      if (o.alAbrir) o.alAbrir(d);
      var primero = $('input', d) || $('.botonera button', d);
      if (primero) { primero.focus(); if (primero.select && primero.value) primero.select(); }
    });
  }

  /** Datos de una venta (precio y comprador). `precio`: el de la web, para no teclearlo. */
  function pedirVenta(titulo, precio) {
    return preguntar({
      titulo: 'Vender ' + titulo,
      texto: 'Se apunta en Ventas y en la web sale con el sello VENDIDO y pasa a «Últimas entregas».',
      campos: '<label class="campo"><span>Precio de venta (€) *</span><input type="number" min="0" inputmode="numeric" data-p-precio></label><label class="campo"><span>Comprador (opcional)</span><input type="text" data-p-comprador autocomplete="off"></label>',
      botones: [['vender', 'Marcar como vendido', 'boton'], ['cancelar', 'Cancelar', 'boton secundario']],
      principal: 'vender',
      validar: function (d) {
        var c = $('[data-p-precio]', d);
        var ok = String(c.value).trim() !== '' && Number(c.value) >= 0;
        c.classList.toggle('error', !ok);
        if (!ok) c.focus();
        return ok;
      },
      leer: function (d) { return { precio_venta: Math.round(Number($('[data-p-precio]', d).value)), comprador: $('[data-p-comprador]', d).value.trim() }; },
      alAbrir: function (d) { if (Number(precio) > 0) $('[data-p-precio]', d).value = precio; },
    }).then(function (r) { return r && r.datos; });
  }

  // ------------------------------------------------------------ formularios sencillos (entrar, ajustes, clientes, tareas…)
  $$('form[data-api]:not([data-formulario-coche])').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var boton = $('[type=submit]', form);
      var faltan = $$('[required]', form).filter(function (c) { return !String(c.value).trim(); });
      $$('.error', form).forEach(function (c) { c.classList.remove('error'); });
      if (faltan.length) { faltan.forEach(function (c) { c.classList.add('error'); }); faltan[0].focus(); avisar('Rellena los campos marcados.', 'error'); return; }
      var texto = boton.textContent;
      boton.disabled = true; boton.textContent = 'Un momento…';
      pedir(form.getAttribute('data-api'), form.getAttribute('data-metodo') || 'POST', datosFormulario(form)).then(function () {
        if (form.getAttribute('data-ir')) { location.href = form.getAttribute('data-ir'); return; }
        if (form.hasAttribute('data-recargar')) { sessionStorage.setItem('lidi-aviso', form.getAttribute('data-aviso') || 'Guardado'); location.reload(); return; }
        avisar(form.getAttribute('data-aviso') || 'Guardado', 'ok');
        if (form.hasAttribute('data-limpiar')) form.reset();
      }).catch(fallo).then(function () { boton.disabled = false; boton.textContent = texto; });
    });
  });
  // un campo marcado en rojo se desmarca en cuanto se rellena
  document.addEventListener('input', function (e) {
    var c = e.target;
    if (c.classList && c.classList.contains('error') && String(c.value).trim()) c.classList.remove('error');
  });

  // botones sueltos que llaman a la API (p. ej. quitar acceso de soporte, marcar todos como leídos)
  $$('[data-api-boton]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-confirmar') && !confirm(b.getAttribute('data-confirmar'))) return;
      var cuerpo = {};
      try { cuerpo = JSON.parse(b.getAttribute('data-cuerpo') || '{}'); } catch (e) { cuerpo = {}; }
      b.disabled = true;
      pedir(b.getAttribute('data-api-boton'), b.getAttribute('data-metodo') || 'POST', cuerpo).then(function () {
        if (b.hasAttribute('data-recargar')) { sessionStorage.setItem('lidi-aviso', b.getAttribute('data-aviso') || 'Hecho'); location.reload(); return; }
        avisar(b.getAttribute('data-aviso') || 'Hecho', 'ok');
      }).catch(fallo).then(function () { b.disabled = false; });
    });
  });

  // ------------------------------------------------------------ menú «Más» de la barra de abajo (móvil)
  var botonMas = $('[data-mas]'), hojaMas = $('[data-hoja-mas]');
  if (botonMas && hojaMas) {
    var ponerMas = function (abierta) { hojaMas.hidden = !abierta; botonMas.setAttribute('aria-expanded', String(abierta)); };
    botonMas.addEventListener('click', function () { ponerMas(hojaMas.hidden); });
    $('[data-cerrar-mas]', hojaMas).addEventListener('click', function () { ponerMas(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !hojaMas.hidden) ponerMas(false); });
  }
  // ------------------------------------------------------------ panel instalable (PWA) y avisos push
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js', { scope: '/admin' }).catch(function () {});
  }
  var cajaPush = $('[data-push-caja]');
  if (cajaPush) {
    var estado = $('[data-push-estado]');
    var bActivar = $('[data-push-activar]');
    var bQuitar = $('[data-push-quitar]');
    var bProbar = $('[data-push-probar]');
    var ayudaInstalar = $('[data-instalar-ayuda]');
    var soportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    var instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    var esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    function base64aBytes(b64) {
      var s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
      var raw = atob(s); var out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    }
    function pintar(sub) {
      bActivar.hidden = !!sub; bQuitar.hidden = !sub; bProbar.hidden = !sub;
      if (sub) estado.textContent = 'Avisos activados en este dispositivo' + (instalado ? '.' : '. Instala el panel en la pantalla de inicio para tenerlo a mano.');
      else if (Notification.permission === 'denied') estado.textContent = 'Has bloqueado las notificaciones para esta web en el navegador. Actívalas en los ajustes del navegador y vuelve a intentarlo.';
      else estado.textContent = instalado ? 'Pulsa el botón y acepta el permiso.' : 'Pulsa el botón y acepta el permiso.';
      ayudaInstalar.hidden = instalado;
    }
    if (!soportado || (esIphone && !instalado)) {
      bActivar.hidden = true;
      estado.textContent = esIphone ? 'En iPhone, primero instala el panel: Safari → Compartir → «Añadir a pantalla de inicio». Luego abre el panel desde el icono y activa los avisos aquí.' : 'Este navegador no permite avisos. Prueba con Chrome.';
      ayudaInstalar.hidden = !esIphone;
    } else {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription();
      }).then(pintar).catch(function () { pintar(null); });
      bActivar.addEventListener('click', function () {
        bActivar.disabled = true;
        Notification.requestPermission().then(function (perm) {
          if (perm !== 'granted') throw new Error('No has dado permiso para las notificaciones.');
          return pedir('/api/admin/push', 'GET');
        }).then(function (j) {
          return navigator.serviceWorker.ready.then(function (reg) {
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64aBytes(j.clave) });
          });
        }).then(function (sub) {
          return pedir('/api/admin/push', 'POST', { suscripcion: sub.toJSON(), dispositivo: navigator.userAgent.slice(0, 120) }).then(function () { pintar(sub); avisar('Avisos activados', 'ok'); });
        }).catch(function (err) { if (err.message !== 'sesion') avisar(err.message, 'error'); pintar(null); }).then(function () { bActivar.disabled = false; });
      });
      bQuitar.addEventListener('click', function () {
        navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
          if (!sub) return pintar(null);
          return pedir('/api/admin/push', 'DELETE', { endpoint: sub.endpoint }).catch(function () {}).then(function () { return sub.unsubscribe(); }).then(function () { pintar(null); avisar('Avisos quitados', 'ok'); });
        });
      });
      bProbar.addEventListener('click', function () {
        bProbar.disabled = true;
        pedir('/api/admin/push/probar', 'POST', {}).then(function (j) { avisar('Aviso de prueba enviado a ' + j.enviados + ' dispositivo(s)', 'ok'); }).catch(function (err) { if (err.message !== 'sesion') avisar(err.message, 'error'); }).then(function () { bProbar.disabled = false; });
      });
    }
  }

  // ------------------------------------------------------------ inventario: buscador, pestañas y estado rápido
  var lista = $('[data-lista]');
  if (lista) {
    var buscador = $('[data-buscar]');
    var sinResultados = $('[data-sin-resultados]');
    var estadoFiltro = '';
    var filtrar = function () {
      var q = buscador ? buscador.value.trim() : '';
      var n = 0;
      $$('[data-coche]', lista).forEach(function (t) {
        var ok = (!estadoFiltro || t.getAttribute('data-estado') === estadoFiltro) && (!q || coincide(t.getAttribute('data-texto'), q));
        t.hidden = !ok;
        if (ok) n++;
      });
      if (sinResultados) {
        sinResultados.hidden = n > 0 || (!q && !estadoFiltro);
        $('[data-texto-buscado]', sinResultados).textContent = q || estadoFiltro;
        var enVendidos = $('[data-buscar-vendidos]', sinResultados);
        if (enVendidos) enVendidos.href = '/admin/inventario?vendidos=1' + (q ? '&q=' + encodeURIComponent(q) : '');
      }
    };
    if (buscador) buscador.addEventListener('input', filtrar);
    $$('[data-pestanas] button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-pestanas] button').forEach(function (x) { x.classList.remove('activa'); });
        b.classList.add('activa');
        estadoFiltro = b.getAttribute('data-estado');
        filtrar();
      });
    });
    $$('[data-cambiar-estado]', lista).forEach(function (sel) {
      sel.addEventListener('change', function () {
        var tarjeta = sel.closest('[data-coche]');
        var slug = tarjeta.getAttribute('data-coche');
        var antes = tarjeta.getAttribute('data-estado');
        var nuevo = sel.value;
        var api = '/api/admin/coches/' + slug;
        var paso;
        if (nuevo === 'Vendido') {
          paso = pedirVenta($('h3', tarjeta).textContent, tarjeta.getAttribute('data-precio')).then(function (v) {
            if (!v) return null;
            return pedir('/api/admin/ventas', 'POST', { coche: slug, precio_venta: v.precio_venta, comprador: v.comprador, marcar_vendido: true });
          });
        } else if (antes === 'Vendido') {
          // deja de estar vendido: ¿la venta apuntada sigue valiendo?
          paso = pedir(api, 'GET').then(function (j) {
            if (!j.venta) return pedir(api, 'PATCH', { estado: nuevo });
            return preguntar({
              titulo: '¿Quitar también la venta?',
              texto: 'Este coche tiene una venta apuntada (' + euros(j.venta.precio_venta) + ' del ' + fecha(j.venta.fecha) + '). Si la venta no siguió adelante, quítala para que no cuente en tus ventas.',
              botones: [['quitar', 'Quitar la venta', 'boton'], ['dejar', 'Dejarla apuntada', 'boton secundario'], ['cancelar', 'Cancelar', 'boton secundario']],
            }).then(function (r) { return r ? pedir(api, 'PATCH', { estado: nuevo, quitar_venta: r.boton === 'quitar' }) : null; });
          });
        } else {
          paso = pedir(api, 'PATCH', { estado: nuevo });
        }
        sel.disabled = true;
        paso.then(function (hecho) {
          if (!hecho) { sel.value = antes; return; }
          tarjeta.setAttribute('data-estado', nuevo);
          tarjeta.classList.toggle('vendido', nuevo === 'Vendido');
          tarjeta.classList.toggle('oculto-web', nuevo === 'Oculto');
          var chip = $('[data-chip]', tarjeta);
          chip.className = 'chip ' + nuevo; chip.textContent = nuevo;
          var ver = $('[data-ver-web]', tarjeta);
          if (ver) ver.hidden = nuevo === 'Oculto';
          avisar(nuevo === 'Vendido' ? 'Vendido. Ya sale con el sello en la web y está apuntado en Ventas.' : nuevo === 'Oculto' ? 'Oculto: ya no sale en la web.' : 'Estado cambiado a ' + nuevo + '.', 'ok');
        }).catch(function (err) { sel.value = antes; fallo(err); })
          .then(function () { sel.disabled = false; });
      });
    });
  }

  // ------------------------------------------------------------ mensajes (y los sin leer del inicio)
  $$('[data-mensaje]').forEach(function (m) {
    var id = m.getAttribute('data-mensaje');
    var b = $('[data-leido]', m);
    var marcar = function (leido) {
      return pedir('/api/admin/mensajes/' + id, 'PATCH', { leido: leido }).then(function () {
        m.classList.toggle('nuevo', !leido);
        if (b) { b.setAttribute('data-leido', leido ? '0' : '1'); b.textContent = leido ? 'Marcar como nuevo' : 'Marcar como leído'; }
      });
    };
    if (b) b.addEventListener('click', function () { marcar(b.getAttribute('data-leido') === '1').catch(fallo); });
    // al llamar, escribir o responder, el mensaje queda leído
    $$('[data-contactar]', m).forEach(function (a) {
      a.addEventListener('click', function () { if (m.classList.contains('nuevo') || !b) marcar(true).catch(function () {}); });
    });
    var x = $('[data-borrar-mensaje]', m);
    if (x) x.addEventListener('click', function () {
      if (!confirm('¿Borrar este mensaje? No se puede deshacer.')) return;
      pedir('/api/admin/mensajes/' + id, 'DELETE').then(function () { m.remove(); avisar('Mensaje borrado', 'ok'); }).catch(fallo);
    });
  });

  // ------------------------------------------------------------ borrar con confirmación (clientes)
  $$('[data-borrar-api]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!confirm(b.getAttribute('data-confirmar') || '¿Seguro?')) return;
      pedir(b.getAttribute('data-borrar-api'), 'DELETE').then(function () { location.href = b.getAttribute('data-ir') || '/admin'; }).catch(fallo);
    });
  });

  // ------------------------------------------------------------ lista de clientes: filtra al escribir (Buscar mira en todos)
  var buscarLista = $('[data-buscar-lista]');
  var listaFiltrable = $('[data-lista-filtrable]');
  if (buscarLista && listaFiltrable) buscarLista.addEventListener('input', function () {
    var q = buscarLista.value.trim();
    var n = 0;
    $$('[data-texto]', listaFiltrable).forEach(function (el) { var ok = !q || coincide(el.getAttribute('data-texto'), q); el.hidden = !ok; if (ok) n++; });
    var vacio = $('[data-sin-resultados]');
    if (vacio) vacio.hidden = n > 0 || !q;
  });

  // ------------------------------------------------------------ tareas
  $$('[data-tarea]').forEach(function (t) {
    var id = t.getAttribute('data-tarea');
    var c = $('[data-hecha]', t);
    if (c) c.addEventListener('change', function () {
      pedir('/api/admin/tareas/' + id, 'PATCH', { hecha: c.checked }).then(function () { t.classList.toggle('hecha', c.checked); })
        .catch(function (err) { c.checked = !c.checked; fallo(err); });
    });
    var x = $('[data-borrar-tarea]', t);
    if (x) x.addEventListener('click', function () {
      pedir('/api/admin/tareas/' + id, 'DELETE').then(function () { t.remove(); }).catch(fallo);
    });
  });

  // ------------------------------------------------------------ ventas
  $$('[data-venta]').forEach(function (v) {
    var x = $('[data-borrar-venta]', v);
    if (x) x.addEventListener('click', function () {
      if (!confirm('¿Borrar esta venta del registro? El coche no cambia de estado.')) return;
      pedir('/api/admin/ventas/' + v.getAttribute('data-venta'), 'DELETE').then(function () { sessionStorage.setItem('lidi-aviso', 'Venta borrada'); location.reload(); }).catch(fallo);
    });
  });
  var ventaCoche = $('[data-venta-coche]');
  if (ventaCoche) ventaCoche.addEventListener('change', function () {
    var o = ventaCoche.options[ventaCoche.selectedIndex];
    $('[data-venta-titulo]').value = o.getAttribute('data-titulo') || '';
    $('[data-venta-coste]').value = o.getAttribute('data-coste') || '';
    var precio = $('[data-venta-precio]');
    if (precio && !precio.value && Number(o.getAttribute('data-precio')) > 0) precio.value = o.getAttribute('data-precio');
  });

  // ------------------------------------------------------------ ajustes: liberar espacio de fotos
  var liberar = $('[data-liberar-espacio]');
  if (liberar) liberar.addEventListener('click', function () {
    preguntar({
      titulo: '¿Liberar espacio?',
      texto: 'A los coches vendidos hace más de 6 meses se les borran todas las fotos menos la portada. No se puede deshacer.',
      botones: [['si', 'Sí, liberar espacio', 'boton peligro'], ['cancelar', 'Cancelar', 'boton secundario']],
    }).then(function (r) {
      if (!r) return;
      liberar.disabled = true; liberar.textContent = 'Liberando…';
      pedir('/api/admin/fotos/liberar', 'POST', {}).then(function (j) {
        sessionStorage.setItem('lidi-aviso', j.fotos ? 'Listo: ' + j.fotos + ' fotos borradas de ' + j.coches + ' coches vendidos.' + (j.quedan ? ' Quedan ' + j.quedan + ' coches: vuelve a pulsar.' : '') : 'No había fotos que borrar.');
        location.reload();
      }).catch(function (err) { fallo(err); liberar.disabled = false; liberar.textContent = 'Liberar espacio'; });
    });
  });

  // ------------------------------------------------------------ ajustes: enlace para que el dueño ponga su contraseña
  var botonEnlaceJuan = $('[data-enlace-juan]');
  if (botonEnlaceJuan) botonEnlaceJuan.addEventListener('click', function () {
    var pendiente = $('[data-enlace-pendiente]');
    var crear = function () {
      botonEnlaceJuan.disabled = true;
      pedir('/api/admin/ajustes', 'POST', { accion: 'enlace_juan' }).then(function (j) {
        // siempre con la dirección buena (la de data-sitio: el dominio propio o, sin él, la provisional),
        // aunque el panel se haya abierto desde una dirección técnica (*.pages.dev…)
        var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
        var url = (local ? location.origin : (botonEnlaceJuan.getAttribute('data-sitio') || location.origin)) + '/admin/activar?t=' + encodeURIComponent(j.codigo);
        var listo = $('[data-enlace-juan-listo]');
        $('[data-enlace-juan-url]', listo).value = url;
        var texto = 'Hola, este es tu enlace para entrar en el panel de tu web y poner tu contraseña. Ábrelo desde el móvil (sirve una vez y caduca en 7 días):\n' + url;
        $('[data-enlace-juan-wa]', listo).href = 'https://wa.me/' + (botonEnlaceJuan.getAttribute('data-wa') || '') + '?text=' + encodeURIComponent(texto);
        listo.hidden = false;
        if (pendiente) pendiente.hidden = true;
        botonEnlaceJuan.textContent = 'Crear un enlace nuevo';
        avisar('Enlace creado. Mándaselo al dueño.', 'ok');
      }).catch(fallo).then(function () { botonEnlaceJuan.disabled = false; });
    };
    if (!pendiente && $('[data-enlace-juan-listo]').hidden) return crear();
    preguntar({
      titulo: '¿Crear un enlace nuevo?',
      texto: 'El enlace anterior dejará de valer. Si ya se lo has mandado al dueño, mándale el nuevo.',
      botones: [['si', 'Crear uno nuevo', 'boton'], ['cancelar', 'Cancelar', 'boton secundario']],
    }).then(function (r) { if (r && r.boton === 'si') crear(); });
  });
  var copiarEnlace = $('[data-enlace-juan-copiar]');
  if (copiarEnlace) copiarEnlace.addEventListener('click', function () {
    var campo = $('[data-enlace-juan-url]');
    var hecho = function () { avisar('Enlace copiado.', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(campo.value).then(hecho, function () { campo.select(); });
    else { campo.select(); try { document.execCommand('copy'); hecho(); } catch (e) { /* lo copia él */ } }
  });

  // ------------------------------------------------------------ tu web a tu medida: cada interruptor se guarda al tocarlo
  var interruptores = $$('[data-web]');
  var cola = Promise.resolve();
  var NOMBRES_WEB = { pagina: 'La página', portada: 'El bloque', boton: 'El botón' };
  interruptores.forEach(function (inp) {
    inp.addEventListener('change', function () {
      var id = inp.getAttribute('data-web');
      var visible = inp.checked;
      inp.disabled = true;
      // de una en una, en el orden en que se tocan
      cola = cola.then(function () {
        return pedir('/api/admin/web', 'POST', { id: id, visible: visible }).then(function () {
          var nombre = ($('.opcion-texto b', inp.closest('label')) || {}).textContent;
          var quien = nombre ? (/^«/.test(nombre) ? nombre : '«' + nombre + '»') : (NOMBRES_WEB[id.split(':')[0]] || 'Esto');
          avisar(quien + (visible ? ' vuelve a salir en tu web.' : ' ya no sale en tu web.'), 'ok');
          // sin «Encargo a medida» tampoco sale el anuncio «¿Un coche muy concreto?»
          $$('[data-depende="' + id + '"]').forEach(function (l) {
            var dep = $('input', l), nota = $('.nota-depende', l);
            dep.disabled = !visible;
            if (nota) nota.hidden = visible;
          });
        }).catch(function (err) { inp.checked = !visible; fallo(err); });
      }).then(function () {
        var dependeDe = inp.closest('[data-depende]');
        var bloqueada = dependeDe && $$('[data-web="' + dependeDe.getAttribute('data-depende') + '"]').some(function (p) { return !p.checked; });
        inp.disabled = !!bloqueada;
      });
    });
  });

  // ------------------------------------------------------------ calculadora de importación
  var calc = $('[data-calculadora]');
  if (calc) {
    var COSTES = JSON.parse(calc.getAttribute('data-costes'));
    var TRAMOS = JSON.parse(calc.getAttribute('data-tramos'));
    var num = function (n) { var v = Number(calc.elements[n] ? calc.elements[n].value : 0); return isFinite(v) && v >= 0 ? v : 0; };
    var euros = function (n) { return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n) + ' €'; };
    var origen = function () { return calc.querySelector('[name=origen]:checked').value; };
    var calcular = function () {
      var ext = origen() === 'extranjero';
      $('[data-solo-extranjero]', calc).hidden = !ext;
      var precio = num('precio_compra');
      var lineas = [['Precio de compra', precio]];
      if (ext) {
        var base = num('valor_fiscal') || precio;
        var co2 = num('co2');
        var tipo = TRAMOS.filter(function (t) { return co2 <= (t.hasta === null ? Infinity : t.hasta); })[0].tipo;
        var iva = Math.round(precio * num('iva_pct') / 100);
        if (iva) lineas.push(['IVA (' + num('iva_pct') + ' %)', iva]);
        lineas.push(['Transporte', num('transporte')]);
        lineas.push(['Impuesto de matriculación (' + tipo + ' %)', Math.round(base * tipo / 100)]);
        lineas.push(['Gestoría e importación', num('gestoria')]);
        lineas.push(['ITV y homologación', num('itv')]);
        lineas.push(['Placas y tasas de Tráfico', num('placas')]);
      } else {
        lineas.push(['Cambio de nombre (tasa)', num('cambio_nombre')]);
        lineas.push(['Gestoría', num('gestoria')]);
      }
      if (num('arreglos')) lineas.push(['Reparaciones y puesta a punto', num('arreglos')]);
      if (num('otros')) lineas.push(['Otros gastos', num('otros')]);
      var coste = lineas.reduce(function (a, l) { return a + l[1]; }, 0);
      $('[data-resultado-lineas]', calc).innerHTML = lineas.map(function (l) { return '<tr><td>' + l[0] + '</td><td class="num">' + euros(l[1]) + '</td></tr>'; }).join('');
      $('[data-resultado-coste]', calc).textContent = euros(coste);
      var venta = num('precio_venta');
      var ben = $('[data-resultado-beneficio]', calc);
      if (venta) { var b = venta - coste; ben.textContent = euros(b) + ' (' + Math.round(b / venta * 1000) / 10 + ' %)'; ben.className = b < 0 ? 'rojo' : 'verde'; }
      else { ben.textContent = '— pon un precio de venta'; ben.className = ''; }
    };
    calc.addEventListener('input', calcular);
    calc.addEventListener('change', function (e) {
      if (e.target.name === 'origen') {
        var g = calc.elements.gestoria;
        g.value = origen() === 'extranjero' ? g.getAttribute('data-gestoria-import') : g.getAttribute('data-gestoria-nacional');
      }
      calcular();
    });
    calcular();
    calc.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = datosFormulario(calc);
      pedir('/api/admin/calculadora', 'POST', d).then(function () { sessionStorage.setItem('lidi-aviso', 'Cálculo guardado'); location.reload(); })
        .catch(function (err) { if (err.message !== 'sesion') avisar(err.message, 'error'); });
    });
    $$('[data-borrar-calculo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var fila = b.closest('[data-calculo]');
        pedir('/api/admin/calculadora/' + fila.getAttribute('data-calculo'), 'DELETE').then(function () { fila.remove(); }).catch(function (err) { if (err.message !== 'sesion') avisar(err.message, 'error'); });
      });
    });
    // pasar al inventario con los datos ya puestos
    $('[data-pasar-inventario]').addEventListener('click', function (e) {
      var q = new URLSearchParams();
      ['titulo', 'anio', 'km', 'precio_venta', 'precio_compra', 'marca', 'modelo', 'version', 'combustible', 'cambio', 'potencia_cv', 'carroceria', 'puertas', 'color', 'etiqueta_dgt', 'etiqueta_estimada'].forEach(function (k) { if (calc.elements[k] && calc.elements[k].value) q.set(k, calc.elements[k].value); });
      // la descripción y las fotos no caben en la dirección: van por el navegador
      var a = window.LIDI.anuncio;
      if (a) { q.set('origen', 'calculadora'); try { sessionStorage.setItem('lidi-anuncio', JSON.stringify({ descripcion: a.descripcion || '', fotos: a.fotos || [] })); } catch (err) { /* sin almacenamiento */ } }
      e.currentTarget.href = '/admin/coche/nuevo?' + q.toString();
    });
    // leer anuncio
    var formAnuncio = $('[data-importar-anuncio]');
    formAnuncio.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = formAnuncio.elements.url.value.trim();
      if (!url) return;
      var aviso = $('[data-importar-aviso]');
      var boton = $('button', formAnuncio);
      boton.disabled = true; boton.textContent = 'Leyendo…'; aviso.hidden = false; aviso.textContent = 'Leyendo el anuncio…';
      pedir('/api/admin/calculadora/importar', 'POST', { url: url }).then(function (j) {
        var d = j.datos;
        calc.elements.url.value = url;
        if (d.titulo) calc.elements.titulo.value = d.titulo;
        if (d.precio) calc.elements.precio_compra.value = d.precio;
        if (d.anio) calc.elements.anio.value = d.anio;
        if (d.km) calc.elements.km.value = d.km;
        if (d.co2) calc.elements.co2.value = d.co2;
        ['marca', 'modelo', 'version', 'combustible', 'cambio', 'potencia_cv', 'carroceria', 'puertas', 'color', 'etiqueta_dgt'].forEach(function (k) { if (calc.elements[k]) calc.elements[k].value = d[k] || ''; });
        if (calc.elements.etiqueta_estimada) calc.elements.etiqueta_estimada.value = d.etiqueta_estimada ? '1' : '';
        window.LIDI.anuncio = d;
        var tras = $('[data-tras-leer]'); if (tras) tras.hidden = false;
        var r = calc.querySelector('[name=origen][value=' + (d.origen || 'espana') + ']'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
        var faltan = ['precio', 'anio', 'km'].filter(function (k) { return !d[k]; });
        aviso.textContent = d.bloqueado ? (d.portal || 'El portal') + ' no ha dejado leer la página: he sacado del enlace lo que dice (marca, modelo, año…). Pon el precio y los km a mano.' : 'Leído de ' + (d.portal || 'el anuncio') + (faltan.length ? '. No he encontrado: ' + faltan.join(', ') + '. Rellénalo a mano.' : '.') + (d.fotos && d.fotos.length ? ' ' + d.fotos.length + ' fotos para el alta.' : '');
        calcular();
      }).catch(function (err) {
        if (err.message === 'sesion') return;
        calc.elements.url.value = url;
        aviso.textContent = err.message;
      }).then(function () { boton.disabled = false; boton.textContent = 'Leer anuncio'; });
    });
  }

  // ------------------------------------------------------------ imágenes de la web (portada y secciones)
  var cajaImagenes = $('[data-imagenes-web]');
  if (cajaImagenes) {
    function reducirGrande(archivo) {
      return new Promise(function (ok, mal) {
        var url = URL.createObjectURL(archivo);
        var img = new Image();
        img.onload = function () {
          var max = 1920, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) {
            if (b && b.type === 'image/webp') return ok(b);
            c.toBlob(function (b2) { b2 ? ok(b2) : mal(new Error('No se pudo procesar la imagen.')); }, 'image/jpeg', 0.86);
          }, 'image/webp', 0.84);
        };
        img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('Ese archivo no es una imagen.')); };
        img.src = url;
      });
    }
    function refrescarEstado() {
      pedir('/api/admin/imagenes-web', 'GET').then(function (j) {
        Object.keys(j.imagenes).forEach(function (clave) {
          var caja = $('[data-clave="' + clave + '"]', cajaImagenes); if (!caja) return;
          var i = j.imagenes[clave];
          $('[data-estado]', caja).textContent = i.propia ? 'Imagen propia (' + Math.round(i.bytes / 1024) + ' KB)' + (i.actualizado ? ', cambiada el ' + new Date(i.actualizado).toLocaleDateString('es-ES') : '') : 'Imagen de serie.';
          $('[data-quitar]', caja).hidden = !i.propia;
        });
      }).catch(function () {});
    }
    refrescarEstado();
    $$('[data-clave]', cajaImagenes).forEach(function (caja) {
      var clave = caja.getAttribute('data-clave');
      var vista = $('[data-vista]', caja);
      function guardar(archivo) {
        return reducirGrande(archivo).then(function (blob) {
          var fd = new FormData();
          fd.append('clave', clave);
          fd.append('foto', blob, 'imagen.' + (blob.type === 'image/webp' ? 'webp' : 'jpg'));
          return pedir('/api/admin/imagenes-web', 'POST', fd);
        }).then(function (j) { vista.src = j.url; avisar('Imagen guardada', 'ok'); refrescarEstado(); });
      }
      $('[data-archivo]', caja).addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0]; e.target.value = '';
        if (f) guardar(f).catch(function (err) { if (err.message !== 'sesion') avisar(err.message, 'error'); });
      });
      var enlace = $('[data-enlace]', caja), traer = $('[data-traer]', caja);
      var traerEnlace = function () {
        var url = enlace.value.trim(); if (!url) return;
        traer.disabled = true; traer.textContent = 'Trayendo…';
        traerDeEnlace(url).then(function (blob) { enlace.value = ''; return guardar(new File([blob], 'enlace', { type: blob.type })); })
          .catch(function (err) { if (err.message !== 'sesion') avisar(err.message, 'error'); })
          .then(function () { traer.disabled = false; traer.textContent = 'Traer'; });
      };
      traer.addEventListener('click', traerEnlace);
      enlace.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); traerEnlace(); } });
      $('[data-quitar]', caja).addEventListener('click', function () {
        if (!confirm('¿Volver a la imagen de serie?')) return;
        pedir('/api/admin/imagenes-web', 'DELETE', { clave: clave }).then(function () { vista.src = '/img-web/' + clave + '.webp?v=' + Date.now(); avisar('Imagen de serie restaurada', 'ok'); refrescarEstado(); }).catch(function (err) { if (err.message !== 'sesion') avisar(err.message, 'error'); });
      });
    });
  }

  // ------------------------------------------------------------ asistente de alta / edición
  var form = $('[data-formulario-coche]');
  if (!form) return;
  var nuevo = form.getAttribute('data-metodo') === 'POST';
  var estadoInicial = form.getAttribute('data-estado-inicial') || '';
  var pasos = $$('[data-paso]', form);
  var botonesPaso = $$('[data-ir-paso]', form);
  var actual = 1;
  function irA(n) {
    actual = Math.max(1, Math.min(pasos.length, n));
    pasos.forEach(function (p) { p.hidden = Number(p.getAttribute('data-paso')) !== actual; });
    botonesPaso.forEach(function (b, i) {
      b.classList.toggle('activo', i + 1 === actual);
      b.classList.toggle('hecho', i + 1 < actual);
      b.setAttribute('aria-selected', String(i + 1 === actual));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function validarPaso(n) {
    var paso = pasos[n - 1];
    var malos = $$('[required]', paso).filter(function (c) { return !String(c.value).trim(); });
    $$('.error', paso).forEach(function (c) { c.classList.remove('error'); });
    malos.forEach(function (c) { c.classList.add('error'); });
    if (malos.length) { avisar('Rellena los campos marcados.', 'error'); malos[0].focus(); }
    return !malos.length;
  }
  botonesPaso.forEach(function (b, i) { b.addEventListener('click', function () { if (nuevo && i + 1 > actual && !validarPaso(actual)) return; irA(i + 1); }); });
  form.addEventListener('click', function (e) {
    if (e.target.closest('[data-siguiente]')) { if (validarPaso(actual)) irA(actual + 1); }
    if (e.target.closest('[data-atras]')) irA(actual - 1);
  });
  // Intro en un campo: en el alta, siguiente paso; al editar, guardar
  form.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key !== 'Enter' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'SELECT' || t.tagName === 'A' || t.hasAttribute('data-foto-enlace')) return;
    e.preventDefault();
    if (!nuevo || actual === pasos.length) { if (form.requestSubmit) form.requestSubmit(); else guardar(); }
    else if (validarPaso(actual)) irA(actual + 1);
  });

  // título automático a partir de marca, modelo y versión (hasta que el dueño lo toque)
  var titulo = $('[name=titulo]', form);
  var tituloAuto = titulo.getAttribute('data-titulo-auto') === '1';
  titulo.addEventListener('input', function () { tituloAuto = false; });
  // si la versión empieza repitiendo el modelo ("Q2 Advanced…" en un Audi Q2), no se repite en el título
  var plano = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var sinModelo = function (version, modelo) {
    var p = plano(modelo), palabras = version.split(/\s+/), acc = '';
    if (!p) return version;
    for (var i = 0; i < palabras.length; i++) {
      acc += plano(palabras[i]);
      if (acc === p) return palabras.slice(i + 1).join(' ');
      if (p.indexOf(acc) !== 0) return version;
    }
    return version;
  };
  var ponerTitulo = function () {
    if (!tituloAuto) return;
    var v = function (k) { return $('[name=' + k + ']', form).value.trim(); };
    titulo.value = [v('marca'), v('modelo'), sinModelo(v('version'), v('modelo'))].filter(Boolean).join(' ');
  };
  ['marca', 'modelo', 'version'].forEach(function (n) { $('[name=' + n + ']', form).addEventListener('input', ponerTitulo); });
  ponerTitulo(); // al duplicar o venir de la calculadora, el título ya sale hecho

  // oferta: el precio rebajado solo se ve (y cuenta) si «En oferta» está marcado
  var oferta = $('[data-activa]', form);
  var campoOferta = oferta ? $('[data-depende="' + oferta.getAttribute('data-activa') + '"]', form) : null;
  var verOferta = function (enfocar) { if (!campoOferta) return; campoOferta.hidden = !oferta.checked; if (oferta.checked && enfocar) $('input', campoOferta).focus(); };
  if (oferta) oferta.addEventListener('change', function () { verOferta(true); });

  // estado: explicación, datos de la venta al venderlo y, al dejar de estar vendido, quitar su venta
  var AYUDAS = {};
  try { AYUDAS = JSON.parse($('[data-ayudas-estado]', form).textContent); } catch (e) { AYUDAS = {}; }
  var ayudaEstado = $('[data-ayuda-estado]', form);
  var cajaVenta = $('[data-caja-venta]', form);
  var cajaQuitarVenta = $('[data-quitar-venta-caja]', form);
  var botonPublicar = $('[data-publicar]', form);
  var estadoElegido = function () { var r = $('[name=estado]:checked', form); return r ? r.value : 'Disponible'; };
  var verEstado = function () {
    var e = estadoElegido();
    if (ayudaEstado) ayudaEstado.textContent = AYUDAS[e] || '';
    if (cajaVenta) cajaVenta.hidden = !(e === 'Vendido' && estadoInicial !== 'Vendido');
    if (cajaQuitarVenta) cajaQuitarVenta.hidden = !(estadoInicial === 'Vendido' && e !== 'Vendido');
    if (botonPublicar) botonPublicar.textContent = e === 'Oculto' ? 'Guardar sin publicar' : 'Publicar vehículo';
  };
  $$('[name=estado]', form).forEach(function (r) { r.addEventListener('change', verEstado); });
  verEstado();

  // ------------------------------------------------------------ fotos
  var galeria = $('[data-galeria-admin]', form);
  var fotosJson = $('[data-fotos-json]', form);
  var cuentaFotos = $('[data-cuenta-fotos]', form);
  var progreso = $('[data-progreso-fotos]', form);
  var fotos = JSON.parse(fotosJson.value || '[]');
  var MAX_FOTOS = Number(form.getAttribute('data-max-fotos')) || 20;
  var urlFoto = function (f) { return f.charAt(0) === '/' ? f : '/img/' + f; };
  var miniDe = function (f) { return f.indexOf('/fotos/') === 0 ? f.replace(/(\.[a-z]+)$/i, '-m$1') : urlFoto(f); };

  // la galería sigue siempre el orden de `fotos` (también en el HTML, para el teclado); las que se suben, al final
  function pintarFotos() {
    fotosJson.value = JSON.stringify(fotos);
    var porRuta = {};
    $$('figure[data-foto]', galeria).forEach(function (f) {
      if (f.classList.contains('subiendo')) return;
      var ruta = f.getAttribute('data-foto');
      if (fotos.indexOf(ruta) === -1 || porRuta[ruta]) f.remove(); else porRuta[ruta] = f;
    });
    fotos.forEach(function (ruta, i) {
      var f = porRuta[ruta];
      if (!f) return;
      galeria.appendChild(f);
      f.classList.toggle('portada', i === 0);
      var et = $('.portada-etiqueta', f);
      if (i === 0 && !et) { et = document.createElement('span'); et.className = 'portada-etiqueta'; et.textContent = 'PORTADA'; f.insertBefore(et, f.firstChild.nextSibling); }
      if (i !== 0 && et) et.remove();
    });
    $$('figure.subiendo', galeria).forEach(function (f) { galeria.appendChild(f); });
    if (cuentaFotos) cuentaFotos.textContent = fotos.length + ' de ' + MAX_FOTOS + ' fotos';
  }
  function figura(ruta, src) {
    var f = document.createElement('figure');
    f.setAttribute('data-foto', ruta);
    f.innerHTML = '<img alt=""><div class="mandos"><button type="button" data-mover="-1" aria-label="Mover antes" title="Mover antes">◀</button><button type="button" data-portada aria-label="Hacer portada" title="Hacer portada">★</button><button type="button" data-quitar aria-label="Quitar foto" title="Quitar foto">✕</button><button type="button" data-mover="1" aria-label="Mover después" title="Mover después">▶</button></div>';
    if (src) $('img', f).src = src;
    galeria.appendChild(f);
    return f;
  }
  // una foto que ya no existe (p. ej. en un borrador muy antiguo): se avisa en vez de dejar un hueco
  galeria.addEventListener('error', function (e) {
    var img = e.target;
    if (img.tagName !== 'IMG' || img.getAttribute('data-rota')) return;
    img.setAttribute('data-rota', '1');
    img.removeAttribute('src');
    img.alt = 'Foto no encontrada: quítala';
    img.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#b91c1c;font-size:0.85rem;padding:8px;text-align:center';
  }, true);
  galeria.addEventListener('click', function (e) {
    var f = e.target.closest('figure[data-foto]');
    if (!f || f.classList.contains('subiendo')) return;
    var ruta = f.getAttribute('data-foto');
    var i = fotos.indexOf(ruta);
    if (i === -1) return;
    if (e.target.closest('[data-quitar]')) {
      // no se borra nada hasta guardar: se puede deshacer, y si no se guarda, la foto sigue en el coche
      var src = $('img', f).getAttribute('src');
      fotos.splice(i, 1);
      pintarFotos();
      cambio();
      avisar('Foto quitada. Se borrará al guardar.', 'ok', { texto: 'Deshacer', hacer: function () {
        if (fotos.indexOf(ruta) !== -1) return;
        fotos.splice(Math.min(i, fotos.length), 0, ruta);
        figura(ruta, src || miniDe(ruta));
        pintarFotos();
        cambio();
      } });
      return;
    }
    if (e.target.closest('[data-portada]')) {
      fotos.splice(i, 1); fotos.unshift(ruta);
    } else if (e.target.closest('[data-mover]')) {
      var j = i + Number(e.target.closest('[data-mover]').getAttribute('data-mover'));
      if (j < 0 || j >= fotos.length) return;
      fotos[i] = fotos[j]; fotos[j] = ruta;
    } else return;
    pintarFotos();
    cambio();
  });

  // reducir en el móvil antes de subir: la grande (1600 px) para la ficha y una miniatura (720 px) para los listados
  function cargarImagen(archivo) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(archivo);
      var img = new Image();
      img.onload = function () { ok({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('«' + (archivo.name || 'archivo') + '» no es una imagen.')); };
      img.src = url;
    });
  }
  function reducirA(img, max, calidad) {
    return new Promise(function (ok, mal) {
      var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) {
        if (b && b.type === 'image/webp') return ok(b);
        c.toBlob(function (b2) { b2 ? ok(b2) : mal(new Error('No se pudo preparar la foto.')); }, 'image/jpeg', calidad + 0.03);
      }, 'image/webp', calidad);
    });
  }
  function prepararFoto(archivo) {
    return cargarImagen(archivo).then(function (r) {
      return reducirA(r.img, 1600, 0.82).then(function (grande) {
        return reducirA(r.img, 720, 0.78).then(function (mini) { URL.revokeObjectURL(r.url); return { grande: grande, mini: mini }; });
      });
    });
  }

  // cola de subida: de una en una (el móvil no se queda sin memoria), con contador y resumen al final
  var cola = [];
  var subiendo = false;
  var tanda = { total: 0, hechas: 0, fallos: [] };
  var botonesGuardar = $$('[type=submit]', form);
  function verProgreso() {
    var ocupado = subiendo || cola.length > 0;
    if (progreso) {
      progreso.hidden = !ocupado;
      progreso.textContent = ocupado ? 'Subiendo foto ' + Math.min(tanda.hechas + tanda.fallos.length + 1, tanda.total) + ' de ' + tanda.total + '… No cierres esta página.' : '';
    }
    if (enviando) return; // guardando: los botones siguen desactivados
    botonesGuardar.forEach(function (b) {
      if (!b.hasAttribute('data-texto')) b.setAttribute('data-texto', b.textContent);
      b.disabled = ocupado;
      b.textContent = ocupado ? 'Esperando a las fotos…' : b.getAttribute('data-texto');
    });
    if (!ocupado) verEstado(); // devuelve el texto bueno al botón de publicar
  }
  function encolar(archivos) {
    var libres = MAX_FOTOS - fotos.length - cola.length - (subiendo ? 1 : 0);
    if (archivos.length > libres) {
      avisar(libres > 0 ? 'Máximo ' + MAX_FOTOS + ' fotos por coche: se suben las ' + libres + ' primeras.' : 'Ya tiene ' + MAX_FOTOS + ' fotos, el máximo. Quita alguna para añadir otras.', 'error');
      archivos = archivos.slice(0, Math.max(0, libres));
    }
    archivos.forEach(function (archivo) {
      var f = figura('pendiente-' + Math.random().toString(36).slice(2), '');
      f.classList.add('subiendo', 'en-cola');
      cola.push({ archivo: archivo, figura: f });
    });
    tanda.total += archivos.length;
    pintarFotos();
    verProgreso();
    siguiente();
  }
  function siguiente() {
    if (subiendo) return;
    var t = cola.shift();
    if (!t) { terminarTanda(); return; }
    subiendo = true;
    t.figura.classList.remove('en-cola');
    verProgreso();
    prepararFoto(t.archivo).then(function (b) {
      $('img', t.figura).src = URL.createObjectURL(b.mini);
      var fd = new FormData();
      var ext = b.grande.type === 'image/webp' ? 'webp' : 'jpg';
      fd.append('foto', b.grande, 'foto.' + ext);
      fd.append('mini', b.mini, 'mini.' + ext);
      return pedir('/api/admin/fotos', 'POST', fd);
    }).then(function (j) {
      t.figura.setAttribute('data-foto', j.url);
      t.figura.classList.remove('subiendo');
      fotos.push(j.url);
      tanda.hechas++;
    }).catch(function (err) {
      t.figura.remove();
      if (err.message !== 'sesion') tanda.fallos.push(err.message);
    }).then(function () {
      subiendo = false;
      pintarFotos();
      cambio();
      verProgreso();
      siguiente();
    });
  }
  function terminarTanda() {
    if (!tanda.total) return;
    if (!tanda.fallos.length) avisar(tanda.hechas === 1 ? 'Foto subida.' : tanda.hechas + ' fotos subidas.', 'ok');
    else avisar((tanda.hechas ? tanda.hechas + ' de ' + tanda.total + ' fotos subidas. ' : '') + (tanda.fallos.length === 1 ? 'Una foto no se pudo subir: ' : tanda.fallos.length + ' fotos no se pudieron subir: ') + tanda.fallos[0], 'error');
    tanda = { total: 0, hechas: 0, fallos: [] };
  }
  var entrada = $('[data-subir-fotos]', form);
  entrada.addEventListener('change', function () {
    var archivos = Array.prototype.slice.call(entrada.files);
    entrada.value = '';
    if (archivos.length) encolar(archivos);
  });
  // foto desde un enlace: el servidor la trae y aquí se reduce y se sube como las demás
  var enlaceFoto = $('[data-foto-enlace]', form);
  var botonEnlace = $('[data-foto-enlace-boton]', form);
  if (enlaceFoto && botonEnlace) {
    var traer = function () {
      var url = enlaceFoto.value.trim();
      if (!url) return;
      botonEnlace.disabled = true; botonEnlace.textContent = 'Trayendo…';
      traerDeEnlace(url).then(function (blob) {
        enlaceFoto.value = '';
        encolar([new File([blob], 'enlace.' + (blob.type.split('/')[1] || 'jpg'), { type: blob.type })]);
      }).catch(fallo).then(function () { botonEnlace.disabled = false; botonEnlace.textContent = 'Traer foto'; });
    };
    botonEnlace.addEventListener('click', traer);
    enlaceFoto.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); traer(); } });
  }

  // fotos del anuncio (de una captación o de la calculadora): se traen y se suben como las demás
  var cajaAnuncio = $('[data-fotos-anuncio]', form);
  var fotosAnuncio = [];
  try { fotosAnuncio = JSON.parse(cajaAnuncio ? cajaAnuncio.getAttribute('data-fotos-anuncio') || '[]' : '[]'); } catch (e) { fotosAnuncio = []; }
  if (form.getAttribute('data-desde-calculadora') === '1') {
    try {
      var del = JSON.parse(sessionStorage.getItem('lidi-anuncio') || 'null');
      sessionStorage.removeItem('lidi-anuncio');
      if (del) {
        var desc = $('[name=descripcion]', form);
        if (desc && !desc.value.trim() && del.descripcion) desc.value = del.descripcion;
        if (Array.isArray(del.fotos)) fotosAnuncio = del.fotos;
      }
    } catch (e) { /* sin almacenamiento */ }
  }
  if (cajaAnuncio && fotosAnuncio.length) {
    cajaAnuncio.hidden = false;
    $('[data-fotos-anuncio-texto]', cajaAnuncio).textContent = 'Hay ' + fotosAnuncio.length + ' fotos en el anuncio.';
    var botonAnuncio = $('[data-traer-fotos-anuncio]', cajaAnuncio);
    botonAnuncio.addEventListener('click', function () {
      var libres = MAX_FOTOS - fotos.length - cola.length - (subiendo ? 1 : 0);
      var lista = fotosAnuncio.slice(0, Math.max(0, libres));
      if (!lista.length) { avisar('Ya tiene ' + MAX_FOTOS + ' fotos, el máximo.', 'error'); return; }
      botonAnuncio.disabled = true;
      var hechas = 0, fallos = 0;
      var una = function (i) {
        if (i >= lista.length) {
          botonAnuncio.textContent = fallos ? 'Traídas ' + hechas + ' (' + fallos + ' no se pudieron)' : 'Fotos traídas';
          if (fallos && !hechas) { botonAnuncio.disabled = false; botonAnuncio.textContent = 'Volver a intentarlo'; avisar('El portal no deja descargar sus fotos. Guárdalas en el móvil y súbelas con «Añadir fotos».', 'error'); }
          return;
        }
        botonAnuncio.textContent = 'Trayendo ' + (i + 1) + ' de ' + lista.length + '…';
        traerDeEnlace(lista[i]).then(function (blob) {
          hechas++;
          encolar([new File([blob], 'anuncio-' + (i + 1) + '.' + (blob.type.split('/')[1] || 'jpg'), { type: blob.type })]);
        }).catch(function (err) { if (err.message === 'sesion') throw err; fallos++; }).then(function () { una(i + 1); });
      };
      una(0);
    });
  }
  // modelos de la marca elegida (los de la lista y los que ya hay en el inventario)
  var marcaInput = $('[name=marca]', form), listaModelos = $('#lista-modelos');
  if (marcaInput && listaModelos) {
    var marcaPedida = '';
    var pedirModelos = function () {
      var m = marcaInput.value.trim();
      if (!m || m === marcaPedida) return;
      marcaPedida = m;
      fetch('/api/admin/modelos?marca=' + encodeURIComponent(m), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok || marcaInput.value.trim() !== m || !j.modelos.length) return;
        listaModelos.innerHTML = '';
        j.modelos.forEach(function (x) { var o = document.createElement('option'); o.value = x; listaModelos.appendChild(o); });
      }).catch(function () { /* se quedan las sugerencias de siempre */ });
    };
    marcaInput.addEventListener('change', pedirModelos);
    marcaInput.addEventListener('blur', pedirModelos);
    pedirModelos();
  }

  // ------------------------------------------------------------ cambios sin guardar y borrador en este dispositivo
  var claveBorrador = 'lidi-borrador:' + (nuevo ? 'nuevo' : form.getAttribute('data-api').split('/').pop());
  var versionCoche = form.getAttribute('data-actualizado') || '';
  var enviando = false;
  var barraGuardar = $('[data-barra-guardar]', form);
  var textoEstado = $('[data-estado-guardar]', form);
  var estadoActual = function () { var d = datosFormulario(form); delete d.fotos_json; d.fotos = fotos.slice(); return JSON.stringify(d); };
  var inicial = estadoActual();
  var sucio = false;
  var temporizador = null;
  var leerBorrador = function () {
    try {
      var b = JSON.parse(localStorage.getItem(claveBorrador) || 'null');
      // 7 días como mucho (las fotos sin guardar se limpian a los 8) y solo si el coche no ha cambiado desde entonces
      return b && b.d && Date.now() - b.t < 7 * 86400000 && (b.v || '') === versionCoche ? b : null;
    } catch (e) { return null; }
  };
  var guardarBorrador = function () { try { localStorage.setItem(claveBorrador, JSON.stringify({ t: Date.now(), v: versionCoche, d: JSON.parse(estadoActual()) })); } catch (e) { /* sin almacenamiento */ } };
  var quitarBorrador = function () { try { localStorage.removeItem(claveBorrador); } catch (e) { /* sin almacenamiento */ } };
  var leerBorradorCrudo = function () { try { return localStorage.getItem(claveBorrador); } catch (e) { return null; } };
  // al guardar o eliminar: fuera borrador y temporizador (si no, el temporizador lo volvía a crear tras guardar)
  var olvidarBorrador = function () { clearTimeout(temporizador); sucio = false; quitarBorrador(); };
  function cambio() {
    sucio = estadoActual() !== inicial;
    if (barraGuardar) { barraGuardar.classList.toggle('sucio', sucio); textoEstado.textContent = sucio ? 'Cambios sin guardar' : 'Sin cambios'; }
    clearTimeout(temporizador);
    if (enviando) return;
    temporizador = setTimeout(function () { if (enviando) return; if (sucio) guardarBorrador(); else quitarBorrador(); }, 400);
  }
  form.addEventListener('input', cambio);
  form.addEventListener('change', cambio);
  window.addEventListener('beforeunload', function (e) {
    if (enviando || !(sucio || subiendo || cola.length)) return;
    e.preventDefault();
    e.returnValue = '';
  });
  function aplicarBorrador(d) {
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'file' || el.name === 'fotos_json' || !(el.name in d)) return;
      if (el.type === 'checkbox') el.checked = !!d[el.name];
      else if (el.type === 'radio') el.checked = d[el.name] === el.value;
      else el.value = d[el.name];
    });
    $$('figure[data-foto]', galeria).forEach(function (f) { if (!f.classList.contains('subiendo')) f.remove(); });
    fotos = (d.fotos || []).filter(function (f) { return typeof f === 'string'; }).slice(0, MAX_FOTOS);
    fotos.forEach(function (r) { figura(r, miniDe(r)); });
    tituloAuto = false;
    pintarFotos();
    verOferta(false);
    verEstado();
    cambio();
  }
  var borrador = leerBorrador();
  var avisoBorrador = $('[data-borrador]', form);
  if (borrador && JSON.stringify(borrador.d) !== inicial && avisoBorrador) {
    var minutos = Math.round((Date.now() - borrador.t) / 60000);
    $('[data-borrador-cuando]', avisoBorrador).textContent = '(' + (minutos < 60 ? 'hace ' + Math.max(1, minutos) + ' min' : minutos < 1440 ? 'hace ' + Math.round(minutos / 60) + ' h' : 'hace ' + Math.round(minutos / 1440) + ' días') + ')';
    avisoBorrador.hidden = false;
    $('[data-borrador-recuperar]', avisoBorrador).addEventListener('click', function () { aplicarBorrador(borrador.d); avisoBorrador.hidden = true; avisar('Cambios recuperados. Revísalos y guarda.', 'ok'); });
    $('[data-borrador-descartar]', avisoBorrador).addEventListener('click', function () { quitarBorrador(); avisoBorrador.hidden = true; });
  } else if (borrador || leerBorradorCrudo()) {
    quitarBorrador();
  }

  // ------------------------------------------------------------ guardar
  function guardar() {
    if (enviando) return; // ya se está guardando (p. ej. Intro dos veces)
    if (subiendo || cola.length) { avisar('Espera a que terminen de subir las fotos.', 'error'); return; }
    for (var n = 1; n <= pasos.length; n++) { if (!validarPaso(n)) { irA(n); return; } }
    var d = datosFormulario(form);
    delete d.fotos_json;
    d.fotos = fotos;
    var estado = estadoElegido();
    if (estado === 'Vendido' && estadoInicial !== 'Vendido' && cajaVenta) {
      var precioVenta = $('[data-venta-precio]', cajaVenta);
      if (!String(precioVenta.value).trim()) { irA(pasos.length); precioVenta.classList.add('error'); precioVenta.focus(); avisar('Pon el precio de venta para apuntarlo en Ventas.', 'error'); return; }
      d.venta = { precio_venta: precioVenta.value, comprador: $('[data-venta-comprador]', cajaVenta).value.trim() };
    }
    var quitarVenta = $('[data-quitar-venta]', form);
    if (estadoInicial === 'Vendido' && estado !== 'Vendido' && quitarVenta) d.quitar_venta = quitarVenta.checked;
    enviando = true;
    botonesGuardar.forEach(function (b) { b.disabled = true; if (!b.hasAttribute('data-texto')) b.setAttribute('data-texto', b.textContent); b.textContent = 'Guardando…'; });
    pedir(form.getAttribute('data-api'), form.getAttribute('data-metodo'), d).then(function () {
      olvidarBorrador();
      sessionStorage.setItem('lidi-aviso', nuevo ? (estado === 'Oculto' ? 'Vehículo guardado. Está oculto: no sale en la web hasta que cambies su estado.' : 'Vehículo publicado en la web.') : 'Cambios guardados.');
      location.href = '/admin/inventario';
    }).catch(function (err) {
      enviando = false;
      fallo(err);
      botonesGuardar.forEach(function (b) { b.disabled = false; b.textContent = b.getAttribute('data-texto'); });
    });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); guardar(); });

  var borrar = $('[data-borrar-coche]', form);
  if (borrar) borrar.addEventListener('click', function () {
    preguntar({
      titulo: '¿Eliminar este vehículo?',
      texto: 'Se borra de la web con todas sus fotos y no se puede deshacer. Si solo quieres quitarlo de la web un tiempo, ponlo como «Oculto»; si lo has vendido, márcalo como «Vendido».',
      botones: [['eliminar', 'Eliminar', 'boton peligro'], ['cancelar', 'Cancelar', 'boton secundario']],
    }).then(function (r) {
      if (!r) return;
      enviando = true;
      pedir(form.getAttribute('data-api'), 'DELETE').then(function () { olvidarBorrador(); sessionStorage.setItem('lidi-aviso', 'Vehículo eliminado.'); location.href = '/admin/inventario'; })
        .catch(function (err) { enviando = false; fallo(err); });
    });
  });
  var primero = $('[data-subir-principio]', form);
  if (primero) primero.addEventListener('click', function () {
    pedir(form.getAttribute('data-api'), 'PATCH', { accion: 'primero' }).then(function () { avisar('Ahora sale el primero de su grupo en la web.', 'ok'); }).catch(fallo);
  });
})();

// aviso pendiente tras recargar o volver al inventario
(function () {
  try {
    var a = sessionStorage.getItem('lidi-aviso');
    if (a) { sessionStorage.removeItem('lidi-aviso'); var caja = document.querySelector('[data-avisos]'); if (caja) { var d = document.createElement('div'); d.className = 'aviso ok'; d.textContent = a; caja.appendChild(d); setTimeout(function () { d.remove(); }, 5000); } }
  } catch (e) { /* sin almacenamiento */ }
})();
