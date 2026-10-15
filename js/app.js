(() => {
  'use strict';

  /* =====================================================================
     CONFIGURACIÓN DE ASISTECH
     Conexión directa con la API de FastAPI y la base de datos MariaDB.

     Contrato de la API:
       GET   /api/dashboard?id_establecimiento=1
             -> { total_estudiantes: int,
                  lecturas: [{ id_registro, uid_nfc, nombre, grado, tipo_registro, fecha_hora }],
                  alertas:  [{ id_alerta, nombre, grado, tipo, severidad, puntaje, descripcion }] }
       PATCH /api/alertas/{id_alerta}
             -> cuerpo: { "revisada": true }
     ===================================================================== */
  const CONFIG = {
    API_BASE: (() => {
      // 1. Si se define una variable global previa en el HTML/entorno, usarla
      if (typeof window !== 'undefined' && window.ASISTECH_API_BASE !== undefined) {
        return window.ASISTECH_API_BASE;
      }
      // 2. Si se sirve desde el mismo servidor FastAPI en el puerto 8000
      if (typeof window !== 'undefined' && window.location) {
        if (window.location.protocol.startsWith('http') && window.location.port === '8000') {
          return '';
        }
        // 3. Si se accede desde localhost en otro puerto (ej: 5173, 5500, o file://)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname) {
          return 'http://localhost:8000';
        }
        // 4. Si se accede desde otra IP o red local
        if (window.location.protocol.startsWith('http')) {
          return `${window.location.protocol}//${window.location.hostname}:8000`;
        }
      }
      return 'http://localhost:8000';
    })(),
    ID_ESTABLECIMIENTO: (() => {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const p = new URLSearchParams(window.location.search);
        return parseInt(p.get('id_establecimiento') || '1', 10) || 1;
      }
      return 1;
    })(),
    INTERVALO_MS: 3000,        // cada 3 segundos consulta la API
    TARDE_DESDE: '07:30',      // desde esta hora la entrada se marca como tarde (hora de Guatemala)
    GRAFICA_DESDE: 6,          // hora de inicio de la gráfica (06:00)
    GRAFICA_HASTA: 9,          // hora de fin de la gráfica (09:00)
    INSTITUCION: 'ASISTECH \u00b7 Control de Asistencia'
  };
  const TZ = 'America/Guatemala';

  const TIPOS = {
    ausencias_recurrentes: 'Ausencias recurrentes',
    tardanzas_crecientes: 'Tardanzas en aumento',
    lectura_duplicada: 'Lecturas duplicadas'
  };
  const SEVERIDAD = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

  /* ---------- Utilidades de fecha (siempre en hora de Guatemala) ---------- */
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const FMT = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function toDate(v) {
    if (v instanceof Date) return v;
    let s = String(v);
    if (!/(Z|[+-]\d\d:?\d\d)$/.test(s)) s += 'Z'; // sin zona horaria: la BD guarda UTC
    return new Date(s);
  }
  function gt(v) {
    const o = {};
    FMT.formatToParts(toDate(v)).forEach((p) => { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second };
  }
  const hhmm = (v) => { const p = gt(v); return pad(p.h) + ':' + pad(p.mi); };
  const hhmmss = (v) => { const p = gt(v); return pad(p.h) + ':' + pad(p.mi) + ':' + pad(p.s); };
  const minutesOf = (v) => { const p = gt(v); return p.h * 60 + p.mi; };

  const LATE_MIN = (() => { const p = CONFIG.TARDE_DESDE.split(':').map(Number); return p[0] * 60 + p[1]; })();
  const isLate = (v) => minutesOf(v) >= LATE_MIN;

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    kids.flat().forEach((kid) => { if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid)); });
    return el;
  }

  /* ---------- Estado ---------- */
  const state = { total: 0, lecturas: [], alertas: [], connected: null, updated: null, filter: '' };
  let renderedKeys = new Set();
  let lastKey = null;

  /* ---------- Cálculos con datos reales de la BD ---------- */
  function derive() {
    const lect = state.lecturas
      .map((l) => Object.assign({}, l, { _t: toDate(l.fecha_hora) }))
      .sort((a, b) => a._t - b._t);
    const seen = {};
    const firstIn = {};
    const items = lect.map((l) => {
      const tipo = l.tipo_registro === 'SALIDA' ? 'SALIDA' : 'ENTRADA';
      const k = l.uid_nfc + '|' + tipo;
      const rep = !!seen[k];
      seen[k] = true;
      if (tipo === 'ENTRADA' && !rep) firstIn[l.uid_nfc] = l;
      return {
        l, tipo, rep,
        late: tipo === 'ENTRADA' && isLate(l._t),
        key: String(l.id_registro != null ? l.id_registro : l.uid_nfc + l.fecha_hora)
      };
    });
    const firsts = Object.keys(firstIn).map((u) => firstIn[u]);
    return { items, firsts, presentes: firsts.length, tarde: firsts.filter((l) => isLate(l._t)).length };
  }

  /* ---------- Render ---------- */
  function renderStatus() {
    const c = $('#conn');
    if (!c) return;
    c.className = 'chip ' + (state.connected === true ? 'ok' : state.connected === false ? 'off' : '');
    $('#connText').textContent = state.connected === true
      ? 'Conectado \u00b7 actualizado ' + hhmmss(state.updated)
      : state.connected === false
        ? 'Sin conexi\u00f3n con la API \u00b7 reintentando'
        : 'Conectando con la base de datos...';
  }

  function renderLast(d) {
    const last = d.items.length ? d.items[d.items.length - 1] : null;
    if (!last) {
      $('#lastName').textContent = 'Esperando la primera lectura';
      $('#lastMeta').textContent = 'Acerca una tarjeta NFC al lector para registrar la asistencia.';
      return;
    }
    $('#lastName').textContent = last.l.nombre;
    const estado = last.tipo === 'SALIDA' ? 'Salida' : last.rep ? 'Lectura repetida' : last.late ? 'Lleg\u00f3 tarde' : 'Lleg\u00f3 a tiempo';
    $('#lastMeta').textContent = estado + ' \u00b7 ' + hhmm(last.l._t) + (last.l.grado ? ' \u00b7 ' + last.l.grado : '');
    if (lastKey !== null && lastKey !== last.key) {
      const p = $('#pulse');
      if (p) {
        p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
      }
    }
    lastKey = last.key;
  }

  function renderKpis(d) {
    $('#kPresentes').textContent = d.presentes;
    $('#kPresentesSub').textContent = state.total ? 'de ' + state.total + ' estudiantes registrados' : 'estudiantes que marcaron entrada hoy';
    $('#kPct').textContent = state.total ? Math.round(d.presentes / state.total * 100) + '%' : '\u2014';
    $('#kTarde').textContent = d.tarde;
    $('#kTardeSub').textContent = 'desde las ' + CONFIG.TARDE_DESDE;
    $('#kAlertas').textContent = state.alertas.length;
  }

  function renderChart(d) {
    const start = CONFIG.GRAFICA_DESDE * 60;
    const end = CONFIG.GRAFICA_HASTA * 60;
    const n = Math.max(1, Math.round((end - start) / 15));
    const buckets = new Array(n).fill(0);
    d.firsts.forEach((l) => {
      let i = Math.floor((minutesOf(l._t) - start) / 15);
      i = Math.min(n - 1, Math.max(0, i));
      buckets[i]++;
    });
    const max = Math.max(1, ...buckets);
    let peak = 0;
    buckets.forEach((v, i) => { if (v > buckets[peak]) peak = i; });

    const chart = $('#chart');
    const axis = $('#axis');
    chart.style.setProperty('--cols', n);
    axis.style.setProperty('--cols', n);
    chart.textContent = '';
    axis.textContent = '';
    buckets.forEach((v, i) => {
      const from = start + i * 15;
      const late = from >= LATE_MIN;
      chart.append(h('div', {
        class: 'bar' + (late ? ' late' : '') + (v === 0 ? ' zero' : ''),
        style: 'height:' + (v === 0 ? 3 : Math.max(6, Math.round(v / max * 100))) + '%',
        title: pad(Math.floor(from / 60)) + ':' + pad(from % 60) + ' \u2013 ' + v + (v === 1 ? ' entrada' : ' entradas')
      }));
      axis.append(h('span', {}, from % 60 === 0 ? pad(from / 60) + ':00' : ''));
    });
    $('#chartHint').textContent = d.presentes
      ? 'La franja m\u00e1s concurrida es la de las ' + pad(Math.floor((start + peak * 15) / 60)) + ':' + pad((start + peak * 15) % 60) + ', con ' + buckets[peak] + (buckets[peak] === 1 ? ' entrada.' : ' entradas.')
      : 'Todav\u00eda no hay entradas hoy.';
    chart.setAttribute('aria-label', $('#chartHint').textContent);

    const legend = $('#chartLegend');
    legend.textContent = '';
    legend.append(
      h('span', {}, h('i', { style: 'background:var(--brand)' }), 'A tiempo'),
      h('span', {}, h('i', { style: 'background:var(--late-fill)' }), 'Desde las ' + CONFIG.TARDE_DESDE + ' (tarde)')
    );
  }

  function renderFeed(d) {
    const feed = $('#feed');
    const q = state.filter.trim().toLowerCase();
    const rows = d.items.slice().reverse().filter((x) => !q || String(x.l.nombre).toLowerCase().includes(q)).slice(0, 80);
    const nextKeys = new Set();
    feed.textContent = '';
    if (!rows.length) {
      feed.append(h('li', { class: 'empty' }, q
        ? 'Nadie coincide con \u201c' + state.filter.trim() + '\u201d.'
        : 'A\u00fan no hay lecturas hoy. Acerca una tarjeta NFC al lector para registrar la primera.'));
      renderedKeys = nextKeys;
      return;
    }
    rows.forEach((x) => {
      nextKeys.add(x.key);
      const fresh = renderedKeys.size > 0 && !renderedKeys.has(x.key);
      feed.append(h('li', { class: 'row' + (fresh ? ' fresh' : '') },
        h('time', { datetime: x.l._t.toISOString() }, hhmm(x.l._t)),
        h('div', { class: 'who' }, x.l.nombre, x.l.grado ? h('small', {}, x.l.grado) : null),
        x.tipo === 'SALIDA' ? h('span', { class: 'badge out' }, 'Salida')
          : x.rep ? h('span', { class: 'badge rep' }, 'Repetida')
          : x.late ? h('span', { class: 'badge late' }, 'Tarde')
          : h('span', { class: 'badge ok' }, 'A tiempo')));
    });
    renderedKeys = nextKeys;
  }

  function renderAlerts() {
    const ul = $('#alerts');
    ul.textContent = '';
    if (!state.alertas.length) {
      ul.append(h('li', { class: 'empty' }, 'Sin alertas abiertas. El modelo no detect\u00f3 patrones inusuales en los registros recientes.'));
      return;
    }
    state.alertas.forEach((a) => {
      const sev = SEVERIDAD[a.severidad] ? a.severidad : 'baja';
      const score = typeof a.puntaje === 'number' ? a.puntaje.toFixed(2).replace('.', ',') : null;
      ul.append(h('li', { class: 'alert ' + sev },
        h('span', { class: 'sev' }, SEVERIDAD[sev]),
        h('h3', {}, TIPOS[a.tipo] || a.tipo),
        h('p', { class: 'who' }, a.nombre + (a.grado ? ' \u00b7 ' + a.grado : '')),
        h('p', { class: 'desc' }, a.descripcion),
        h('div', { class: 'foot' },
          score ? h('span', {}, 'Puntaje del modelo: ' + score) : null,
          h('button', { type: 'button', onclick: () => reviewAlert(a) }, 'Marcar como revisada'))));
    });
  }

  function render() {
    const d = derive();
    renderStatus();
    renderLast(d);
    renderKpis(d);
    renderChart(d);
    renderFeed(d);
    renderAlerts();
  }

  /* ---------- Acciones con la API ---------- */
  function removeAlert(id) {
    state.alertas = state.alertas.filter((x) => x.id_alerta !== id);
    const msg = $('#msg');
    if (msg) msg.textContent = '';
    render();
  }

  function reviewAlert(a) {
    const url = (CONFIG.API_BASE || '') + '/api/alertas/' + encodeURIComponent(a.id_alerta);
    fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisada: true })
    }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      removeAlert(a.id_alerta);
    }).catch((err) => {
      console.error('Error al actualizar la alerta en la BD:', err);
      const msg = $('#msg');
      if (msg) msg.textContent = 'No se pudo marcar la alerta como revisada. Intenta de nuevo.';
    });
  }

  function poll() {
    const url = (CONFIG.API_BASE || '') + '/api/dashboard?id_establecimiento=' + encodeURIComponent(CONFIG.ID_ESTABLECIMIENTO);
    fetch(url, {
      headers: { Accept: 'application/json' }
    })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        state.total = Number(data.total_estudiantes) || 0;
        state.lecturas = Array.isArray(data.lecturas) ? data.lecturas : [];
        state.alertas = Array.isArray(data.alertas) ? data.alertas : [];
        state.connected = true;
        state.updated = new Date();
        render();
      })
      .catch((err) => {
        console.warn('Conexión con la API de ASISTECH no disponible:', err.message);
        state.connected = false;
        renderStatus();
      });
  }

  /* ---------- Inicialización ---------- */
  $('#subtitle').textContent = CONFIG.INSTITUCION + ' \u00b7 ' + new Date().toLocaleDateString('es-GT', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  $('#search').addEventListener('input', (e) => {
    state.filter = e.target.value;
    renderFeed(derive());
  });

  // Mostrar usuario logueado en la barra superior
  try {
    const rawSesion = localStorage.getItem('asistech_user');
    if (rawSesion) {
      const sesion = JSON.parse(rawSesion);
      const userChip = $('#userChip');
      const userName = $('#userName');
      if (userChip && userName) {
        const nombreCompleto = (sesion.nombre ? `${sesion.nombre} ${sesion.apellido || ''}`.trim() : sesion.usuario) || 'Usuario';
        userName.textContent = nombreCompleto;
        userChip.style.display = 'inline-flex';
      }
    }
  } catch (e) {
    console.warn('Error leyendo sesión local:', e);
  }

  // Manejador del botón Cerrar Sesión
  const btnLogout = $('#btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      try {
        localStorage.removeItem('asistech_user');
      } catch (e) {}
      window.location.replace('/');
    });
  }

  render();
  poll();
  setInterval(poll, CONFIG.INTERVALO_MS);
})();
