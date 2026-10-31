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

  /* ---------- EXPORTAR REPORTE (PDF / EXCEL) ---------- */
  function hoyGT() {
    const o = {};
    FMT.formatToParts(new Date()).forEach((p) => { o[p.type] = p.value; });
    return `${o.year}-${o.month}-${o.day}`;
  }

  function horaGT(v) {
    if (!v) return '—';
    const o = {};
    FMT.formatToParts(toDate(v)).forEach((p) => { o[p.type] = p.value; });
    return `${pad(o.hour)}:${pad(o.minute)}`;
  }

  function llenarSelect(sel, valores) {
    sel.innerHTML = '';
    sel.append(h('option', { value: '' }, 'Todos'));
    valores.forEach((v) => sel.append(h('option', { value: v }, v)));
  }

  function mostrarMsgReporte(texto) {
    const msg = $('#msgReporte');
    msg.textContent = texto;
    msg.className = 'msg-box error';
    msg.style.display = 'block';
  }

  function abrirModalReporte() {
    const uniq = (k) => [...new Set(estudiantesCache.map((e) => e[k]).filter(Boolean))].sort();
    llenarSelect($('#selRepGrado'), uniq('grado'));
    llenarSelect($('#selRepSeccion'), uniq('seccion'));
    const hoy = hoyGT();
    $('#txtRepDesde').value = hoy;
    $('#txtRepHasta').value = hoy;
    $('#msgReporte').style.display = 'none';
    const m = $('#modalReporte');
    m.setAttribute('aria-hidden', 'false');
    m.classList.add('show');
  }

  function cerrarModalReporte() {
    const m = $('#modalReporte');
    m.setAttribute('aria-hidden', 'true');
    m.classList.remove('show');
  }

  async function obtenerDatosReporte() {
    const p = new URLSearchParams({
      id_establecimiento: CONFIG.ID_ESTABLECIMIENTO,
      grado: $('#selRepGrado').value,
      seccion: $('#selRepSeccion').value,
      desde: $('#txtRepDesde').value,
      hasta: $('#txtRepHasta').value
    });
    try {
      const res = await fetch(getApiUrl('/api/reporte_asistencia?' + p.toString()));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const filas = await res.json();
      if (!filas.length) {
        mostrarMsgReporte('No hay asistencias para los filtros seleccionados.');
        return null;
      }
      $('#msgReporte').style.display = 'none';
      return filas;
    } catch (e) {
      mostrarMsgReporte('No se pudo generar el reporte.');
      return null;
    }
  }

  const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function tablaReporteHtml(filas) {
    const cab = ['Fecha', 'Estudiante', 'UID tarjeta', 'Grado', 'Hora entrada', 'Hora salida'];
    const cuerpo = filas.map((f) => [
      f.dia, f.nombre, f.uid_nfc,
      (f.grado || '') + (f.seccion ? ' - ' + f.seccion : ''),
      horaGT(f.entrada), horaGT(f.salida)
    ]);
    return '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;font-family:Arial;font-size:12px">'
      + '<thead><tr>' + cab.map((c) => `<th style="background:#e8eef7">${c}</th>`).join('') + '</tr></thead><tbody>'
      + cuerpo.map((r) => '<tr>' + r.map((c) => `<td style="mso-number-format:'\\@'">${escHtml(c)}</td>`).join('') + '</tr>').join('')
      + '</tbody></table>';
  }

  function tituloReporte() {
    const g = $('#selRepGrado').value || 'Todos los grados';
    const s = $('#selRepSeccion').value || 'todas las secciones';
    return `Reporte de asistencia — ${g}, ${s} (${$('#txtRepDesde').value} a ${$('#txtRepHasta').value})`;
  }

  async function exportarExcel() {
    const filas = await obtenerDatosReporte();
    if (!filas) return;
    const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'
      + tablaReporteHtml(filas) + '</body></html>';
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte_asistencia_${$('#txtRepDesde').value}_${$('#txtRepHasta').value}.xls`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function exportarPdf() {
    const filas = await obtenerDatosReporte();
    if (!filas) return;
    if (!window.jspdf) {
      mostrarMsgReporte('No se pudo cargar la librería PDF (revisa tu conexión a internet).');
      return;
    }
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(13);
    doc.text(tituloReporte(), 14, 15);
    doc.autoTable({
      startY: 22,
      head: [['Fecha', 'Estudiante', 'UID tarjeta', 'Grado', 'Hora entrada', 'Hora salida']],
      body: filas.map((f) => [f.dia, f.nombre, f.uid_nfc, (f.grado || '') + (f.seccion ? ' - ' + f.seccion : ''), horaGT(f.entrada), horaGT(f.salida)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [37, 99, 235] }
    });
    doc.save('reporte_asistencia_' + $('#txtRepDesde').value + '_' + $('#txtRepHasta').value + '.pdf');
  }

  /* ---------- LISTADO DE ASISTENCIA MENSUAL (PDF) ---------- */
  const NOMBRE_ESCUELA = 'UMG';
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const LETRAS_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  function mostrarMsgListado(texto) {
    const msg = $('#msgListado');
    msg.textContent = texto;
    msg.className = 'msg-box error';
    msg.style.display = 'block';
  }

  function abrirModalListado() {
    const uniq = (k) => [...new Set(estudiantesCache.map((e) => e[k]).filter(Boolean))].sort();
    const selG = $('#selLisGrado');
    const selS = $('#selLisSeccion');
    selG.innerHTML = '';
    uniq('grado').forEach((v) => selG.append(h('option', { value: v }, v)));
    llenarSelect(selS, uniq('seccion'));
    selS.options[0].textContent = 'Todas';

    const selMes = $('#selLisMes');
    selMes.innerHTML = '';
    MESES.forEach((m, i) => selMes.append(h('option', { value: String(i + 1) }, m)));
    const hoy = hoyGT().split('-');
    selMes.value = String(parseInt(hoy[1], 10));
    $('#txtLisAnio').value = hoy[0];
    $('#msgListado').style.display = 'none';

    const m = $('#modalListado');
    m.setAttribute('aria-hidden', 'false');
    m.classList.add('show');
  }

  function cerrarModalListado() {
    const m = $('#modalListado');
    m.setAttribute('aria-hidden', 'true');
    m.classList.remove('show');
  }

  async function generarListadoPdf() {
    if (!window.jspdf) {
      mostrarMsgListado('No se pudo cargar la librería PDF (revisa tu conexión a internet).');
      return;
    }
    const mes = parseInt($('#selLisMes').value, 10);
    const anio = parseInt($('#txtLisAnio').value, 10);
    const grado = $('#selLisGrado').value;
    const seccion = $('#selLisSeccion').value;
    if (!anio || !grado) {
      mostrarMsgListado('Selecciona el grado y el año.');
      return;
    }

    // Estudiantes activos del grado/sección elegidos (solo filas con datos, sin espacios vacíos)
    const alumnos = estudiantesCache
      .filter((e) => e.activo && e.grado === grado && (!seccion || e.seccion === seccion))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!alumnos.length) {
      mostrarMsgListado('No hay estudiantes activos para ese grado y sección.');
      return;
    }

    // Días hábiles (lunes a viernes) del mes, agrupados por semana
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const dias = [];
    for (let d = 1; d <= ultimo; d++) {
      const dt = new Date(Date.UTC(anio, mes - 1, d));
      const dow = dt.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const clave = `${anio}-${pad(mes)}-${pad(d)}`;
      const lunes = d - (dow - 1);
      dias.push({ clave, letra: LETRAS_DIA[dow], semana: lunes });
    }
    const semanas = [];
    dias.forEach((d) => {
      let s = semanas[semanas.length - 1];
      if (!s || s.id !== d.semana) { s = { id: d.semana, dias: [] }; semanas.push(s); }
      s.dias.push(d);
    });

    // Marcajes del mes
    const p = new URLSearchParams({
      id_establecimiento: CONFIG.ID_ESTABLECIMIENTO,
      grado: grado,
      seccion: seccion,
      desde: `${anio}-${pad(mes)}-01`,
      hasta: `${anio}-${pad(mes)}-${pad(ultimo)}`
    });
    let filas;
    try {
      const res = await fetch(getApiUrl('/api/reporte_asistencia?' + p.toString()));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      filas = await res.json();
    } catch (e) {
      mostrarMsgListado('No se pudieron consultar las asistencias.');
      return;
    }
    const marcas = {};
    filas.forEach((f) => { marcas[`${String(f.uid_nfc).toUpperCase()}|${f.dia}`] = f; });

    // A = entrada y salida, R = solo una, F = ninguna. Días futuros quedan en blanco.
    const hoy = hoyGT();
    const estado = (uid, dia) => {
      if (dia > hoy) return '';
      const f = marcas[`${String(uid).toUpperCase()}|${dia}`];
      if (!f) return 'F';
      if (f.entrada && f.salida) return 'A';
      return 'R';
    };
    const diasEvaluados = dias.filter((d) => d.clave <= hoy);

    const body = alumnos.map((e, i) => {
      const celdas = dias.map((d) => estado(e.uid_nfc, d.clave));
      const asist = celdas.filter((c) => c === 'A').length;
      const pct = diasEvaluados.length ? Math.round((asist / diasEvaluados.length) * 100) : '';
      return [String(i + 1), e.nombre, ...celdas, pct === '' ? '' : String(pct)];
    });

    // Fila "Asistencias del día"
    const totalesDia = dias.map((d, k) => (d.clave > hoy ? '' : String(body.filter((r) => r[2 + k] === 'A').length)));
    const promedio = diasEvaluados.length
      ? (totalesDia.filter((t) => t !== '').reduce((a, t) => a + Number(t), 0) / diasEvaluados.length)
      : 0;
    body.push(['', 'ASISTENCIAS DEL DÍA', ...totalesDia, '']);

    // Cabeceras
    const head1 = [
      { content: 'No.', rowSpan: 2 }, { content: 'NOMBRE', rowSpan: 2 },
      ...semanas.map((s, i) => ({ content: 'SEMANA ' + (i + 1), colSpan: s.dias.length })),
      { content: '%', rowSpan: 2 }
    ];
    const head2 = dias.map((d) => d.letra);

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFontSize(16);
    doc.text('LISTA DE ASISTENCIA', 148.5, 12, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${MESES[mes - 1].toUpperCase()} ${anio}`, 148.5, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`NOMBRE DE LA ESCUELA: ${NOMBRE_ESCUELA}`, 14, 26);
    doc.text(`GRADO: ${grado}`, 120, 26);
    doc.text(`SECCIÓN: ${seccion || 'Todas'}`, 200, 26);

    const ultimaFila = body.length - 1;
    const colores = { A: [198, 239, 206], R: [255, 217, 160], F: [255, 199, 206] };
    doc.autoTable({
      startY: 30,
      head: [head1, head2],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.2, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.15, textColor: 20 },
      headStyles: { fillColor: [68, 114, 196], textColor: 255 },
      columnStyles: { 1: { halign: 'left', cellWidth: 55 } },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (data.row.index === ultimaFila) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [226, 239, 218];
          return;
        }
        if (data.column.index >= 2 && data.column.index < 2 + dias.length) {
          const c = colores[data.cell.raw];
          if (c) data.cell.styles.fillColor = c;
        }
      }
    });

    let y = doc.lastAutoTable.finalY + 8;
    if (y > 180) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.text(`TOTAL DE ALUMNOS: ${alumnos.length}`, 14, y);
    doc.text(`PROMEDIO TOTAL: ${promedio.toFixed(2)}`, 90, y);
    doc.text('A = Asistió (entrada y salida)   R = Registro incompleto (solo entrada o solo salida)   F = Falta', 14, y + 7);
    doc.line(14, y + 22, 90, y + 22);
    doc.text('NOMBRE Y FIRMA DEL PROFESOR', 14, y + 27);
    doc.text('FECHA DE ENTREGA', 130, y + 27);

    doc.save(`lista_asistencia_${MESES[mes - 1].toLowerCase()}_${anio}_${grado.replace(/\s+/g, '')}${seccion || ''}.pdf`);
    $('#msgListado').style.display = 'none';
  }

  /* ---------- INICIALIZACIÓN Y EVENT LISTENERS ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    $('#btnReporte').addEventListener('click', abrirModalReporte);
    $('#btnCerrarReporte').addEventListener('click', cerrarModalReporte);
    $('#btnRepExcel').addEventListener('click', exportarExcel);
    $('#btnRepPdf').addEventListener('click', exportarPdf);

    $('#btnListado').addEventListener('click', abrirModalListado);
    $('#btnCerrarListado').addEventListener('click', cerrarModalListado);
    $('#btnLisPdf').addEventListener('click', generarListadoPdf);

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
    } catch (e) { }

    // 2. Cerrar sesión
    const btnLogout = $('#btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        try { localStorage.removeItem('asistech_user'); } catch (e) { }
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
