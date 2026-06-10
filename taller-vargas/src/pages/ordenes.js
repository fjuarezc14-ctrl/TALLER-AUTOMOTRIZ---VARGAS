import { 
  getOrdenes, getOrdenesEnProceso, getOrden, createOrden, updateOrden,
  cambiarEstado, addItem, deleteItem, getVehiculos, getMecanicos, getAlmacen,
  getClientes
} from '../api.js';

let containerElement = null;
let activeTab = 'all'; // 'all' o 'process'
let ordenesList = [];
let vehiculosList = [];
let mecanicosList = [];
let almacenList = [];
let clientesList = [];

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="ordenes-root"></div>`;
  
  await cargarDatos();
}

async function cargarDatos() {
  const root = document.getElementById('ordenes-root');
  root.innerHTML = `
    <div class="flex items-center justify-center" style="height:200px;">
      <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    const [ord, veh, mec, alm, clis] = await Promise.all([
      getOrdenes(),
      getVehiculos(),
      getMecanicos(),
      getAlmacen(),
      getClientes()
    ]);
    
    ordenesList = ord;
    vehiculosList = veh;
    mecanicosList = mec;
    almacenList = alm;
    clientesList = clis;

    renderPage();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

function renderError(msg) {
  return `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <div class="card-body text-center" style="padding:48px 24px;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar órdenes de servicio</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

function renderPage() {
  const root = document.getElementById('ordenes-root');

  // Filtrar según pestaña
  const filtradas = activeTab === 'process' 
    ? ordenesList.filter(o => o.estado === 'En Proceso' || o.estado === 'Esperando Repuestos' || o.estado === 'Diagnostico')
    : ordenesList;

  root.innerHTML = `
    <!-- Header & Tabs -->
    <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <div class="flex items-center gap-3">
          <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Órdenes de Servicio</h1>
          <button id="btn-nueva-orden-header" class="btn-primary flex items-center gap-2" style="padding:6px 14px; font-size:12px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
            Nueva Orden
          </button>
        </div>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Recepción de unidades, control técnico de costos y flujo del taller.</p>
      </div>
      <div class="flex gap-2" style="background:var(--slate-8);padding:4px;border-radius:10px;">
        <button class="btn-tab ${activeTab === 'all' ? 'active-tab' : ''}" id="tab-ord-all" style="font-size:12px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">Todas las Órdenes</button>
        <button class="btn-tab ${activeTab === 'process' ? 'active-tab' : ''}" id="tab-ord-proc" style="font-size:12px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">Vehículos en Proceso</button>
      </div>
    </div>

    <!-- Search -->
    <div class="mb-4 flex justify-end">
      <input type="text" id="search-ordenes" placeholder="Buscar por placa, orden o cliente..." class="form-input" style="width:280px;" />
    </div>

    <!-- Table Card -->
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>N° Orden</th>
              <th>Placa</th>
              <th>Vehículo</th>
              <th>Cliente</th>
              <th>Mecánico</th>
              <th>Estado</th>
              <th class="text-right">Total Est.</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-ordenes-body">
            ${renderTableRows(filtradas)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modales -->
    ${renderModales()}
    
    <!-- Contenedor de impresión oculto para window.print() -->
    <div id="print-area" style="display:none;"></div>
  `;

  // Estilo local CSS para pestañas y reglas de impresión
  const style = document.createElement('style');
  style.innerHTML = `
    .btn-tab { color: var(--slate-5); transition: all .15s; }
    .btn-tab:hover { color: var(--dark); }
    .btn-tab.active-tab { background: var(--white) !important; color: var(--dark) !important; box-shadow: var(--shadow-sm); }
    
    @media print {
      body > * { display: none !important; }
      #print-area { display: block !important; padding: 20px; font-family: monospace; background:#fff; color:#000; }
      .print-header { border-bottom: 2px double #000; padding-bottom: 12px; margin-bottom: 20px; text-align: center; }
      .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      .print-table th, .print-table td { border: 1px solid #000; padding: 8px; text-align: left; }
      .print-signatures { display: flex; justify-content: space-between; margin-top: 50px; }
      .signature-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 8px; font-size: 11px; }
    }
  `;
  root.appendChild(style);

  // Registrar eventos principales
  document.getElementById('tab-ord-all').addEventListener('click', () => { activeTab = 'all'; renderPage(); });
  document.getElementById('tab-ord-proc').addEventListener('click', () => { activeTab = 'process'; renderPage(); });
  document.getElementById('search-ordenes').addEventListener('input', filtrarOrdenes);
  document.getElementById('btn-nueva-orden-header').addEventListener('click', abrirModalNuevaOrden);

  // Registrar cierres de modales
  document.getElementById('btn-close-ord-x').addEventListener('click', cerrarModalNuevaOrden);
  document.getElementById('btn-close-ord-cancel').addEventListener('click', cerrarModalNuevaOrden);
  document.getElementById('form-nueva-orden').addEventListener('submit', guardarNuevaOrden);
  document.getElementById('veh-select-id').addEventListener('change', autoAsignarCliente);

  document.getElementById('btn-close-det-x').addEventListener('click', cerrarModalDetalle);
  document.getElementById('btn-close-status-x').addEventListener('click', cerrarModalEstado);
  document.getElementById('btn-close-status-cancel').addEventListener('click', cerrarModalEstado);
  document.getElementById('form-cambio-estado').addEventListener('submit', guardarEstadoOrden);
  document.getElementById('select-cambio-estado').addEventListener('change', toggleAlertaRepuestos);

  document.getElementById('btn-close-costos-x').addEventListener('click', cerrarModalCostos);
  document.getElementById('btn-close-costos-cancel').addEventListener('click', cerrarModalCostos);
  document.getElementById('form-agregar-costo').addEventListener('submit', guardarCostoItem);
  document.getElementById('item-tipo').addEventListener('change', toggleTipoCostoForm);

  // Escuchar eventos dinámicos en la tabla
  document.getElementById('tabla-ordenes-body').addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.btn-view-ord');
    const costBtn = e.target.closest('.btn-costs-ord');
    const statusBtn = e.target.closest('.btn-status-ord');

    if (viewBtn) verDetalleOrden(viewBtn.dataset.id);
    else if (costBtn) abrirModalCostos(costBtn.dataset.id);
    else if (statusBtn) abrirModalEstado(statusBtn.dataset.id);
  });
}

function renderTableRows(ordenes) {
  if (ordenes.length === 0) {
    return `<tr><td colspan="8" class="td-empty">No se encontraron órdenes de servicio</td></tr>`;
  }

  const badgeEstado = (est) => {
    const map = {
      'Diagnostico': 'badge-amber',
      'En Proceso': 'badge-blue',
      'Esperando Repuestos': 'badge-purple',
      'Finalizado': 'badge-emerald',
      'No realizo servicio': 'badge-slate'
    };
    return `<span class="badge ${map[est] || 'badge-slate'}">${est === 'Diagnostico' ? 'Diagnóstico' : est}</span>`;
  };

  return ordenes.map(o => `
    <tr>
      <td class="font-mono font-bold">OS-${o.id}</td>
      <td><span class="placa-badge">${o.placa || '—'}</span></td>
      <td><strong style="color:var(--dark);">${o.vehiculo || '—'}</strong></td>
      <td>
        <span style="font-weight:600;color:var(--dark);">${o.cliente || '—'}</span>
        ${o.cliente_telefono ? `<div style="font-size:11px;color:var(--slate-5);">${o.cliente_telefono}</div>` : ''}
      </td>
      <td><span style="font-weight:500;color:var(--slate-4);">${o.mecanico || '—'}</span></td>
      <td>${badgeEstado(o.estado)}</td>
      <td class="text-right font-mono font-bold">S/ ${parseFloat(o.total_estimado || 0).toFixed(2)}</td>
      <td class="text-right">
        <div class="flex justify-end gap-2">
          <button class="btn-icon btn-view-ord" data-id="${o.id}" title="Ver Detalles">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>
          <button class="btn-icon btn-costs-ord" data-id="${o.id}" title="Administrar Repuestos / Mano Obra" ${o.estado === 'Finalizado' ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 11v-1m0-1v-4m-5 4h10"/></svg>
          </button>
          <button class="btn-icon btn-status-ord" data-id="${o.id}" title="Cambiar Estado">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6.002L16.24 11M4 9h5M4 9l4.76-4.76"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarOrdenes() {
  const q = document.getElementById('search-ordenes').value.toLowerCase().trim();
  const filtradas = ordenesList.filter(o => 
    o.id.toString().includes(q) ||
    (o.placa && o.placa.toLowerCase().includes(q)) ||
    (o.cliente && o.cliente.toLowerCase().includes(q)) ||
    (o.vehiculo && o.vehiculo.toLowerCase().includes(q))
  );
  document.getElementById('tabla-ordenes-body').innerHTML = renderTableRows(filtradas);
}

// ──────────────────────────────────────────────────────────
// MODALES Y RENDER
// ──────────────────────────────────────────────────────────

function renderModales() {
  return `
    <!-- Modal Nueva Orden -->
    <div id="modal-nueva-orden" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
            </div>
            <span class="modal-title">Registrar Orden de Servicio</span>
          </div>
          <button class="modal-close" id="btn-close-ord-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-nueva-orden">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
            
            <div class="form-section-title">Recepción de Unidad</div>
            <div class="grid grid-cols-2 gap-3">
              <div class="form-group">
                <label class="form-label">Vehículo / Placa</label>
                <select id="veh-select-id" class="form-select" required>
                  <option value="">-- Seleccionar --</option>
                  ${vehiculosList.map(v => `<option value="${v.id}" data-cliente-id="${v.cliente_id}">${v.placa} - ${v.marca_modelo}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Cliente Asociado</label>
                <select id="cli-select-id" class="form-select" required>
                  <option value="">-- Seleccionar --</option>
                  ${clientesList.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="form-group">
                <label class="form-label">Kilometraje</label>
                <input type="number" id="ord-km" class="form-input text-center font-bold" required placeholder="Km" />
              </div>
              <div class="form-group col-span-2">
                <label class="form-label">Nivel Combustible</label>
                <select id="ord-combustible" class="form-select" required>
                  <option value="Vacio">Vacío</option>
                  <option value="1/4">1/4 Tanque</option>
                  <option value="1/2">1/2 Tanque</option>
                  <option value="3/4">3/4 Tanque</option>
                  <option value="Lleno">Lleno</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Mecánico Asignado (Opcional)</label>
              <select id="ord-mecanico" class="form-select">
                <option value="">-- Sin asignar --</option>
                ${mecanicosList.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Síntomas / Falla Reportada</label>
              <textarea id="ord-falla" class="form-textarea" rows="3" required placeholder="Escribe el diagnóstico preliminar o fallas indicadas por el cliente..."></textarea>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-ord-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-ord">Registrar Recepción</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Detalle Completo & Imprimir -->
    <div id="modal-detalle" class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg>
            </div>
            <span class="modal-title">Expediente de Servicio: OS-<span id="det-id-label"></span></span>
          </div>
          <button class="modal-close" id="btn-close-det-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:18px;">
          <!-- Alerta de repuestos esperando -->
          <div id="det-alerta-repuestos" class="hidden" style="background:#faf5ff;border:1px solid #e9d5ff;color:#7c3aed;padding:12px 16px;border-radius:var(--radius-md);font-weight:600;">
            <p style="font-size:11px;text-transform:uppercase;">⚠️ ESPERANDO REPUESTOS EN TALLER</p>
            <p id="det-repuestos-texto" style="font-size:13px;margin-top:4px;color:#581c87;font-style:italic;background:#fff;padding:8px;border-radius:6px;border:1px solid #f3e8ff;"></p>
          </div>

          <!-- Ficha Técnica -->
          <div class="grid grid-cols-3 gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            <div style="background:var(--slate-9);padding:12px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
              <span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Cliente</span>
              <p id="det-cliente" style="font-weight:800;color:var(--dark);margin-top:2px;"></p>
              <p id="det-cliente-tel" style="font-size:11px;color:var(--slate-5);margin-top:1px;"></p>
            </div>
            <div style="background:var(--slate-9);padding:12px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
              <span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Vehículo</span>
              <p id="det-vehiculo" style="font-weight:800;color:var(--dark);margin-top:2px;"></p>
              <span id="det-placa" class="placa-badge" style="display:inline-block;margin-top:3px;font-size:10px;"></span>
            </div>
            <div style="background:var(--slate-9);padding:12px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
              <span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Datos Entrada</span>
              <p id="det-km" style="font-weight:800;color:var(--dark);margin-top:2px;"></p>
              <p id="det-combustible" style="font-size:11px;color:var(--slate-5);margin-top:1px;"></p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Mecánico</span>
              <p id="det-mecanico" style="font-weight:700;color:var(--dark);margin-top:2px;"></p>
            </div>
            <div>
              <span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Estado Actual</span>
              <p id="det-estado" style="font-weight:700;margin-top:2px;"></p>
            </div>
          </div>

          <div style="border-top:1px dashed var(--slate-8);padding-top:10px;">
            <span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Falla / Diagnóstico</span>
            <p id="det-falla" style="font-size:13px;color:var(--dark);margin-top:4px;font-style:italic;background:var(--slate-9);padding:10px;border-radius:6px;border:1px solid var(--slate-8);"></p>
          </div>

          <!-- Listado de costos asignados -->
          <div style="border-top:1px dashed var(--slate-8);padding-top:10px;">
            <span style="font-size:12px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:block;">Detalle de Insumos y Servicios</span>
            <div class="card">
              <table class="data-table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th class="text-center">Cantidad</th>
                    <th class="text-right">Unitario</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody id="tabla-det-items"></tbody>
              </table>
            </div>
          </div>

          <div class="flex justify-between items-center" style="background:var(--dark);color:var(--white);padding:16px;border-radius:var(--radius-md);">
            <div>
              <p style="font-size:10px;color:var(--brand);font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Pre-Facturación Proyectada</p>
              <p style="font-size:11px;color:var(--slate-6);">Sujeta a variaciones</p>
            </div>
            <p id="det-total" style="font-size:24px;font-weight:900;font-family:monospace;color:var(--brand);"></p>
          </div>

          <!-- Botones de Impresión Premium (Requerimiento AÑADIR.txt) -->
          <div class="flex gap-3 pt-2" style="border-top:1px solid var(--slate-8);">
            <button class="btn-ghost" id="btn-print-hoja" style="flex:1;justify-content:center;background:#f8fafc;border:1px solid var(--slate-7);color:var(--dark);">
              🖨️ Orden de Servicio (Taller)
            </button>
            <button class="btn-success" id="btn-print-nota" style="flex:1;justify-content:center;color:var(--white);background:var(--dark);">
              🎫 Nota Interna (Cliente)
            </button>
          </div>

        </div>
      </div>
    </div>

    <!-- Modal Cambiar Estado -->
    <div id="modal-estado" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6.002L16.24 11M4 9h5M4 9l4.76-4.76"/></svg>
            </div>
            <span class="modal-title">Cambiar Estado</span>
          </div>
          <button class="modal-close" id="btn-close-status-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-cambio-estado">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" id="status-orden-id" />
            
            <div class="form-group">
              <label class="form-label">Estado de la Orden</label>
              <select id="select-cambio-estado" class="form-select" required>
                <option value="Diagnostico">Diagnóstico</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Esperando Repuestos">Esperando Repuestos</option>
                <option value="Finalizado">Finalizado</option>
                <option value="No realizo servicio">No se realizó el servicio</option>
              </select>
            </div>

            <!-- Si está esperando repuestos -->
            <div class="form-group hidden" id="wrapper-repuestos-espera">
              <label class="form-label">Detalle de Repuestos Requeridos</label>
              <textarea id="status-repuestos-textarea" class="form-textarea" rows="3" placeholder="Ingresa los repuestos que hacen falta..."></textarea>
            </div>

            <!-- Si se finaliza la orden -->
            <div class="flex items-center gap-2 hidden" id="wrapper-pasar-factura" style="margin:4px 0;">
              <input type="checkbox" id="chk-pasar-factura" style="width:16px;height:16px;cursor:pointer;" checked />
              <label for="chk-pasar-factura" style="font-size:12px;font-weight:700;color:var(--slate-4);cursor:pointer;">
                Pasar cobro a Facturación inmediatamente
              </label>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-status-cancel">Cancelar</button>
            <button type="submit" class="btn-primary">Actualizar Estado</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Administrar Costos (Insumos / Mano de Obra) -->
    <div id="modal-costos" class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 11v-1m0-1v-4m-5 4h10"/></svg>
            </div>
            <span class="modal-title">Asignación de Repuestos y Mano de Obra</span>
          </div>
          <button class="modal-close" id="btn-close-costos-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:18px;">
          
          <input type="hidden" id="costos-orden-id" />

          <!-- Panel de Diagnóstico Rápido y Semáforos Preventivos -->
          <div id="diagnostico-preventivo-box" class="hidden animate-fadeIn" style="background:var(--slate-9); border:1px solid var(--slate-8); padding:16px; border-radius:var(--radius-md); display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--slate-8); padding-bottom:8px;">
              <div>
                <span style="font-size:11px; font-weight:900; color:var(--dark); text-transform:uppercase; letter-spacing:0.5px;">🏥 Ficha de Diagnóstico y Estado Preventivo de Componentes</span>
                <p style="font-size:10px; color:var(--slate-5); margin:2px 0 0 0;">Haz clic en un componente para auto-rellenar la cotización según disponibilidad en stock.</p>
              </div>
              <span id="diag-veh-placa" class="placa-badge" style="font-size:11px; padding:3px 8px;">--</span>
            </div>
            
            <!-- Grid de 7 componentes preventivos -->
            <div id="diagnostico-preventivo-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:12px;">
              <!-- Se generará dinámicamente -->
            </div>
          </div>


          <!-- Agregar Costo Form -->
          <form id="form-agregar-costo" style="background:var(--slate-9);padding:16px;border-radius:var(--radius-md);border:1px solid var(--slate-8);display:flex;flex-direction:column;gap:12px;">
            <div class="form-section-title" style="margin-bottom:0;">Agregar Concepto / Repuesto</div>
            
            <div class="grid grid-cols-4 gap-3" style="grid-template-columns: 120px 2fr 1fr 1fr;">
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select id="item-tipo" class="form-select" required>
                  <option value="mano_obra">Mano Obra</option>
                  <option value="almacen">Repuesto</option>
                </select>
              </div>

              <!-- Si es Mano de Obra (descripción manual) -->
              <div class="form-group" id="wrapper-item-manual">
                <label class="form-label">Detalle del Trabajo</label>
                <input type="text" id="item-desc-manual" class="form-input" placeholder="Ej: Cambio de pastillas de freno" />
              </div>

              <!-- Si es Repuesto de almacén (select dinámico) -->
              <div class="form-group hidden" id="wrapper-item-almacen">
                <label class="form-label">Seleccionar Insumo de Almacén</label>
                <select id="item-repuesto-select" class="form-select">
                  <option value="">-- Seleccionar --</option>
                  ${almacenList.map(p => `<option value="${p.codigo}" data-precio="${p.precio_venta}">${p.descripcion} (Stock: ${p.stock})</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Cantidad</label>
                <input type="number" id="item-cantidad" min="1" value="1" class="form-input text-center font-bold" required />
              </div>

              <div class="form-group">
                <label class="form-label">Precio Unit. (S/)</label>
                <input type="number" id="item-precio" step="0.01" min="0" class="form-input text-right font-mono" required placeholder="0.00" />
              </div>
            </div>

            <div class="flex justify-end">
              <button type="submit" class="btn-success" style="font-size:12px;padding:6px 16px;">
                Agregar Concepto
              </button>
            </div>
          </form>

          <!-- Listado actual de la orden -->
          <div>
            <span style="font-size:12px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:block;">Detalle Actual</span>
            <div class="card">
              <table class="data-table" style="font-size:12px;">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th class="text-center">Cantidad</th>
                    <th class="text-right">Precio Unit.</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">Acción</th>
                  </tr>
                </thead>
                <tbody id="tabla-costos-items-body"></tbody>
              </table>
            </div>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn-primary" id="btn-close-costos-cancel">Terminado</button>
        </div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────
// LÓGICA DE EVENTOS Y ACCIONES INTERNAS
// ──────────────────────────────────────────────────────────

function abrirModalNuevaOrden() {
  const modal = document.getElementById('modal-nueva-orden');
  const form = document.getElementById('form-nueva-orden');
  form.reset();

  modal.classList.add('active');
}

function cerrarModalNuevaOrden() {
  document.getElementById('modal-nueva-orden').classList.remove('active');
}

function autoAsignarCliente() {
  const selectVeh = document.getElementById('veh-select-id');
  const selectedOpt = selectVeh.options[selectVeh.selectedIndex];
  if (!selectedOpt) return;

  const clienteId = selectedOpt.dataset.clienteId;
  if (clienteId) {
    document.getElementById('cli-select-id').value = clienteId;
  }
}

async function guardarNuevaOrden(e) {
  e.preventDefault();
  const data = {
    vehiculo_id: parseInt(document.getElementById('veh-select-id').value),
    cliente_id: parseInt(document.getElementById('cli-select-id').value),
    mecanico_id: parseInt(document.getElementById('ord-mecanico').value) || null,
    kilometraje: parseInt(document.getElementById('ord-km').value),
    nivel_combustible: document.getElementById('ord-combustible').value,
    falla_reportada: document.getElementById('ord-falla').value.trim()
  };

  try {
    await createOrden(data);
    cerrarModalNuevaOrden();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

async function verDetalleOrden(id) {
  try {
    const o = await getOrden(id);
    
    document.getElementById('det-id-label').textContent = o.id;
    document.getElementById('det-cliente').textContent = o.cliente;
    document.getElementById('det-cliente-tel').textContent = `Teléfono: ${o.cliente_telefono || '—'}`;
    document.getElementById('det-vehiculo').textContent = o.vehiculo;
    document.getElementById('det-placa').textContent = o.placa;
    document.getElementById('det-km').textContent = `${o.kilometraje.toLocaleString()} Km`;
    document.getElementById('det-combustible').textContent = `Combustible: ${o.nivel_combustible}`;
    document.getElementById('det-mecanico').textContent = o.mecanico || 'Sin asignar';
    
    const badge = document.getElementById('det-estado');
    badge.textContent = o.estado === 'Diagnostico' ? 'Diagnóstico' : o.estado;
    badge.className = '';
    const badgeMap = {
      'Diagnostico': 'badge badge-amber',
      'En Proceso': 'badge badge-blue',
      'Esperando Repuestos': 'badge badge-purple',
      'Finalizado': 'badge badge-emerald',
      'No realizo servicio': 'badge badge-slate'
    };
    badge.className = badgeMap[o.estado] || 'badge badge-slate';

    document.getElementById('det-falla').textContent = o.falla_reportada || '—';

    // Alerta repuestos
    const alertRep = document.getElementById('det-alerta-repuestos');
    if (o.estado === 'Esperando Repuestos' && o.repuestos_esperando) {
      document.getElementById('det-repuestos-texto').textContent = o.repuestos_esperando;
      alertRep.classList.remove('hidden');
    } else {
      alertRep.classList.add('hidden');
    }

    // Cargar Items
    const tbody = document.getElementById('tabla-det-items');
    if (o.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty">No se han registrado insumos ni servicios en esta orden.</td></tr>`;
    } else {
      tbody.innerHTML = o.items.map(it => `
        <tr>
          <td><strong>${it.descripcion}</strong>${it.repuesto_cod ? `<div style="font-size:10px;color:var(--slate-5);font-family:monospace;">SKU: ${it.repuesto_cod}</div>` : ''}</td>
          <td><span class="badge ${it.tipo === 'almacen' ? 'badge-purple' : 'badge-slate'}">${it.tipo === 'almacen' ? 'Repuesto' : 'Mano Obra'}</span></td>
          <td class="text-center font-bold">${it.cantidad}</td>
          <td class="text-right font-mono">S/ ${parseFloat(it.precio_unitario).toFixed(2)}</td>
          <td class="text-right font-mono font-bold">S/ ${(it.cantidad * parseFloat(it.precio_unitario)).toFixed(2)}</td>
        </tr>
      `).join('');
    }

    document.getElementById('det-total').textContent = `S/ ${parseFloat(o.total_estimado || 0).toFixed(2)}`;

    // Asignar eventos de impresión
    document.getElementById('btn-print-nota').onclick = () => imprimirDocumento('nota', o);
    document.getElementById('btn-print-hoja').onclick = () => imprimirDocumento('hoja', o);

    document.getElementById('modal-detalle').classList.add('active');
  } catch (err) {
    alert(err.message);
  }
}

function cerrarModalDetalle() {
  document.getElementById('modal-detalle').classList.remove('active');
}

function abrirModalEstado(id) {
  const o = ordenesList.find(item => item.id == id);
  if (!o) return;

  document.getElementById('status-orden-id').value = o.id;
  document.getElementById('select-cambio-estado').value = o.estado;
  document.getElementById('status-repuestos-textarea').value = o.repuestos_esperando || '';

  toggleAlertaRepuestos();
  document.getElementById('modal-estado').classList.add('active');
}

function cerrarModalEstado() {
  document.getElementById('modal-estado').classList.remove('active');
}

function toggleAlertaRepuestos() {
  const est = document.getElementById('select-cambio-estado').value;
  const wrpRepuestos = document.getElementById('wrapper-repuestos-espera');
  const wrpFactura = document.getElementById('wrapper-pasar-factura');

  if (est === 'Esperando Repuestos') {
    wrpRepuestos.classList.remove('hidden');
    document.getElementById('status-repuestos-textarea').required = true;
  } else {
    wrpRepuestos.classList.add('hidden');
    document.getElementById('status-repuestos-textarea').required = false;
  }

  if (est === 'Finalizado') {
    wrpFactura.classList.remove('hidden');
  } else {
    wrpFactura.classList.add('hidden');
  }
}

async function guardarEstadoOrden(e) {
  e.preventDefault();
  const id = document.getElementById('status-orden-id').value;
  const estado = document.getElementById('select-cambio-estado').value;
  const repuestos_esperando = estado === 'Esperando Repuestos' ? document.getElementById('status-repuestos-textarea').value.trim() : '';
  const pasar_facturacion = estado === 'Finalizado' ? document.getElementById('chk-pasar-factura').checked : false;

  try {
    await cambiarEstado(id, { estado, repuestos_esperando, pasar_facturacion });
    cerrarModalEstado();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

// Lógica de búsqueda de repuesto compatible en almacén
function buscarRepuestoEnAlmacen(tipoComponente, textoSugerido) {
  const keys = [];
  if (textoSugerido && textoSugerido !== 'undefined') {
    const words = textoSugerido.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== 'sugerido' && w !== 'sintetico' && w !== 'sintético');
    keys.push(...words);
  }
  // Añadir palabras clave según tipo de componente
  if (tipoComponente === 'aceite') keys.push('aceite');
  else if (tipoComponente === 'frenos') keys.push('freno', 'pastilla');
  else if (tipoComponente === 'bujias') keys.push('bujia');
  else if (tipoComponente === 'filtros') keys.push('filtro');
  else if (tipoComponente === 'liquido') keys.push('liquido', 'freno');
  else if (tipoComponente === 'refrigerante') keys.push('refrigerante', 'coolant', 'anticongelante');
  else if (tipoComponente === 'distribucion') keys.push('distribucion', 'faja', 'correa');

  // Buscar en almacenList
  let matched = null;
  if (keys.length > 0) {
    // Prioridad 1: Coincide alguna palabra clave y tiene stock > 0
    matched = almacenList.find(p => 
      p.stock > 0 && 
      keys.some(k => p.descripcion.toLowerCase().includes(k) || p.codigo.toLowerCase().includes(k))
    );
    // Prioridad 2: Coincide alguna palabra clave, aunque stock sea 0
    if (!matched) {
      matched = almacenList.find(p => 
        keys.some(k => p.descripcion.toLowerCase().includes(k) || p.codigo.toLowerCase().includes(k))
      );
    }
  }
  return matched;
}

// Renderizar dinámicamente el panel de diagnóstico preventivo de 7 componentes en el modal de costos
function renderDiagnosticoPreventivo(v, ordenId) {
  const diagBox = document.getElementById('diagnostico-preventivo-box');
  const diagGrid = document.getElementById('diagnostico-preventivo-grid');
  const placaLabel = document.getElementById('diag-veh-placa');

  if (!v) {
    diagBox.classList.add('hidden');
    return;
  }

  diagBox.classList.remove('hidden');
  placaLabel.textContent = `${v.placa} · ${v.marca_modelo}`;

  const components = [
    { key: 'aceite',       name: 'Aceite Motor',   limit: 8000,  icon: '🛢️', sugField: 'sug_aceite',       kmField: 'km_ultimo_aceite' },
    { key: 'frenos',       name: 'Pastillas Freno',limit: 30000, icon: '🔩', sugField: null,               kmField: 'km_ultimo_frenos' },
    { key: 'bujias',       name: 'Bujías',         limit: 40000, icon: '⚡', sugField: 'sug_bujias',       kmField: 'km_ultimo_bujias' },
    { key: 'filtros',      name: 'Filtros (Aire/Cabina)', limit: 15000, icon: '💨', sugField: 'sug_filtros',   kmField: 'km_ultimo_filtros' },
    { key: 'liquido',      name: 'Líquido Frenos', limit: 40000, icon: '💧', sugField: null,               kmField: 'km_ultimo_liquido_frenos' },
    { key: 'refrigerante', name: 'Refrigerante',   limit: 40000, icon: '❄️', sugField: 'sug_refrigerante', kmField: 'km_ultimo_refrigerante' },
    { key: 'distribucion', name: 'Faja Distribución', limit: 80000, icon: '⛓️', sugField: null,             kmField: 'km_ultimo_distribucion' }
  ];

  const kmAct = v.km_actual || 0;
  const kmFallback = v.km_ultimo_servicio || 0;

  const htmlList = components.map(c => {
    const kmComponente = v[c.kmField];
    const kmUltimo = (kmComponente !== null && kmComponente !== undefined) ? kmComponente : kmFallback;
    
    let statusClass = 'unknown';
    let statusLabel = 'Sin reg.';
    let wearText = `Sugerido: cada ${c.limit.toLocaleString()} km`;
    
    if (kmAct && kmUltimo !== null && kmUltimo !== undefined) {
      const diff = kmAct - kmUltimo;
      if (diff <= 0) {
        statusClass = 'ok';
        statusLabel = 'OK';
        wearText = `Recién cambiado (0 km / ${c.limit.toLocaleString()} km)`;
      } else {
        const pct = Math.round((diff / c.limit) * 100);
        if (pct >= 100) {
          statusClass = 'alert';
          statusLabel = '¡Vencido!';
        } else if (pct >= 70) {
          statusClass = 'warn';
          statusLabel = 'Por vencer';
        } else {
          statusClass = 'ok';
          statusLabel = 'OK';
        }
        wearText = `${diff.toLocaleString()} / ${c.limit.toLocaleString()} km (${pct}%)`;
      }
    }

    const textoSugerido = c.sugField ? (v[c.sugField] || '') : '';
    
    // Buscar repuesto en inventario
    const matched = buscarRepuestoEnAlmacen(c.key, textoSugerido);
    
    let inventoryStatusHtml = `<span style="color:var(--slate-5); font-style:italic;">No catalogado en almacén</span>`;
    if (matched) {
      if (matched.stock > 0) {
        inventoryStatusHtml = `<span style="color:#047857; font-weight:700;">📦 Stock: ${matched.stock} u. · S/ ${parseFloat(matched.precio_venta).toFixed(2)}</span>`;
      } else {
        inventoryStatusHtml = `<span style="color:#b91c1c; font-weight:700;">⚠️ Agotado · S/ ${parseFloat(matched.precio_venta).toFixed(2)}</span>`;
      }
    }

    const escapedSugerido = (textoSugerido || '').replace(/'/g, "\\'");

    return `
      <div class="component-diag-card" style="background:var(--white); border:1px solid var(--slate-7); padding:10px; border-radius:var(--radius-md); display:flex; flex-direction:column; justify-content:space-between; gap:8px; box-shadow:var(--shadow-sm); transition:all 0.15s ease;">
        <!-- Fila Superior: Icono, Nombre, Kilometraje y Semáforo -->
        <div style="display:flex; justify-content:space-between; align-items:start; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px; display:inline-block;">${c.icon}</span>
            <div>
              <span style="font-size:12px; font-weight:800; color:var(--dark); display:block; line-height:1.2;">${c.name}</span>
              <span style="font-size:10px; color:var(--slate-5); font-family:monospace; display:block;">${wearText}</span>
            </div>
          </div>
          <div class="mant-item ${statusClass}" style="padding:2px 8px; flex:none; border-radius:12px; display:flex; align-items:center; gap:4px; border:1px solid transparent; height:20px; cursor:default; width:auto; flex-direction:row;">
            <div class="mant-dot" style="width:6px; height:6px; margin:0;"></div>
            <span style="font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:0.3px;">${statusLabel}</span>
          </div>
        </div>

        <!-- Fila de Ficha Técnica e Inventario -->
        <div style="font-size:10.5px; background:var(--slate-9); padding:6px 8px; border-radius:var(--radius-sm); border:1px solid var(--slate-8); display:flex; flex-direction:column; gap:4px;">
          ${textoSugerido ? `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
              <span style="color:var(--slate-5); font-weight:700;">Ficha (VIN):</span>
              <span style="font-weight:700; color:#1e40af; text-align:right; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${textoSugerido}">${textoSugerido}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <span style="color:var(--slate-5); font-weight:700;">Almacén:</span>
            <span>${inventoryStatusHtml}</span>
          </div>
        </div>

        <!-- Botones de Acción Flexible -->
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn-sug-item" onclick="prellenarCostoForm('${c.key}', 'mano_obra', '${escapedSugerido}')" style="flex:1; font-size:10px; padding:6px 4px; display:flex; justify-content:center; align-items:center; gap:4px; border:1px solid var(--slate-7); background:#f8fafc; color:var(--dark); font-weight:700; border-radius:6px; cursor:pointer; transition:all 0.1s ease;">
            🛠️ Labor
          </button>
          
          ${matched ? `
            <button type="button" class="btn-sug-item" onclick="prellenarCostoForm('${c.key}', 'almacen', '${escapedSugerido}')" style="flex:1; font-size:10px; padding:6px 4px; display:flex; justify-content:center; align-items:center; gap:4px; border:1px solid #c084fc; background:#faf5ff; color:#7c3aed; font-weight:700; border-radius:6px; cursor:pointer; transition:all 0.1s ease;">
              📦 Almacén
            </button>
          ` : `
            <button type="button" class="btn-sug-item" disabled style="flex:1; font-size:10px; padding:6px 4px; display:flex; justify-content:center; align-items:center; gap:4px; border:1px solid var(--slate-8); background:var(--slate-9); color:var(--slate-5); font-weight:700; border-radius:6px; cursor:not-allowed;" title="No catalogado en almacén">
              📦 Almacén
            </button>
          `}

          ${matched && matched.stock > 0 ? `
            <button type="button" class="btn-sug-item" onclick="quickAddRepuestoDirecto(${ordenId}, '${matched.codigo}')" style="flex:none; font-size:10px; padding:6px 8px; background:#10b981; color:#fff; border:none; font-weight:800; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:2px; transition:all 0.1s ease;" title="Agregar 1 unidad directamente a la orden">
              ⚡ Añadir
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  diagGrid.innerHTML = htmlList;
}

// Cargar repuesto del almacén directamente con 1 clic sin pasar por el formulario
window.quickAddRepuestoDirecto = async function(ordenId, codigoRepuesto) {
  const item = almacenList.find(p => p.codigo === codigoRepuesto);
  if (!item) return;
  if (item.stock <= 0) {
    alert('No hay stock disponible para este repuesto.');
    return;
  }
  try {
    const data = {
      tipo: 'almacen',
      descripcion: item.descripcion,
      cantidad: 1,
      precio_unitario: parseFloat(item.precio_venta),
      repuesto_cod: item.codigo
    };
    await addItem(ordenId, data);
    
    // Feedback visual
    const infoBox = document.getElementById('sug-feedback-msg') || (() => {
      const box = document.createElement('div');
      box.id = 'sug-feedback-msg';
      box.style.fontSize = '11px';
      box.style.fontWeight = '700';
      box.style.padding = '6px 10px';
      box.style.borderRadius = '4px';
      box.style.marginTop = '6px';
      box.style.marginBottom = '6px';
      const form = document.getElementById('form-agregar-costo');
      form.insertBefore(box, form.firstChild);
      return box;
    })();
    infoBox.className = 'vin-decode-result visible success';
    infoBox.style.display = 'block';
    infoBox.innerHTML = `✅ Agregado directamente a la cotización: <strong>${item.descripcion}</strong> (1 unidad · S/ ${parseFloat(item.precio_venta).toFixed(2)})`;

    // Recargar componentes en segundo plano
    await actualizarListasSegundoPlano();
    await refrescarVistaCostos(ordenId);
  } catch (err) {
    alert(err.message);
  }
};

// Actualizar las listas principales en segundo plano y refrescar la tabla del dashboard
async function actualizarListasSegundoPlano() {
  try {
    const [ord, veh, alm] = await Promise.all([
      getOrdenes(),
      getVehiculos(),
      getAlmacen()
    ]);
    ordenesList = ord;
    vehiculosList = veh;
    almacenList = alm;

    const tbody = document.getElementById('tabla-ordenes-body');
    if (tbody) {
      const filtradas = activeTab === 'process' 
        ? ordenesList.filter(o => o.estado === 'En Proceso' || o.estado === 'Esperando Repuestos' || o.estado === 'Diagnostico')
        : ordenesList;
      tbody.innerHTML = renderTableRows(filtradas);
    }
  } catch (err) {
    console.error('Error actualizando listas en segundo plano:', err);
  }
}

// Actualizar el selector de repuestos en el formulario sin re-renderizar todo
function actualizarDropdownRepuestos() {
  const select = document.getElementById('item-repuesto-select');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `
    <option value="">-- Seleccionar --</option>
    ${almacenList.map(p => `<option value="${p.codigo}" data-precio="${p.precio_venta}">${p.descripcion} (Stock: ${p.stock})</option>`).join('')}
  `;
  select.value = currentValue;
}

// Refrescar todos los componentes interactivos del modal de costos sin cerrarlo
async function refrescarVistaCostos(ordenId) {
  // 1. Cargar la tabla de items de la orden
  await cargarCostosItemsTable(ordenId);

  // 2. Volver a renderizar el panel de diagnóstico preventivo con la data fresca
  const o = ordenesList.find(item => item.id == ordenId);
  if (o) {
    const v = vehiculosList.find(x => x.placa === o.placa || x.id === o.vehiculo_id);
    renderDiagnosticoPreventivo(v, ordenId);
  }

  // 3. Actualizar la disponibilidad en el dropdown del almacén
  actualizarDropdownRepuestos();
}

// Configurar y prellenar formulario de costos según el método elegido
window.prellenarCostoForm = function(tipoComponente, metodo, textoSugerido) {
  const tipoSelect = document.getElementById('item-tipo');
  const repSelect = document.getElementById('item-repuesto-select');
  const descManual = document.getElementById('item-desc-manual');
  const precioInput = document.getElementById('item-precio');
  const cantInput = document.getElementById('item-cantidad');

  const nameMap = {
    aceite: 'Reemplazo de Aceite Motor',
    frenos: 'Reemplazo de Pastillas de Freno',
    bujias: 'Reemplazo de Bujías de Encendido',
    filtros: 'Cambio de Filtros (Aire/Cabina)',
    liquido: 'Cambio de Líquido de Frenos',
    refrigerante: 'Reemplazo de Refrigerante / Coolant',
    distribucion: 'Reemplazo de Faja de Distribución'
  };

  const componentLabel = nameMap[tipoComponente] || 'Servicio General';

  const triggerFlash = (el) => {
    el.classList.add('flash-success');
    setTimeout(() => el.classList.remove('flash-success'), 1200);
  };

  const infoBox = document.getElementById('sug-feedback-msg') || (() => {
    const box = document.createElement('div');
    box.id = 'sug-feedback-msg';
    box.style.fontSize = '11px';
    box.style.fontWeight = '700';
    box.style.padding = '6px 10px';
    box.style.borderRadius = '4px';
    box.style.marginTop = '6px';
    box.style.marginBottom = '6px';
    const form = document.getElementById('form-agregar-costo');
    form.insertBefore(box, form.firstChild);
    return box;
  })();

  if (metodo === 'mano_obra') {
    tipoSelect.value = 'mano_obra';
    toggleTipoCostoForm();

    const descText = (textoSugerido && textoSugerido !== 'undefined' && textoSugerido !== '') 
      ? `${componentLabel} (Sugerido: ${textoSugerido})` 
      : componentLabel;
    descManual.value = descText;
    cantInput.value = 1;
    precioInput.value = '';

    triggerFlash(tipoSelect);
    triggerFlash(descManual);
    triggerFlash(precioInput);
    precioInput.focus();

    infoBox.className = 'vin-decode-result visible info';
    infoBox.style.display = 'block';
    infoBox.innerHTML = `🛠️ Cargado como <strong>Mano de Obra / Compra Externa</strong>. Escribe el precio de mano de obra y haz clic en agregar.`;
  } else if (metodo === 'almacen') {
    tipoSelect.value = 'almacen';
    toggleTipoCostoForm();

    const matched = buscarRepuestoEnAlmacen(tipoComponente, textoSugerido);

    if (matched) {
      repSelect.value = matched.codigo;
      precioInput.value = parseFloat(matched.precio_venta).toFixed(2);
      cantInput.value = 1;

      triggerFlash(tipoSelect);
      triggerFlash(repSelect);
      triggerFlash(precioInput);
      cantInput.focus();

      if (matched.stock > 0) {
        infoBox.className = 'vin-decode-result visible success';
        infoBox.style.display = 'block';
        infoBox.innerHTML = `📦 Encontrado en Almacén: <strong>${matched.descripcion}</strong> (Stock: ${matched.stock} · SKU: ${matched.codigo})`;
      } else {
        infoBox.className = 'vin-decode-result visible info';
        infoBox.style.display = 'block';
        const escapedText = (textoSugerido || '').replace(/'/g, "\\'");
        infoBox.innerHTML = `⚠️ Encontrado en Almacén pero <strong>SIN STOCK</strong> (Stock actual: 0). <a href="#" onclick="prellenarCostoForm('${tipoComponente}', 'mano_obra', '${escapedText}')" style="color:#7c3aed; text-decoration:underline; font-weight:800;">¿Deseas cambiar a Mano de Obra para cotización externa?</a>`;
      }
    } else {
      infoBox.className = 'vin-decode-result visible info';
      infoBox.style.display = 'block';
      const escapedText = (textoSugerido || '').replace(/'/g, "\\'");
      infoBox.innerHTML = `❌ No se encontró ningún repuesto compatible en el almacén. <a href="#" onclick="prellenarCostoForm('${tipoComponente}', 'mano_obra', '${escapedText}')" style="color:#7c3aed; text-decoration:underline; font-weight:800;">Haz clic aquí para cotizar como Mano de Obra (Insumo Externo)</a>.`;
    }
  }
};

async function abrirModalCostos(id) {
  const o = ordenesList.find(item => item.id == id);
  if (!o) return;

  document.getElementById('costos-orden-id').value = o.id;
  document.getElementById('item-tipo').value = 'mano_obra';
  toggleTipoCostoForm();
  
  // Ocultar feedback previo si lo hay
  const fb = document.getElementById('sug-feedback-msg');
  if (fb) fb.style.display = 'none';

  // Buscar vehículo para sugerir insumos y diagnóstico
  const v = vehiculosList.find(x => x.placa === o.placa || x.id === o.vehiculo_id);
  renderDiagnosticoPreventivo(v, o.id);

  await cargarCostosItemsTable(o.id);
  document.getElementById('modal-costos').classList.add('active');
}

// Mantener compatibilidad con llamadas legacy
window.sugerirConsumible = function(tipo, texto) {
  window.prellenarCostoForm(tipo, 'almacen', texto);
};


async function cargarCostosItemsTable(ordenId) {
  const o = await getOrden(ordenId);
  const tbody = document.getElementById('tabla-costos-items-body');
  
  if (o.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">No hay insumos ni servicios asociados.</td></tr>`;
  } else {
    tbody.innerHTML = o.items.map(it => `
      <tr>
        <td><strong>${it.descripcion}</strong>${it.repuesto_cod ? `<div style="font-size:9px;color:var(--slate-5);font-family:monospace;">SKU: ${it.repuesto_cod}</div>` : ''}</td>
        <td><span class="badge ${it.tipo === 'almacen' ? 'badge-purple' : 'badge-slate'}">${it.tipo === 'almacen' ? 'Repuesto' : 'Mano Obra'}</span></td>
        <td class="text-center font-bold">${it.cantidad}</td>
        <td class="text-right font-mono">S/ ${parseFloat(it.precio_unitario).toFixed(2)}</td>
        <td class="text-right font-mono font-bold">S/ ${(it.cantidad * parseFloat(it.precio_unitario)).toFixed(2)}</td>
        <td class="text-right">
          <button class="btn-icon btn-delete-item" data-item-id="${it.id}" style="color:#ef4444;" title="Quitar">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>
    `).join('');

    // Listener para eliminar concepto en segundo plano
    tbody.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('¿Quitar este concepto de la orden?')) return;
        try {
          await deleteItem(ordenId, btn.dataset.itemId);
          await actualizarListasSegundoPlano();
          await refrescarVistaCostos(ordenId);
        } catch (err) {
          alert(err.message);
        }
      };
    });
  }
}

function toggleTipoCostoForm() {
  const tipo = document.getElementById('item-tipo').value;
  const wrpManual = document.getElementById('wrapper-item-manual');
  const wrpAlmacen = document.getElementById('wrapper-item-almacen');
  const inputManual = document.getElementById('item-desc-manual');
  const selectRepuesto = document.getElementById('item-repuesto-select');
  const priceInput = document.getElementById('item-precio');

  if (tipo === 'almacen') {
    wrpManual.classList.add('hidden');
    wrpAlmacen.classList.remove('hidden');
    inputManual.required = false;
    selectRepuesto.required = true;
    
    // Auto asignar precio al cambiar repuesto
    selectRepuesto.onchange = () => {
      const opt = selectRepuesto.options[selectRepuesto.selectedIndex];
      if (opt && opt.dataset.precio) {
        priceInput.value = parseFloat(opt.dataset.precio).toFixed(2);
      }
    };
  } else {
    wrpManual.classList.remove('hidden');
    wrpAlmacen.classList.add('hidden');
    inputManual.required = true;
    selectRepuesto.required = false;
    selectRepuesto.value = '';
    selectRepuesto.onchange = null;
    priceInput.value = '';
  }
}

async function guardarCostoItem(e) {
  e.preventDefault();
  const ordenId = document.getElementById('costos-orden-id').value;
  const tipo = document.getElementById('item-tipo').value;
  const cantidad = parseInt(document.getElementById('item-cantidad').value) || 1;
  const precio_unitario = parseFloat(document.getElementById('item-precio').value) || 0;
  
  let descripcion = '';
  let repuesto_cod = null;

  if (tipo === 'almacen') {
    const select = document.getElementById('item-repuesto-select');
    const opt = select.options[select.selectedIndex];
    if (!opt.value) return;

    descripcion = opt.text.split('(Stock:')[0].trim();
    repuesto_cod = opt.value;

    const rep = almacenList.find(p => p.codigo === repuesto_cod);
    if (rep && cantidad > rep.stock) {
      alert(`No hay suficiente stock en almacén para este repuesto (Stock actual: ${rep.stock} unidades).`);
      return;
    }
  } else {
    descripcion = document.getElementById('item-desc-manual').value.trim();
  }

  try {
    await addItem(ordenId, { tipo, descripcion, cantidad, precio_unitario, repuesto_cod });
    document.getElementById('item-desc-manual').value = '';
    document.getElementById('item-repuesto-select').value = '';
    document.getElementById('item-precio').value = '';
    document.getElementById('item-cantidad').value = 1;
    
    await actualizarListasSegundoPlano();
    await refrescarVistaCostos(ordenId);

  } catch (err) {
    alert(err.message);
  }
}

function cerrarModalCostos() {
  document.getElementById('modal-costos').classList.remove('active');
}

// ──────────────────────────────────────────────────────────
// IMPRESIÓN (REQUERIMIENTO AÑADIR.txt)
// ──────────────────────────────────────────────────────────

function imprimirDocumento(tipo, o) {
  const printArea = document.getElementById('print-area');
  
  const dateFormatted = new Date(o.created_at || new Date()).toLocaleDateString('es-PE', { day:'numeric', month:'long', year:'numeric' });
  const itemsHtml = o.items.map(it => `
    <tr>
      <td>${it.descripcion} ${it.repuesto_cod ? `[${it.repuesto_cod}]` : ''}</td>
      <td style="text-align:center;">${it.tipo === 'almacen' ? 'Repuesto' : 'Mano Obra'}</td>
      <td style="text-align:center;">${it.cantidad}</td>
      ${tipo === 'nota' ? `<td style="text-align:right;">S/ ${parseFloat(it.precio_unitario).toFixed(2)}</td>` : ''}
      ${tipo === 'nota' ? `<td style="text-align:right;">S/ ${(it.cantidad * parseFloat(it.precio_unitario)).toFixed(2)}</td>` : ''}
    </tr>
  `).join('');

  if (tipo === 'nota') {
    // 🎫 Ticket Cliente (Nota Interna de Entrega de Vehículo)
    printArea.innerHTML = `
      <div class="print-header">
        <h2 style="margin:0;text-transform:uppercase;letter-spacing:1px;font-size:18px;">Inversiones y Soluciones Vargas</h2>
        <p style="margin:4px 0 0;font-size:11px;">RUC: 20512345678 | Av. Taller Vargas 123, Lima</p>
        <h3 style="margin:15px 0 0;text-transform:uppercase;font-size:14px;border-top:1px dashed #000;padding-top:10px;">Nota Interna de Entrega</h3>
      </div>

      <div style="font-size:12px;line-height:1.5;">
        <p><strong>N° Expediente:</strong> OS-${o.id}</p>
        <p><strong>Fecha Emisión:</strong> ${dateFormatted}</p>
        <p><strong>Cliente / Razón Social:</strong> ${o.cliente}</p>
        <p><strong>Unidad Vehicular:</strong> ${o.vehiculo} (Placa: <strong style="font-family:monospace;">${o.placa}</strong>)</p>
        <p><strong>Kilometraje Recepción:</strong> ${o.kilometraje.toLocaleString()} Km</p>
      </div>

      <h4 style="margin:20px 0 5px;text-transform:uppercase;font-size:12px;border-bottom:1px solid #000;padding-bottom:2px;">Trabajos y Repuestos Detallados</h4>
      <table class="print-table" style="font-size:11px;">
        <thead>
          <tr>
            <th>Concepto / Producto</th>
            <th style="text-align:center;">Tipo</th>
            <th style="text-align:center;">Cant.</th>
            <th style="text-align:right;">Unit.</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="5" style="text-align:center;">No se registraron costos asociados.</td></tr>'}
        </tbody>
      </table>

      <div style="text-align:right;margin-top:15px;font-size:14px;font-weight:bold;border-top:1px double #000;padding-top:8px;">
        TOTAL ESTIMADO: S/ ${parseFloat(o.total_estimado || 0).toFixed(2)}
      </div>

      <div style="font-size:10px;margin-top:30px;text-align:center;border-top:1px dashed #000;padding-top:10px;">
        <p>El vehículo se entrega a conformidad en sus componentes mecánicos y de carrocería reportados.</p>
        <p style="margin-top:5px;font-weight:bold;">¡Gracias por su confianza en Taller Vargas!</p>
      </div>

      <div class="print-signatures" style="margin-top:60px;">
        <div class="signature-box">Firma del Taller Vargas</div>
        <div class="signature-box">Firma de Conformidad Cliente</div>
      </div>
    `;
  } else {
    // 🖨️ Hoja Técnica de Taller (Orden de Servicio)
    printArea.innerHTML = `
      <div class="print-header">
        <h2 style="margin:0;text-transform:uppercase;font-size:16px;">Hoja de Taller - Orden de Servicio</h2>
        <p style="margin:4px 0 0;font-size:11px;font-weight:bold;">TALLER VARGAS ERP - MÓDULO OPERATIVO</p>
        <h3 style="margin:12px 0 0;font-size:13px;border-top:1px solid #000;padding-top:8px;">ORDEN DE SERVICIO #OS-${o.id}</h3>
      </div>

      <div style="font-size:11px;line-height:1.6;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <p><strong>Unidad Vehicular:</strong> ${o.vehiculo}</p>
          <p><strong>Placa del Auto:</strong> ${o.placa}</p>
          <p><strong>Kilometraje Ingreso:</strong> ${o.kilometraje.toLocaleString()} Km</p>
          <p><strong>Nivel de Combustible:</strong> ${o.nivel_combustible}</p>
        </div>
        <div>
          <p><strong>Propietario / Cliente:</strong> ${o.cliente}</p>
          <p><strong>Mecánico Asignado:</strong> ${o.mecanico || '—'}</p>
          <p><strong>Fecha Recepción:</strong> ${dateFormatted}</p>
          <p><strong>Estado Actual:</strong> ${o.estado}</p>
        </div>
      </div>

      <div style="margin-top:15px;border:1px solid #000;padding:10px;border-radius:4px;font-size:11px;">
        <strong>SÍNTOMAS Y DIAGNÓSTICO REPORTADO (FALLA):</strong>
        <p style="margin-top:5px;font-style:italic;white-space:pre-line;">${o.falla_reportada || 'Ninguno indicado'}</p>
      </div>

      <h4 style="margin:20px 0 5px;text-transform:uppercase;font-size:11px;border-bottom:1px solid #000;padding-bottom:2px;">Lista de Tareas e Insumos Solicitados</h4>
      <table class="print-table" style="font-size:11px;">
        <thead>
          <tr>
            <th>Concepto / Repuesto</th>
            <th style="text-align:center;">Tipo de Trabajo</th>
            <th style="text-align:center;">Cantidad Requerida</th>
          </tr>
        </thead>
        <tbody>
          ${o.items.map(it => `
            <tr>
              <td>${it.descripcion} ${it.repuesto_cod ? `[${it.repuesto_cod}]` : ''}</td>
              <td style="text-align:center;">${it.tipo === 'almacen' ? 'Insumo Taller' : 'Mano de Obra'}</td>
              <td style="text-align:center;font-weight:bold;">${it.cantidad}</td>
            </tr>
          `).join('') || '<tr><td colspan="3" style="text-align:center;">No se han listado insumos de almacén.</td></tr>'}
        </tbody>
      </table>

      ${o.estado === 'Esperando Repuestos' && o.repuestos_esperando ? `
        <div style="margin-top:15px;background:#f1f5f9;border:1px solid #cbd5e1;padding:8px;font-size:11px;">
          <strong>PENDIENTES POR COMPRAR / EN ESPERA:</strong>
          <p style="margin-top:3px;font-style:italic;">${o.repuestos_esperando}</p>
        </div>
      ` : ''}

      <div style="margin-top:20px;border:1px solid #000;padding:12px;font-size:10px;">
        <strong>OBSERVACIONES Y NOTAS TÉCNICAS DEL MECÁNICO:</strong>
        <div style="height:80px;"></div>
      </div>

      <div class="print-signatures" style="margin-top:60px;">
        <div class="signature-box">Firma Mecánico Responsable</div>
        <div class="signature-box">Firma Control de Calidad Taller</div>
      </div>
    `;
  }

  // Ejecutar impresión del navegador
  window.print();
}

export function destroy() {}
