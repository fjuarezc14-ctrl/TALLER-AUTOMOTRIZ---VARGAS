import { getArchivos, createArchivo, deleteArchivo, getClientes, getVehiculos } from '../api.js';

let containerElement = null;
let archivosList     = [];
let clientesList     = [];
let vehiculosList    = [];

// Filtros activos
let filtros = { q: '', tipo: 'todos', fechaInicio: '', fechaFin: '' };

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="archivos-root"></div>`;
  const root = document.getElementById('archivos-root');
  root.innerHTML = renderSkeleton();

  try {
    [archivosList, clientesList, vehiculosList] = await Promise.all([
      getArchivos(), getClientes(), getVehiculos()
    ]);
    renderArchivos();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

async function cargarDatos() {
  [archivosList, clientesList, vehiculosList] = await Promise.all([
    getArchivos(), getClientes(), getVehiculos()
  ]);
  renderArchivos();
}

/* ══════════════════════════════════════════════════════════
   SKELETON / ERROR
   ══════════════════════════════════════════════════════════ */
function renderSkeleton() {
  return `
    <div class="mb-6 flex justify-between items-center">
      <div style="height:24px;width:200px;background:var(--slate-8);border-radius:8px"></div>
      <div style="height:38px;width:250px;background:var(--slate-8);border-radius:8px"></div>
    </div>
    <div class="card" style="height:300px;background:var(--white);"></div>
  `;
}

function renderError(msg) {
  return `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <div class="card-body text-center" style="padding:48px 24px;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar archivos</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════
   FILE ICON HELPER
   ══════════════════════════════════════════════════════════ */
function getFileIconConfig(tipo) {
  switch (tipo?.toLowerCase()) {
    case 'pdf':   return { icon: '📄', color: '#ef4444', bg: '#fee2e2',  label: 'PDF' };
    case 'excel':
    case 'xlsx':
    case 'xls':   return { icon: '📊', color: '#10b981', bg: '#d1fae5',  label: 'Excel' };
    case 'word':
    case 'docx':
    case 'doc':   return { icon: '📝', color: '#3b82f6', bg: '#dbeafe',  label: 'Word' };
    case 'img':
    case 'jpg':
    case 'png':
    case 'jpeg':  return { icon: '🖼️', color: '#f59e0b', bg: '#fef3c7',  label: 'Imagen' };
    default:      return { icon: '📁', color: '#64748b', bg: '#e2e8f0',  label: 'Otro' };
  }
}

/* ══════════════════════════════════════════════════════════
   RENDER PRINCIPAL
   ══════════════════════════════════════════════════════════ */
function renderArchivos() {
  const root = document.getElementById('archivos-root');

  root.innerHTML = `
    <!-- Header -->
    <div class="flex justify-between items-center mb-4" style="flex-wrap:wrap;gap:14px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Repositorio de Archivos</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Manuales, evidencias y documentos compartidos del taller.</p>
      </div>
      <button id="btn-subir-archivo-header" class="btn-primary flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        Subir Archivo
      </button>
    </div>

    <!-- Filtros avanzados -->
    <div class="card" style="margin-bottom:16px;padding:14px 18px;">
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
        <div style="flex:1;min-width:200px;">
          <label class="form-label" style="font-size:11px;">🔍 Buscar</label>
          <input type="text" id="search-archivos" class="form-input" placeholder="Título, área, cliente, placa..." style="font-size:12px;" value="${filtros.q}" />
        </div>
        <div style="min-width:140px;">
          <label class="form-label" style="font-size:11px;">📂 Tipo</label>
          <select id="filter-tipo" class="form-select" style="font-size:12px;">
            <option value="todos" ${filtros.tipo==='todos'?'selected':''}>Todos los tipos</option>
            <option value="pdf"   ${filtros.tipo==='pdf'?'selected':''}>📄 PDF</option>
            <option value="excel" ${filtros.tipo==='excel'?'selected':''}>📊 Excel</option>
            <option value="word"  ${filtros.tipo==='word'?'selected':''}>📝 Word</option>
            <option value="img"   ${filtros.tipo==='img'?'selected':''}>🖼️ Imagen</option>
            <option value="otro"  ${filtros.tipo==='otro'?'selected':''}>📁 Otro</option>
          </select>
        </div>
        <div style="min-width:140px;">
          <label class="form-label" style="font-size:11px;">📅 Desde</label>
          <input type="date" id="filter-fecha-inicio" class="form-input" style="font-size:12px;" value="${filtros.fechaInicio}" />
        </div>
        <div style="min-width:140px;">
          <label class="form-label" style="font-size:11px;">📅 Hasta</label>
          <input type="date" id="filter-fecha-fin" class="form-input" style="font-size:12px;" value="${filtros.fechaFin}" />
        </div>
        <button id="btn-clear-filtros" class="btn-ghost" style="font-size:12px;padding:8px 14px;" title="Limpiar filtros">✕ Limpiar</button>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Área</th>
              <th>Vinculado a</th>
              <th class="text-center">Tamaño</th>
              <th>Subido el</th>
              <th>Por</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-archivos-body">
            ${renderTableRows(aplicarFiltros())}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Subir Archivo -->
    <div id="modal-subir" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            </div>
            <span class="modal-title">Cargar Documento</span>
          </div>
          <button class="modal-close" id="btn-close-subir-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-subir">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">

            <!-- Drop zone -->
            <div id="drop-area" style="border:2px dashed var(--slate-7);border-radius:var(--radius-md);padding:24px;text-align:center;cursor:pointer;background:var(--slate-9);transition:all .15s;">
              <div style="font-size:32px;margin-bottom:8px;">☁️</div>
              <p style="font-weight:700;color:var(--dark);font-size:13px;">Haz clic para buscar o arrastra tu archivo aquí</p>
              <p style="font-size:11px;color:var(--slate-5);margin-top:4px;">PDF, JPG, PNG, DOCX, XLSX (Máx. 25MB)</p>
              <input type="file" id="file-upload-input" class="hidden" required />
            </div>

            <div id="file-name-display" class="hidden flex items-center gap-2" style="background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;padding:10px 14px;border-radius:var(--radius-md);font-weight:600;font-size:12px;">
              <span>✔️</span>
              <span id="file-name-text"></span>
            </div>

            <div class="form-group">
              <label class="form-label">Nombre Descriptivo / Título</label>
              <input type="text" id="arc-titulo" class="form-input" required placeholder="Ej: Manual Técnico Toyota Hilux 2026" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="form-group" style="margin:0;">
                <label class="form-label">Área / Destino</label>
                <select id="arc-area" class="form-select" required>
                  <option value="Taller">Taller / Mecánicos</option>
                  <option value="Administración">Administración</option>
                  <option value="Facturación">Facturación / Contabilidad</option>
                  <option value="Evidencias">Evidencias de Vehículos</option>
                  <option value="General">General / Todos</option>
                </select>
              </div>
              <div class="form-group" style="margin:0;">
                <label class="form-label">Asociar a Cliente (Opcional)</label>
                <select id="arc-cliente" class="form-select">
                  <option value="">— Sin asociar —</option>
                  ${clientesList.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Asociar a Vehículo / Placa (Opcional)</label>
              <select id="arc-vehiculo" class="form-select">
                <option value="">— Sin asociar —</option>
                ${vehiculosList.map(v => `<option value="${v.id}">${v.placa} — ${v.marca_modelo}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Notas adicionales (Opcional)</label>
              <textarea id="arc-notas" class="form-textarea" rows="2" placeholder="Observaciones, número de versión, etc."></textarea>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-subir-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-archivo">Guardar Archivo</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de Duplicado (estilo Explorador Windows) -->
    <div id="modal-duplicado" class="modal-overlay">
      <div class="modal modal-sm" style="max-width:440px;">
        <div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#1e293b);">
          <div class="flex items-center gap-3">
            <div style="width:32px;height:32px;background:rgba(251,191,36,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;">
              ⚠️
            </div>
            <span class="modal-title" style="color:white;">Archivo ya existe</span>
          </div>
        </div>
        <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;">
          <p style="font-size:13px;color:var(--slate-4);">El repositorio ya contiene un archivo con el nombre:</p>
          <div style="background:var(--slate-9);border:1px solid var(--slate-8);border-radius:var(--radius-md);padding:10px 14px;font-family:monospace;font-size:12px;font-weight:700;color:var(--dark);" id="dup-filename-label"></div>
          <p style="font-size:12px;color:var(--slate-5);">¿Qué deseas hacer?</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button id="btn-dup-reemplazar" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:var(--radius-md);border:1.5px solid #bfdbfe;background:#eff6ff;cursor:pointer;text-align:left;">
              <span style="font-size:20px;">🔄</span>
              <div>
                <p style="font-weight:800;font-size:13px;color:#1d4ed8;">Reemplazar archivo existente</p>
                <p style="font-size:11px;color:#3b82f6;margin-top:1px;">Elimina el anterior y sube este nuevo.</p>
              </div>
            </button>
            <button id="btn-dup-copia" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:var(--radius-md);border:1.5px solid #bbf7d0;background:#f0fdf4;cursor:pointer;text-align:left;">
              <span style="font-size:20px;">📋</span>
              <div>
                <p style="font-weight:800;font-size:13px;color:#166534;">Subir como copia</p>
                <p style="font-size:11px;color:#16a34a;margin-top:1px;">Se guardará como <span id="dup-copy-name" style="font-family:monospace;font-weight:700;"></span></p>
              </div>
            </button>
            <button id="btn-dup-cancelar" style="padding:10px;border-radius:var(--radius-md);border:1px solid var(--slate-7);background:none;cursor:pointer;font-size:13px;color:var(--slate-5);">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Eventos ──────────────────────────────────────────────
  document.getElementById('search-archivos').addEventListener('input', (e) => { filtros.q = e.target.value; actualizarTabla(); });
  document.getElementById('filter-tipo').addEventListener('change', (e) => { filtros.tipo = e.target.value; actualizarTabla(); });
  document.getElementById('filter-fecha-inicio').addEventListener('change', (e) => { filtros.fechaInicio = e.target.value; actualizarTabla(); });
  document.getElementById('filter-fecha-fin').addEventListener('change', (e) => { filtros.fechaFin = e.target.value; actualizarTabla(); });
  document.getElementById('btn-clear-filtros').addEventListener('click', () => {
    filtros = { q: '', tipo: 'todos', fechaInicio: '', fechaFin: '' };
    document.getElementById('search-archivos').value = '';
    document.getElementById('filter-tipo').value = 'todos';
    document.getElementById('filter-fecha-inicio').value = '';
    document.getElementById('filter-fecha-fin').value = '';
    actualizarTabla();
  });

  document.getElementById('btn-subir-archivo-header').addEventListener('click', abrirModalSubir);
  document.getElementById('btn-close-subir-x').addEventListener('click', cerrarModalSubir);
  document.getElementById('btn-close-subir-cancel').addEventListener('click', cerrarModalSubir);
  document.getElementById('form-subir').addEventListener('submit', guardarArchivo);

  // Filtrar vehículos al seleccionar cliente
  document.getElementById('arc-cliente').addEventListener('change', (e) => {
    const cliId = e.target.value;
    const vehSelect = document.getElementById('arc-vehiculo');
    vehSelect.innerHTML = '<option value="">— Sin asociar —</option>';
    const lista = cliId
      ? vehiculosList.filter(v => String(v.cliente_id) === String(cliId))
      : vehiculosList;
    lista.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.placa} — ${v.marca_modelo}`;
      vehSelect.appendChild(opt);
    });
  });

  const dropArea  = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-upload-input');
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', mostrarArchivoSeleccionado);
  dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.style.borderColor = 'var(--brand)'; dropArea.style.background = '#ecfdf5'; });
  dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = 'var(--slate-7)'; dropArea.style.background = 'var(--slate-9)'; });
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = 'var(--slate-7)';
    dropArea.style.background  = 'var(--slate-9)';
    const file = e.dataTransfer.files[0];
    if (file) { fileInput._droppedFile = file; mostrarArchivoSeleccionado({ target: { files: [file] } }); }
  });

  // Tabla delegada
  document.getElementById('tabla-archivos-body').addEventListener('click', (e) => {
    const delBtn = e.target.closest('.btn-delete-file');
    const dlBtn  = e.target.closest('.btn-download-file');
    if (delBtn) eliminarArchivo(delBtn.dataset.id);
    if (dlBtn)  descargarArchivo(dlBtn.dataset.filename);
  });
}

/* ══════════════════════════════════════════════════════════
   FILTROS & TABLA
   ══════════════════════════════════════════════════════════ */
function aplicarFiltros() {
  const { q, tipo, fechaInicio, fechaFin } = filtros;
  return archivosList.filter(a => {
    const matchQ = !q || [a.titulo, a.area, a.filename, a.cliente_nombre, a.vehiculo_placa]
      .some(v => v?.toLowerCase().includes(q.toLowerCase()));
    const matchTipo = tipo === 'todos' || a.tipo === tipo;
    const fecha = a.created_at ? new Date(a.created_at) : null;
    const matchDesde = !fechaInicio || (fecha && fecha >= new Date(fechaInicio));
    const matchHasta = !fechaFin   || (fecha && fecha <= new Date(fechaFin + 'T23:59:59'));
    return matchQ && matchTipo && matchDesde && matchHasta;
  });
}

function actualizarTabla() {
  document.getElementById('tabla-archivos-body').innerHTML = renderTableRows(aplicarFiltros());
}

function renderTableRows(archivos) {
  if (archivos.length === 0) {
    return `<tr><td colspan="7" class="td-empty">No se encontraron archivos con los filtros aplicados</td></tr>`;
  }

  return archivos.map(a => {
    const cfg     = getFileIconConfig(a.tipo);
    const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('es-PE') : '—';

    const badgeCliente  = a.cliente_nombre
      ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;margin-right:4px;">👤 ${a.cliente_nombre}</span>`
      : '';
    const badgePlaca = a.vehiculo_placa
      ? `<span class="placa-badge" style="font-size:10px;">${a.vehiculo_placa}</span>`
      : '';
    const vinculado = (badgeCliente || badgePlaca)
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">${badgeCliente}${badgePlaca}</div>`
      : `<span style="color:var(--slate-6);font-size:11px;">—</span>`;

    return `
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${cfg.bg};font-size:18px;flex-shrink:0;">
              ${cfg.icon}
            </div>
            <div>
              <strong style="color:var(--dark);font-size:13px;display:block;">${a.titulo}</strong>
              <span class="font-mono" style="font-size:10px;color:var(--slate-5);">${a.filename}</span>
              ${a.notas ? `<span style="font-size:10px;color:var(--slate-6);display:block;font-style:italic;">${a.notas}</span>` : ''}
            </div>
          </div>
        </td>
        <td><span class="badge badge-slate">${a.area}</span></td>
        <td>${vinculado}</td>
        <td class="text-center font-mono" style="font-size:12px;">${parseFloat(a.size_mb || 0).toFixed(1)} MB</td>
        <td style="font-size:12px;">${dateStr}</td>
        <td><strong style="font-size:12px;">${a.subido_por}</strong></td>
        <td class="text-right">
          <div class="flex justify-end gap-1">
            <button class="btn-action-ord btn-download-file" data-filename="${a.filename}" title="Descargar" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 3v12"/></svg>
              Bajar
            </button>
            <button class="btn-action-ord btn-delete-file" data-id="${a.id}" title="Eliminar" style="background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Borrar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   MODAL SUBIR
   ══════════════════════════════════════════════════════════ */
function abrirModalSubir() {
  document.getElementById('form-subir').reset();
  document.getElementById('file-name-display').classList.add('hidden');
  // Restaurar lista completa de vehículos al abrir
  const vehSelect = document.getElementById('arc-vehiculo');
  vehSelect.innerHTML = '<option value="">— Sin asociar —</option>';
  vehiculosList.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.placa} — ${v.marca_modelo}`;
    vehSelect.appendChild(opt);
  });
  document.getElementById('modal-subir').classList.add('active');
}

function cerrarModalSubir() {
  document.getElementById('modal-subir').classList.remove('active');
}

function mostrarArchivoSeleccionado(e) {
  const file = e.target.files[0];
  if (!file) return;
  const display = document.getElementById('file-name-display');
  document.getElementById('file-name-text').textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
  display.classList.remove('hidden');
  const titleInput = document.getElementById('arc-titulo');
  if (!titleInput.value) titleInput.value = file.name.replace(/\.[^/.]+$/, '');
}

function detectarExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext))                return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  if (['doc', 'docx'].includes(ext))        return 'word';
  if (['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(ext)) return 'img';
  return 'otro';
}

/* ══════════════════════════════════════════════════════════
   GUARDAR ARCHIVO (con detección de duplicados)
   ══════════════════════════════════════════════════════════ */
async function guardarArchivo(e) {
  e.preventDefault();

  const fileInput = document.getElementById('file-upload-input');
  const file      = fileInput._droppedFile || (fileInput.files?.[0]);

  if (!file) { alert('Por favor selecciona un archivo.'); return; }

  const data = buildArchivoData(file);

  // Detectar duplicado por nombre exacto
  const duplicado = archivosList.find(a => a.filename === file.name);

  if (duplicado) {
    mostrarDialogoDuplicado(duplicado, data, file);
    return;
  }

  await subirArchivo(data);
}

function buildArchivoData(file, filenameOverride = null) {
  return {
    titulo:      document.getElementById('arc-titulo').value.trim(),
    filename:    filenameOverride || file.name,
    tipo:        detectarExtension(file.name),
    size_mb:     file.size / (1024 * 1024),
    area:        document.getElementById('arc-area').value,
    subido_por:  'Administrador',
    cliente_id:  document.getElementById('arc-cliente').value || null,
    vehiculo_id: document.getElementById('arc-vehiculo').value || null,
    notas:       document.getElementById('arc-notas').value.trim() || null,
  };
}

function generarNombreCopia(filename) {
  const ext  = filename.includes('.') ? '.' + filename.split('.').pop() : '';
  const base = filename.replace(/\.[^/.]+$/, '');
  // Buscar si ya hay copias para incrementar el número
  const copiasExistentes = archivosList.filter(a => a.filename.startsWith(`${base} (Copia`));
  const n = copiasExistentes.length + 1;
  return n === 1 ? `${base} (Copia)${ext}` : `${base} (Copia ${n})${ext}`;
}

function mostrarDialogoDuplicado(duplicado, data, file) {
  const copyName = generarNombreCopia(file.name);
  document.getElementById('dup-filename-label').textContent = file.name;
  document.getElementById('dup-copy-name').textContent      = copyName;
  document.getElementById('modal-duplicado').classList.add('active');

  // Reemplazar: eliminar el antiguo, subir el nuevo con el mismo nombre
  document.getElementById('btn-dup-reemplazar').onclick = async () => {
    document.getElementById('modal-duplicado').classList.remove('active');
    try {
      await deleteArchivo(duplicado.id);
      await subirArchivo(data);
    } catch (err) { alert(err.message); }
  };

  // Subir como copia con nombre nuevo
  document.getElementById('btn-dup-copia').onclick = async () => {
    document.getElementById('modal-duplicado').classList.remove('active');
    await subirArchivo({ ...data, filename: copyName, titulo: data.titulo + ' (Copia)' });
  };

  document.getElementById('btn-dup-cancelar').onclick = () => {
    document.getElementById('modal-duplicado').classList.remove('active');
  };
}

async function subirArchivo(data) {
  const btn = document.getElementById('btn-save-archivo');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    await createArchivo(data);
    cerrarModalSubir();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar Archivo'; }
  }
}

/* ══════════════════════════════════════════════════════════
   ACCIONES DE TABLA
   ══════════════════════════════════════════════════════════ */
function descargarArchivo(filename) {
  alert(`Descargando: ${filename}\n(Simulación de descarga desde el almacén de archivos del taller).`);
}

async function eliminarArchivo(id) {
  if (!confirm('¿Deseas eliminar permanentemente este archivo del repositorio?')) return;
  try {
    await deleteArchivo(id);
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

export function destroy() {}
