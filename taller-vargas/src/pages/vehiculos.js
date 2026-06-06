import { getVehiculos, getClientes, createVehiculo, updateVehiculo, getHistorial } from '../api.js';

let containerElement = null;
let vehiculosList = [];
let clientesList = [];

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="vehiculos-root"></div>`;
  const root = document.getElementById('vehiculos-root');

  // CTA Global: Nuevo Vehículo
  window.setCTAButton('Nuevo Vehículo', () => abrirModalVehiculo());

  // Renderizar Skeleton
  root.innerHTML = renderSkeleton();

  try {
    await cargarDatos();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

async function cargarDatos() {
  const [v, c] = await Promise.all([getVehiculos(), getClientes()]);
  vehiculosList = v;
  clientesList = c;
  renderVehiculos(vehiculosList);
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
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar datos de vehículos</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" id="btn-retry-vehiculos">Reintentar</button>
      </div>
    </div>`;
}

function renderVehiculos(vehiculos) {
  const root = document.getElementById('vehiculos-root');
  
  root.innerHTML = `
    <!-- Header & Search -->
    <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Directorio de Vehículos</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Base de datos histórica de carros atendidos en el taller.</p>
      </div>
      <div>
        <input type="text" id="search-vehiculos" placeholder="Buscar placa, modelo..." class="form-input" style="width:260px;" />
      </div>
    </div>

    <!-- Table Card -->
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Marca / Modelo</th>
              <th>Año</th>
              <th>Propietario / Cliente</th>
              <th>Última Visita</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-vehiculos-body">
            ${renderTableRows(vehiculos)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Nuevo / Editar Vehículo -->
    <div id="modal-vehiculo" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 17H5a2 2 0 0 1-2-2V9.5L5.5 4h13l2.5 5.5V15a2 2 0 0 1-2 2Z"/><circle cx="8.5" cy="17" r="2.5"/><circle cx="15.5" cy="17" r="2.5"/><path d="M5 10h14"/></svg>
            </div>
            <span class="modal-title" id="modal-veh-titulo">Nuevo Vehículo</span>
          </div>
          <button class="modal-close" id="btn-close-veh-modal-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-vehiculo">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
            <input type="hidden" id="vehiculo-id" />
            
            <div class="form-section-title">Datos de la Unidad</div>
            <div class="grid grid-cols-3 gap-3">
              <div class="form-group">
                <label class="form-label">Placa</label>
                <input type="text" id="veh-placa" class="form-input font-mono uppercase font-bold" required placeholder="Ej: ABC-123" />
              </div>
              <div class="form-group">
                <label class="form-label">Marca / Modelo</label>
                <input type="text" id="veh-marca" class="form-input" required placeholder="Ej: Toyota Corolla" />
              </div>
              <div class="form-group">
                <label class="form-label">Año (Opcional)</label>
                <input type="number" id="veh-anio" class="form-input" placeholder="Ej: 2020" min="1950" max="2030" />
              </div>
            </div>

            <div class="form-section-title" style="margin-top:8px;">Vinculación a Cliente</div>
            <div class="form-group">
              <label class="form-label">Cliente Propietario</label>
              <select id="veh-cliente-id" class="form-select" required>
                <option value="">-- Seleccionar Cliente --</option>
                ${clientesList.map(c => `<option value="${c.id}">${c.nombre} (${c.num_doc})</option> font-bold`).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-veh-modal-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-vehiculo">Guardar Vehículo</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Historial Clínico -->
    <div id="modal-historial" class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <span class="modal-title">Historial Clínico: <span id="historial-placa" class="text-brand font-mono" style="color:var(--brand);"></span></span>
          </div>
          <button class="modal-close" id="btn-close-historial-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
          <div class="flex gap-4" style="background:var(--slate-9);padding:14px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
            <div>
              <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Vehículo</p>
              <p id="historial-modelo" style="font-weight:700;color:var(--dark);margin-top:2px;"></p>
            </div>
            <div style="width:1px;background:var(--slate-8);"></div>
            <div>
              <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Propietario</p>
              <p id="historial-cliente" style="font-weight:700;color:var(--dark);margin-top:2px;"></p>
            </div>
          </div>

          <h3 style="font-size:12px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;">Órdenes de Servicio Anteriores</h3>
          <div class="card">
            <div style="overflow-x:auto;">
              <table class="data-table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th>Fecha / N° Orden</th>
                    <th>Kilometraje</th>
                    <th>Falla Reportada / Trabajo</th>
                    <th>Estado</th>
                    <th class="text-right">Total Est.</th>
                  </tr>
                </thead>
                <tbody id="tabla-historial-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Registrar Eventos
  document.getElementById('search-vehiculos').addEventListener('input', filtrarVehiculos);
  document.getElementById('btn-close-veh-modal-x').addEventListener('click', cerrarModalVehiculo);
  document.getElementById('btn-close-veh-modal-cancel').addEventListener('click', cerrarModalVehiculo);
  document.getElementById('form-vehiculo').addEventListener('submit', guardarVehiculo);
  document.getElementById('btn-close-historial-x').addEventListener('click', cerrarModalHistorial);

  // Escuchar clicks dinámicos para editar y ver historial
  document.getElementById('tabla-vehiculos-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-vehiculo');
    const histBtn = e.target.closest('.btn-history-vehiculo');
    
    if (editBtn) {
      abrirModalVehiculo(editBtn.dataset.id);
    } else if (histBtn) {
      verHistorial(histBtn.dataset.id);
    }
  });

  const retryBtn = document.getElementById('btn-retry-vehiculos');
  if (retryBtn) retryBtn.addEventListener('click', () => init(containerElement));
}

function renderTableRows(vehiculos) {
  if (vehiculos.length === 0) {
    return `<tr><td colspan="6" class="td-empty">No se encontraron vehículos</td></tr>`;
  }

  return vehiculos.map(v => {
    const dateFormatted = v.ultima_visita ? new Date(v.ultima_visita).toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' }) : '—';
    return `
      <tr>
        <td><span class="placa-badge">${v.placa}</span></td>
        <td><strong style="color:var(--dark);">${v.marca_modelo}</strong></td>
        <td>${v.anio || '—'}</td>
        <td>
          <span style="font-weight:600;color:var(--dark);">${v.cliente_nombre || '—'}</span>
          ${v.cliente_telefono ? `<div style="font-size:11px;color:var(--slate-5);">${v.cliente_telefono}</div>` : ''}
        </td>
        <td>${dateFormatted}</td>
        <td class="text-right">
          <div class="flex justify-end gap-2">
            <button class="btn-icon btn-history-vehiculo" data-id="${v.id}" title="Ver Historial Clínico">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
            <button class="btn-icon btn-edit-vehiculo" data-id="${v.id}" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filtrarVehiculos() {
  const q = document.getElementById('search-vehiculos').value.toLowerCase().trim();
  const filtrados = vehiculosList.filter(v =>
    v.placa.toLowerCase().includes(q) ||
    v.marca_modelo.toLowerCase().includes(q) ||
    (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(q))
  );
  document.getElementById('tabla-vehiculos-body').innerHTML = renderTableRows(filtrados);
}

function abrirModalVehiculo(id = null) {
  const modal = document.getElementById('modal-vehiculo');
  const form = document.getElementById('form-vehiculo');
  form.reset();

  const titulo = document.getElementById('modal-veh-titulo');
  const btnSubmit = document.getElementById('btn-save-vehiculo');

  if (id) {
    const v = vehiculosList.find(item => item.id == id);
    if (!v) return;

    document.getElementById('vehiculo-id').value = v.id;
    document.getElementById('veh-placa').value = v.placa;
    document.getElementById('veh-marca').value = v.marca_modelo;
    document.getElementById('veh-anio').value = v.anio || '';
    document.getElementById('veh-cliente-id').value = v.cliente_id || '';

    titulo.textContent = 'Editar Vehículo';
    btnSubmit.textContent = 'Actualizar Vehículo';
  } else {
    document.getElementById('vehiculo-id').value = '';
    titulo.textContent = 'Nuevo Vehículo';
    btnSubmit.textContent = 'Guardar Vehículo';
  }

  modal.classList.add('active');
}

function cerrarModalVehiculo() {
  document.getElementById('modal-vehiculo').classList.remove('active');
}

async function guardarVehiculo(e) {
  e.preventDefault();
  const id = document.getElementById('vehiculo-id').value;
  const data = {
    placa: document.getElementById('veh-placa').value.trim().toUpperCase(),
    marca_modelo: document.getElementById('veh-marca').value.trim(),
    anio: parseInt(document.getElementById('veh-anio').value) || null,
    cliente_id: parseInt(document.getElementById('veh-cliente-id').value) || null
  };

  try {
    if (id) {
      await updateVehiculo(id, data);
    } else {
      await createVehiculo(data);
    }
    cerrarModalVehiculo();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

async function verHistorial(id) {
  const v = vehiculosList.find(item => item.id == id);
  if (!v) return;

  document.getElementById('historial-placa').textContent = v.placa;
  document.getElementById('historial-modelo').textContent = v.marca_modelo;
  document.getElementById('historial-cliente').textContent = v.cliente_nombre || 'Sin cliente';

  const tbody = document.getElementById('tabla-historial-body');
  tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px;color:var(--slate-5);">Cargando historial...</td></tr>`;
  document.getElementById('modal-historial').classList.add('active');

  try {
    const hist = await getHistorial(id);
    if (hist.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Este vehículo no tiene órdenes registradas</td></tr>`;
    } else {
      tbody.innerHTML = hist.map(h => {
        const dateStr = new Date(h.fecha_ingreso).toLocaleDateString('es-PE');
        return `
          <tr>
            <td>
              <span style="font-weight:700;color:var(--dark);">${dateStr}</span>
              <div style="font-size:10px;color:var(--slate-5);margin-top:2px;">Orden #${h.id}</div>
            </td>
            <td><strong>${h.kilometraje.toLocaleString()} Km</strong></td>
            <td>
              <div style="font-weight:500;color:var(--dark);">${h.falla_reportada || '—'}</div>
            </td>
            <td>
              <span class="badge ${h.estado === 'Finalizado' ? 'badge-emerald' : 'badge-amber'}">${h.estado}</span>
            </td>
            <td class="text-right font-bold font-mono">S/ ${parseFloat(h.total_estimado || 0).toFixed(2)}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px;color:#dc2626;">Error al cargar: ${err.message}</td></tr>`;
  }
}

function cerrarModalHistorial() {
  document.getElementById('modal-historial').classList.remove('active');
}

export function destroy() {}
