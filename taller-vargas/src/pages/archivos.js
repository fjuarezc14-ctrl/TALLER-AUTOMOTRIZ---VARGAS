import { getArchivos, createArchivo, deleteArchivo } from '../api.js';

let containerElement = null;
let archivosList = [];

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="archivos-root"></div>`;
  const root = document.getElementById('archivos-root');

  // CTA Global: Cargar Archivo
  window.setCTAButton('Subir Archivo', () => abrirModalSubir());

  // Renderizar skeleton
  root.innerHTML = renderSkeleton();

  try {
    await cargarDatos();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

async function cargarDatos() {
  archivosList = await getArchivos();
  renderArchivos(archivosList);
}

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

function getFileIconConfig(tipo) {
  switch (tipo?.toLowerCase()) {
    case 'pdf':
      return { icon: '📄', color: '#ef4444', bg: '#fee2e2' };
    case 'excel':
    case 'xlsx':
    case 'xls':
      return { icon: '📊', color: '#10b981', bg: '#d1fae5' };
    case 'word':
    case 'docx':
    case 'doc':
      return { icon: '📝', color: '#3b82f6', bg: '#dbeafe' };
    case 'img':
    case 'jpg':
    case 'png':
    case 'jpeg':
      return { icon: '🖼️', color: '#f59e0b', bg: '#fef3c7' };
    default:
      return { icon: '📁', color: '#64748b', bg: '#e2e8f0' };
  }
}

function renderArchivos(archivos) {
  const root = document.getElementById('archivos-root');

  root.innerHTML = `
    <!-- Header & Search -->
    <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Archivos Compartidos</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Manuales de despiece, reglamentos y evidencias de servicio.</p>
      </div>
      <div>
        <input type="text" id="search-archivos" placeholder="Buscar por título o área..." class="form-input" style="width:260px;" />
      </div>
    </div>

    <!-- Table Card -->
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nombre del Documento</th>
              <th>Área / Categoría</th>
              <th class="text-center">Tamaño</th>
              <th>Subido el</th>
              <th>Subido por</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-archivos-body">
            ${renderTableRows(archivos)}
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

            <div class="form-group">
              <label class="form-label">Área / Destino</label>
              <select id="arc-area" class="form-select" required>
                <option value="Taller">Taller / Mecánicos</option>
                <option value="Administración">Administración</option>
                <option value="Facturación">Facturación / Contabilidad</option>
                <option value="Evidencias">Evidencias de Vehículos</option>
                <option value="General">General / Todos</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-subir-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-archivo">Guardar Archivo</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Registrar Eventos
  document.getElementById('search-archivos').addEventListener('input', filtrarArchivos);
  document.getElementById('btn-close-subir-x').addEventListener('click', cerrarModalSubir);
  document.getElementById('btn-close-subir-cancel').addEventListener('click', cerrarModalSubir);
  document.getElementById('form-subir').addEventListener('submit', guardarArchivo);

  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-upload-input');
  
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', mostrarArchivoSeleccionado);

  // Escuchar descargas y eliminaciones dinámicas
  document.getElementById('tabla-archivos-body').addEventListener('click', (e) => {
    const downBtn = e.target.closest('.btn-download-file');
    const delBtn = e.target.closest('.btn-delete-file');

    if (downBtn) descargarArchivo(downBtn.dataset.filename);
    else if (delBtn) eliminarArchivo(delBtn.dataset.id);
  });
}

function renderTableRows(archivos) {
  if (archivos.length === 0) {
    return `<tr><td colspan="6" class="td-empty">No se encontraron archivos compartidos</td></tr>`;
  }

  return archivos.map(a => {
    const config = getFileIconConfig(a.tipo);
    const dateStr = new Date(a.created_at || new Date()).toLocaleDateString('es-PE');
    return `
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${config.bg};font-size:18px;">
              ${config.icon}
            </div>
            <div>
              <strong style="color:var(--dark);font-size:13px;display:block;">${a.titulo}</strong>
              <span class="font-mono" style="font-size:11px;color:var(--slate-5);">${a.filename}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="badge badge-slate">${a.area}</span>
        </td>
        <td class="text-center font-mono" style="font-size:12px;">${parseFloat(a.size_mb).toFixed(1)} MB</td>
        <td>${dateStr}</td>
        <td><strong>${a.subido_por}</strong></td>
        <td class="text-right">
          <div class="flex justify-end gap-2">
            <button class="btn-icon btn-download-file" data-filename="${a.filename}" title="Descargar Documento">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 3v12"/></svg>
            </button>
            <button class="btn-icon btn-delete-file" data-id="${a.id}" title="Eliminar" style="color:#ef4444;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filtrarArchivos() {
  const q = document.getElementById('search-archivos').value.toLowerCase().trim();
  const filtrados = archivosList.filter(a => 
    a.titulo.toLowerCase().includes(q) || 
    a.area.toLowerCase().includes(q) ||
    a.filename.toLowerCase().includes(q)
  );
  document.getElementById('tabla-archivos-body').innerHTML = renderTableRows(filtrados);
}

function abrirModalSubir() {
  const modal = document.getElementById('modal-subir');
  const form = document.getElementById('form-subir');
  form.reset();

  document.getElementById('file-name-display').classList.add('hidden');
  modal.classList.add('active');
}

function cerrarModalSubir() {
  document.getElementById('modal-subir').classList.remove('active');
}

function mostrarArchivoSeleccionado(e) {
  const file = e.target.files[0];
  if (!file) return;

  const display = document.getElementById('file-name-display');
  const text = document.getElementById('file-name-text');
  
  text.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
  display.classList.remove('hidden');

  // Autocompletar el campo título si está vacío
  const titleInput = document.getElementById('arc-titulo');
  if (!titleInput.value) {
    titleInput.value = file.name.replace(/\.[^/.]+$/, "");
  }
}

function detectarExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['jpg', 'png', 'jpeg', 'gif'].includes(ext)) return 'img';
  return 'otro';
}

async function guardarArchivo(e) {
  e.preventDefault();
  const fileInput = document.getElementById('file-upload-input');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Por favor selecciona un archivo.');
    return;
  }

  const file = fileInput.files[0];
  const size_mb = file.size / (1024 * 1024);

  const data = {
    titulo: document.getElementById('arc-titulo').value.trim(),
    filename: file.name,
    tipo: detectarExtension(file.name),
    size_mb,
    area: document.getElementById('arc-area').value,
    subido_por: 'Administrador'
  };

  try {
    await createArchivo(data);
    cerrarModalSubir();
    await cargarDatos();
    alert('Archivo guardado exitosamente en el repositorio.');
  } catch (err) {
    alert(err.message);
  }
}

function descargarArchivo(filename) {
  alert(`Descargando archivo: ${filename}\n(Simulación de descarga desde el almacén de archivos del taller).`);
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
