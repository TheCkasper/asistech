(() => {
  'use strict';

  /* =====================================================================
     CONFIGURACIÓN DE ASISTECH - MÓDULO DE ESTUDIANTES
     ===================================================================== */
  const CONFIG = {
    API_BASE: (() => {
      if (typeof window !== 'undefined' && window.ASISTECH_API_BASE !== undefined) {
        const custom = String(window.ASISTECH_API_BASE).trim();
        return custom ? custom.replace(/\/+$/, '') : '';
      }
      if (typeof window === 'undefined' || !window.location) {
        return 'http://localhost:8000';
      }
      const { protocol, hostname, port } = window.location;
      if (protocol === 'file:' || !hostname) {
        return 'http://localhost:8000';
      }
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      if (isLocalhost) {
        if (port === '8000') return '';
        return 'http://localhost:8000';
      }
      return '';
    })(),
    ID_ESTABLECIMIENTO: (() => {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const p = new URLSearchParams(window.location.search);
        return parseInt(p.get('id_establecimiento') || '1', 10) || 1;
      }
      return 1;
    })(),
    TARDE_DESDE: '07:30'
  };

  const TZ = 'America/Guatemala';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function getApiUrl(path) {
    const base = (CONFIG.API_BASE || '').trim().replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return base ? `${base}${cleanPath}` : cleanPath;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const FMT = new Intl.DateTimeFormat('es-GT', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  function toDate(v) {
    if (v instanceof Date) return v;
    let s = String(v);
    if (!/(Z|[+-]\d\d:?\d\d)$/.test(s)) s += 'Z';
    return new Date(s);
  }

  function formatoFechaGT(v) {
    if (!v) return '—';
    try {
      const d = toDate(v);
      const o = {};
      FMT.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
      return `${o.day}/${o.month}/${o.year} ${pad(o.hour)}:${pad(o.minute)}`;
    } catch (e) {
      return String(v);
    }
  }

  function esTarde(v) {
    try {
      const d = toDate(v);
      const o = {};
      FMT.formatToParts(d).forEach((p) => { o[p.type] = p.value; });
      const min = parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10);
      const pTarde = CONFIG.TARDE_DESDE.split(':').map(Number);
      const minTarde = pTarde[0] * 60 + pTarde[1];
      return min >= minTarde;
    } catch (e) {
      return false;
    }
  }

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    kids.flat().forEach((kid) => {
      if (kid != null && kid !== false) {
        el.append(kid.nodeType ? kid : document.createTextNode(kid));
      }
    });
    return el;
  }

  /* ---------- ESTADO GLOBAL DEL MÓDULO ---------- */
  let estudiantesCache = [];
  let opcionesAcademicas = { ciclos: [], grados: [], secciones: [] };
  let estudianteSeleccionadoAsistencia = null;
  let periodoActualAsistencia = 'semana';

  /* ---------- CARGAR OPCIONES ACADÉMICAS ---------- */
  async function cargarOpcionesAcademicas() {
    try {
      const url = getApiUrl('/api/opciones_academicas?id_establecimiento=' + CONFIG.ID_ESTABLECIMIENTO);
      const res = await fetch(url);
      if (!res.ok) return;
      opcionesAcademicas = await res.json();

      // Llenar select de ciclo escolar
      const selCiclo = $('#selCicloEscolar');
      if (selCiclo) {
        selCiclo.innerHTML = '';
        if (opcionesAcademicas.ciclos && opcionesAcademicas.ciclos.length) {
          opcionesAcademicas.ciclos.forEach((c) => {
            selCiclo.append(h('option', { value: c.id_ciclo_escolar }, c.nombre));
          });
        } else {
          selCiclo.append(h('option', { value: '1' }, 'Ciclo Escolar 2026'));
        }
      }

      // Llenar datalists para sugerencias de grado y sección
      const listGrados = $('#listGrados');
      if (listGrados) {
        listGrados.innerHTML = '';
        (opcionesAcademicas.grados || []).forEach((g) => {
          listGrados.append(h('option', { value: g.nombre }));
        });
      }

      const listSecciones = $('#listSecciones');
      if (listSecciones) {
        listSecciones.innerHTML = '';
        (opcionesAcademicas.secciones || []).forEach((s) => {
          listSecciones.append(h('option', { value: s.nombre }));
        });
      }
    } catch (e) {
      console.warn('Error al cargar opciones académicas:', e);
    }
  }

  /* ---------- CONSULTAR Y MOSTRAR ESTUDIANTES ---------- */
  async function cargarEstudiantes() {
    const tbl = $('#tblEstudiantes');
    if (!tbl) return;

    try {
      const q = $('#txtBuscar') ? $('#txtBuscar').value.trim() : '';
      const url = getApiUrl(`/api/estudiantes?id_establecimiento=${CONFIG.ID_ESTABLECIMIENTO}&buscar=${encodeURIComponent(q)}`);
      const res = await fetch(url);

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const lista = await res.json();
      estudiantesCache = Array.isArray(lista) ? lista : [];

      renderizarTablaEstudiantes();
      actualizarKpisEstudiantes();

    } catch (err) {
      console.error('Error al cargar estudiantes:', err);
      tbl.innerHTML = `<tr><td colspan="6" class="empty" style="color: var(--alta);">No se pudo conectar con la base de datos para cargar los estudiantes.</td></tr>`;
    }
  }

  function renderizarTablaEstudiantes() {
    const tbl = $('#tblEstudiantes');
    if (!tbl) return;

    tbl.textContent = '';

    const filtroEstado = $('#selFiltroEstado') ? $('#selFiltroEstado').value : 'activos';

    let filtrados = estudiantesCache.filter((e) => {
      if (filtroEstado === 'activos') return e.activo;
      if (filtroEstado === 'inactivos') return !e.activo;
      return true; // 'todos'
    });

    if (!filtrados.length) {
      tbl.append(h('tr', {},
        h('td', { colspan: '6', class: 'empty' },
          filtroEstado === 'activos'
            ? 'No hay estudiantes activos registrados.'
            : 'No se encontraron estudiantes para los filtros seleccionados.'
        )
      ));
      return;
    }

    filtrados.forEach((est) => {
      const gradoTexto = (est.grado || '') + (est.seccion ? ' - Secc. ' + est.seccion : '');
      const iniciales = est.nombre.split(' ').slice(0, 2).map((n) => n[0] || '').join('').toUpperCase();

      const tr = h('tr', { class: est.activo ? '' : 'row-inactive' },
        h('td', { class: 'who-cell' },
          h('div', { class: 'avatar-circle' }, iniciales || 'E'),
          h('div', { class: 'who-details' },
            h('strong', {}, est.nombre),
            h('small', { class: 'muted-text' }, `ID: ${est.id_estudiante}`)
          )
        ),
        h('td', {},
          h('code', { class: 'uid-code' }, est.uid_nfc)
        ),
        h('td', {}, gradoTexto || 'Sin asignar'),
        h('td', {}, est.ciclo_nombre || '2026'),
        h('td', {},
          est.activo
            ? h('span', { class: 'badge ok' }, 'Activo')
            : h('span', { class: 'badge off' }, 'Inactivo')
        ),
        h('td', { style: 'text-align: right;' },
          h('div', { class: 'action-buttons' },
            h('button', {
              type: 'button',
              class: 'btn-sm btn-outline',
              title: 'Editar información o estado',
              onclick: () => abrirModalEditarEstudiante(est)
            }, 'Editar'),
            h('button', {
              type: 'button',
              class: 'btn-sm btn-brand',
              title: 'Ver historial de marcajes',
              onclick: () => abrirModalAsistencias(est)
            }, 'Asistencias')
          )
        )
      );

      tbl.append(tr);
    });
  }

  function actualizarKpisEstudiantes() {
    const total = estudiantesCache.length;
    const activos = estudiantesCache.filter((e) => e.activo).length;
    const inactivos = total - activos;

    if ($('#kTotalEstudiantes')) $('#kTotalEstudiantes').textContent = total;
    if ($('#kActivos')) $('#kActivos').textContent = activos;
    if ($('#kInactivos')) $('#kInactivos').textContent = inactivos;
  }

  /* ---------- MODAL CREAR / EDITAR ESTUDIANTE ---------- */
  function abrirModalNuevoEstudiante() {
    const modal = $('#modalEstudiante');
    const form = $('#formEstudiante');
    const msg = $('#msgModalForm');

    if (!modal || !form) return;

    form.reset();
    $('#txtIdEstudiante').value = '';
    $('#lblModalTitulo').textContent = 'Nuevo Estudiante';
    $('#btnGuardarForm').textContent = 'Registrar Estudiante';
    if (msg) msg.style.display = 'none';

    // Seleccionar primer ciclo escolar por defecto
    const selCiclo = $('#selCicloEscolar');
    if (selCiclo && selCiclo.options.length) selCiclo.selectedIndex = 0;

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show');
    $('#txtUidNfc').focus();
  }

  function abrirModalEditarEstudiante(est) {
    const modal = $('#modalEstudiante');
    const msg = $('#msgModalForm');

    if (!modal) return;

    $('#txtIdEstudiante').value = est.id_estudiante;
    $('#txtUidNfc').value = est.uid_nfc;
    $('#txtNombre').value = est.nombre;
    $('#txtGrado').value = est.grado || '';
    $('#txtSeccion').value = est.seccion || '';
    $('#selEstado').value = est.activo ? '1' : '0';

    if (est.id_ciclo_escolar && $('#selCicloEscolar')) {
      $('#selCicloEscolar').value = est.id_ciclo_escolar;
    }

    $('#lblModalTitulo').textContent = `Editar: ${est.nombre}`;
    $('#btnGuardarForm').textContent = 'Guardar Cambios';
    if (msg) msg.style.display = 'none';

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show');
    $('#txtNombre').focus();
  }

  function cerrarModalEstudiante() {
    const modal = $('#modalEstudiante');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('show');
    }
  }

  async function guardarEstudiante(e) {
    e.preventDefault();

    const idEst = $('#txtIdEstudiante').value;
    const uidNfc = $('#txtUidNfc').value.trim().toUpperCase();
    const nombre = $('#txtNombre').value.trim();
    const grado = $('#txtGrado').value.trim();
    const seccion = $('#txtSeccion').value.trim();
    const idCiclo = $('#selCicloEscolar') ? parseInt($('#selCicloEscolar').value, 10) || null : null;
    const activo = parseInt($('#selEstado').value, 10);

    const msg = $('#msgModalForm');
    const btnGuardar = $('#btnGuardarForm');

    function mostrarErrorModal(texto) {
      if (msg) {
        msg.textContent = texto;
        msg.className = 'msg-box error';
        msg.style.display = 'block';
      }
    }

    if (!uidNfc || !nombre) {
      mostrarErrorModal('Por favor completa los campos obligatorios (*).');
      return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    const esEdicion = !!idEst;
    const endpoint = esEdicion ? `/api/estudiantes/${idEst}` : '/api/estudiantes';
    const metodo = esEdicion ? 'PUT' : 'POST';

    const cuerpo = {
      uid_nfc: uidNfc,
      nombre: nombre,
      grado: grado || null,
      seccion: seccion || null,
      id_establecimiento: CONFIG.ID_ESTABLECIMIENTO,
      activo: activo,
      id_ciclo_escolar: idCiclo
    };

    try {
      const res = await fetch(getApiUrl(endpoint), {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(cuerpo)
      });

      const data = await res.json();

      if (!res.ok) {
        mostrarErrorModal(data.detail || 'Ocurrió un error al guardar los datos.');
        btnGuardar.disabled = false;
        btnGuardar.textContent = esEdicion ? 'Guardar Cambios' : 'Registrar Estudiante';
        return;
      }

      cerrarModalEstudiante();
      await cargarEstudiantes();

    } catch (err) {
      console.error(err);
      mostrarErrorModal('No se pudo conectar con el servidor.');
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = esEdicion ? 'Guardar Cambios' : 'Registrar Estudiante';
    }
  }

  /* ---------- MODAL HISTORIAL DE ASISTENCIAS ---------- */
  function abrirModalAsistencias(est) {
    estudianteSeleccionadoAsistencia = est;
    periodoActualAsistencia = 'semana';

    const modal = $('#modalAsistencias');
    if (!modal) return;

    $('#lblAsistenciaNombre').textContent = `Asistencias de ${est.nombre}`;
    const gradoTexto = (est.grado || '') + (est.seccion ? ' ' + est.seccion : '');
    $('#lblAsistenciaMeta').textContent = `UID: ${est.uid_nfc} ${gradoTexto ? '· ' + gradoTexto : ''}`;

    // Resetear botones de pestañas
    $$('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-periodo') === 'semana');
    });

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show');

    cargarHistorialAsistencias();
  }

  function cerrarModalAsistencias() {
    const modal = $('#modalAsistencias');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('show');
    }
  }

  async function cargarHistorialAsistencias() {
    if (!estudianteSeleccionadoAsistencia) return;

    const tbl = $('#tblHistorialAsistencias');
    if (!tbl) return;

    tbl.innerHTML = `<tr><td colspan="3" class="empty">Cargando marcajes...</td></tr>`;

    try {
      const idEst = estudianteSeleccionadoAsistencia.id_estudiante;
      const url = getApiUrl(`/api/estudiantes/${idEst}/asistencias?periodo=${periodoActualAsistencia}`);
      const res = await fetch(url);

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      if (data.estudiante) {
        $('#lblAsistenciaNombre').textContent = `Asistencias de ${data.estudiante.nombre}`;
        const gradoTexto = (data.estudiante.grado || '') + (data.estudiante.seccion ? ' ' + data.estudiante.seccion : '');
        $('#lblAsistenciaMeta').textContent = `UID: ${data.estudiante.uid_nfc} ${gradoTexto ? '· ' + gradoTexto : ''}`;
      }
      const logs = Array.isArray(data.asistencias) ? data.asistencias : [];

      // Calcular contadores
      let entradas = 0;
      let salidas = 0;

      logs.forEach((l) => {
        if (l.tipo_registro === 'SALIDA') salidas++;
        else entradas++;
      });

      if ($('#asistTotal')) $('#asistTotal').textContent = logs.length;
      if ($('#asistEntradas')) $('#asistEntradas').textContent = entradas;
      if ($('#asistSalidas')) $('#asistSalidas').textContent = salidas;

      tbl.textContent = '';

      if (!logs.length) {
        tbl.append(h('tr', {},
          h('td', { colspan: '3', class: 'empty' }, 'No hay marcajes registrados para este período.')
        ));
        return;
      }

      logs.forEach((l) => {
        const esSalida = l.tipo_registro === 'SALIDA';
        const late = !esSalida && esTarde(l.fecha_hora);

        const tr = h('tr', {},
          h('td', {},
            h('strong', {}, formatoFechaGT(l.fecha_hora))
          ),
          h('td', {},
            esSalida
              ? h('span', { class: 'badge out' }, 'SALIDA')
              : h('span', { class: 'badge ok' }, 'ENTRADA')
          ),
          h('td', {},
            esSalida
              ? h('span', { class: 'badge rep' }, 'Salida registrada')
              : late
                ? h('span', { class: 'badge late' }, 'Llegó tarde')
                : h('span', { class: 'badge ok' }, 'A tiempo')
          )
        );

        tbl.append(tr);
      });

    } catch (err) {
      console.error(err);
      tbl.innerHTML = `<tr><td colspan="3" class="empty" style="color: var(--alta);">Error al obtener el historial de asistencias.</td></tr>`;
    }
  }

  /* ---------- INICIALIZACIÓN Y EVENT LISTENERS ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Nombre de usuario en cabecera
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
    } catch (e) {}

    // 2. Cerrar sesión
    const btnLogout = $('#btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        try { localStorage.removeItem('asistech_user'); } catch (e) {}
        window.location.replace('/');
      });
    }

    // 3. Filtros y Búsqueda
    const txtBuscar = $('#txtBuscar');
    if (txtBuscar) {
      txtBuscar.addEventListener('input', () => cargarEstudiantes());
    }

    const selFiltroEstado = $('#selFiltroEstado');
    if (selFiltroEstado) {
      selFiltroEstado.addEventListener('change', () => renderizarTablaEstudiantes());
    }

    // 4. Modal Estudiante
    const btnNuevoEstudiante = $('#btnNuevoEstudiante');
    if (btnNuevoEstudiante) {
      btnNuevoEstudiante.addEventListener('click', abrirModalNuevoEstudiante);
    }

    const btnCerrarModalEst = $('#btnCerrarModalEst');
    if (btnCerrarModalEst) {
      btnCerrarModalEst.addEventListener('click', cerrarModalEstudiante);
    }

    const btnCancelarForm = $('#btnCancelarForm');
    if (btnCancelarForm) {
      btnCancelarForm.addEventListener('click', cerrarModalEstudiante);
    }

    const formEstudiante = $('#formEstudiante');
    if (formEstudiante) {
      formEstudiante.addEventListener('submit', guardarEstudiante);
    }

    // 5. Modal Asistencias
    const btnCerrarModalAsis = $('#btnCerrarModalAsis');
    if (btnCerrarModalAsis) {
      btnCerrarModalAsis.addEventListener('click', cerrarModalAsistencias);
    }

    const btnCerrarHistorial = $('#btnCerrarHistorial');
    if (btnCerrarHistorial) {
      btnCerrarHistorial.addEventListener('click', cerrarModalAsistencias);
    }

    // Cambios de pestaña de período
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        $$('.tab-btn').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        periodoActualAsistencia = e.target.getAttribute('data-periodo');
        cargarHistorialAsistencias();
      });
    });

    // 6. Cargar datos iniciales
    cargarOpcionesAcademicas();
    cargarEstudiantes();
  });
})();
