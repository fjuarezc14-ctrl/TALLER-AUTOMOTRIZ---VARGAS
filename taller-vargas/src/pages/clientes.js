import { getClientes, createCliente, updateCliente } from '../api.js';

let containerElement = null;
let clientesList = [];

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="clientes-root"></div>`;
  const root = document.getElementById('clientes-root');

  // Renderizar Skeleton
  root.innerHTML = renderSkeleton();

  try {
    await cargarClientes();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

async function cargarClientes() {
  clientesList = await getClientes();
  renderClientes(clientesList);
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
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar clientes</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" id="btn-retry-clientes">Reintentar</button>
      </div>
    </div>`;
}

function renderClientes(clientes) {
  const root = document.getElementById('clientes-root');
  
  root.innerHTML = `
    <!-- Header & Search -->
    <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Directorio de Clientes</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Gestión de datos de contacto y facturación.</p>
      </div>
      <div class="flex items-center gap-3">
        <input type="text" id="search-clientes" placeholder="Buscar cliente..." class="form-input" style="width:260px;" />
        <button class="btn-primary" id="btn-nuevo-cliente-header" style="white-space:nowrap;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
          Nuevo Cliente
        </button>
      </div>
    </div>

    <!-- Table Card -->
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Nombre / Razón Social</th>
              <th>Contacto</th>
              <th>Vehículos Asociados</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-clientes-body">
            ${renderTableRows(clientes)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Nuevo / Editar Cliente -->
    <div id="modal-cliente" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span class="modal-title" id="modal-cli-titulo">Nuevo Cliente</span>
          </div>
          <button class="modal-close" id="btn-close-modal-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-cliente">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
            <input type="hidden" id="cliente-id" />
            
            <div class="form-section-title">Identificación</div>
            <div class="grid grid-cols-3 gap-3">
              <div class="form-group">
                <label class="form-label">Tipo Doc</label>
                <select id="cli-tipo-doc" class="form-select" required>
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">C.E.</option>
                  <option value="PAS">Pasaporte</option>
                </select>
              </div>
              <div class="form-group col-span-2">
                <label class="form-label">Número Documento</label>
                <input type="text" id="cli-num-doc" class="form-input font-mono" required placeholder="Ej: 12345678" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Nombre Completo / Razón Social</label>
              <input type="text" id="cli-nombre" class="form-input" required placeholder="Ej: Transportes Vargas S.A.C." />
            </div>

            <div class="form-section-title" style="margin-top:8px;">Datos de Contacto</div>
            <div class="grid grid-cols-2 gap-3">
              <div class="form-group">
                <label class="form-label">Teléfono / WhatsApp</label>
                <input type="text" id="cli-telefono" class="form-input" required placeholder="Ej: 987654321" />
              </div>
              <div class="form-group">
                <label class="form-label">Correo (Opcional)</label>
                <input type="email" id="cli-correo" class="form-input" placeholder="ejemplo@correo.com" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Dirección (Opcional)</label>
              <input type="text" id="cli-direccion" class="form-input" placeholder="Av. Principal 123" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-modal-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-cliente">Guardar Cliente</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Registrar Event Listeners
  document.getElementById('search-clientes').addEventListener('input', filtrarClientes);
  document.getElementById('btn-nuevo-cliente-header').addEventListener('click', () => abrirModalCliente());
  document.getElementById('btn-close-modal-x').addEventListener('click', cerrarModalCliente);
  document.getElementById('btn-close-modal-cancel').addEventListener('click', cerrarModalCliente);
  document.getElementById('form-cliente').addEventListener('submit', guardarCliente);

  // Registrar eventos dinámicos para editar
  document.getElementById('tabla-clientes-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-cliente');
    if (editBtn) {
      const id = editBtn.dataset.id;
      abrirModalCliente(id);
    }
  });

  const retryBtn = document.getElementById('btn-retry-clientes');
  if (retryBtn) retryBtn.addEventListener('click', () => init(containerElement));
}

function renderTableRows(clientes) {
  if (clientes.length === 0) {
    return `<tr><td colspan="5" class="td-empty">No se encontraron clientes</td></tr>`;
  }

  return clientes.map(c => {
    const listPlacas = Array.isArray(c.vehiculos) ? c.vehiculos : JSON.parse(c.vehiculos || '[]');
    const tagsVehiculos = listPlacas.length > 0
      ? listPlacas.map(placa => `<span class="placa-badge" style="font-size:10px;padding:2px 6px;margin-right:4px;">${placa}</span>`).join('')
      : `<span style="font-size:11px;color:var(--slate-6);font-style:italic;">Sin vehículos</span>`;

    return `
      <tr>
        <td>
          <span style="font-size:11px;font-weight:700;color:var(--slate-5);display:block;text-transform:uppercase;">${c.tipo_doc}</span>
          <span class="font-mono" style="font-weight:700;color:var(--dark);">${c.num_doc}</span>
        </td>
        <td><strong style="color:var(--dark);">${c.nombre}</strong></td>
        <td>
          <div style="font-weight:600;color:var(--dark);display:flex;align-items:center;gap:4px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            ${c.telefono}
          </div>
          ${c.correo ? `<div style="font-size:11px;color:var(--slate-5);margin-top:2px;">${c.correo}</div>` : ''}
        </td>
        <td><div class="flex" style="flex-wrap:wrap;gap:4px;">${tagsVehiculos}</div></td>
        <td class="text-right">
          <div class="flex justify-end gap-2">
            <a href="https://wa.me/51${c.telefono.replace(/\D/g, '')}" target="_blank" class="btn-icon" title="WhatsApp" style="color:#10b981;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </a>
            <button class="btn-icon btn-edit-cliente" data-id="${c.id}" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filtrarClientes() {
  const q = document.getElementById('search-clientes').value.toLowerCase().trim();
  const filtrados = clientesList.filter(c => 
    c.nombre.toLowerCase().includes(q) || 
    c.num_doc.toLowerCase().includes(q) || 
    (c.telefono && c.telefono.toLowerCase().includes(q))
  );
  document.getElementById('tabla-clientes-body').innerHTML = renderTableRows(filtrados);
}

function abrirModalCliente(id = null) {
  const modal = document.getElementById('modal-cliente');
  const form = document.getElementById('form-cliente');
  form.reset();

  const titulo = document.getElementById('modal-cli-titulo');
  const btnSubmit = document.getElementById('btn-save-cliente');
  
  if (id) {
    const c = clientesList.find(item => item.id == id);
    if (!c) return;

    document.getElementById('cliente-id').value = c.id;
    document.getElementById('cli-tipo-doc').value = c.tipo_doc;
    document.getElementById('cli-num-doc').value = c.num_doc;
    document.getElementById('cli-nombre').value = c.nombre;
    document.getElementById('cli-telefono').value = c.telefono;
    document.getElementById('cli-correo').value = c.correo || '';
    document.getElementById('cli-direccion').value = c.direccion || '';

    titulo.textContent = 'Editar Cliente';
    btnSubmit.textContent = 'Actualizar Datos';
  } else {
    document.getElementById('cliente-id').value = '';
    titulo.textContent = 'Nuevo Cliente';
    btnSubmit.textContent = 'Guardar Cliente';
  }

  modal.classList.add('active');
}

function cerrarModalCliente() {
  document.getElementById('modal-cliente').classList.remove('active');
}

async function guardarCliente(e) {
  e.preventDefault();
  const id = document.getElementById('cliente-id').value;
  const data = {
    tipo_doc: document.getElementById('cli-tipo-doc').value,
    num_doc: document.getElementById('cli-num-doc').value.trim(),
    nombre: document.getElementById('cli-nombre').value.trim(),
    telefono: document.getElementById('cli-telefono').value.trim(),
    correo: document.getElementById('cli-correo').value.trim() || null,
    direccion: document.getElementById('cli-direccion').value.trim() || null
  };

  try {
    if (id) {
      await updateCliente(id, data);
    } else {
      await createCliente(data);
    }
    cerrarModalCliente();
    await cargarClientes();
  } catch (err) {
    alert(err.message);
  }
}

export function destroy() {
  // Limpieza si es necesario
}
