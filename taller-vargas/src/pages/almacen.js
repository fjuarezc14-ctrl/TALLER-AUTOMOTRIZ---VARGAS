import { 
  getAlmacen, getAlmacenMecanico, createProducto, updateProducto, 
  deleteProducto, ajustarStock, getMecanicos, crearSolicitudMecanico,
  getSolicitudesMecanico
} from '../api.js';

let containerElement = null;
let activeTab = 'admin'; // 'admin' o 'mecanico' o 'solicitudes'
let productosAdmin = [];
let productosMecanico = [];
let mecanicosList = [];
let solicitudesList = [];

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="almacen-root"></div>`;
  
  await cargarDatos();
}

async function cargarDatos() {
  const root = document.getElementById('almacen-root');
  root.innerHTML = `
    <div class="flex items-center justify-center" style="height:200px;">
      <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;

  try {
    const [pAdmin, pMec, mecs, sols] = await Promise.all([
      getAlmacen(),
      getAlmacenMecanico(),
      getMecanicos(),
      getSolicitudesMecanico()
    ]);
    
    productosAdmin = pAdmin;
    productosMecanico = pMec;
    mecanicosList = mecs;
    solicitudesList = sols;

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
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar almacén</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

function renderPage() {
  const root = document.getElementById('almacen-root');

  const dateStr = new Date().toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' });

  // Calcular estadísticas para admin
  const totalItems = productosAdmin.length;
  const stockBajoCount = productosAdmin.filter(p => p.stock <= p.stock_min).length;
  const valorInventario = productosAdmin.reduce((acc, p) => acc + (p.stock * parseFloat(p.costo || 0)), 0);

  root.innerHTML = `
    <!-- Header -->
    <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Almacén y Repuestos</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Control de inventario, stock crítico y solicitudes de taller.</p>
      </div>
      <div class="flex gap-2" style="background:var(--slate-8);padding:4px;border-radius:10px;align-items:center;">
        ${activeTab === 'admin' ? `
          <button class="btn-primary" id="btn-nuevo-producto-header" style="font-size:12px;padding:6px 12px;white-space:nowrap;margin-right:4px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
            Nuevo Producto
          </button>
        ` : ''}
        <div class="flex gap-1" style="background:rgba(255,255,255,0.4);padding:2px;border-radius:8px;">
          <button class="btn-tab ${activeTab === 'admin' ? 'active-tab' : ''}" id="tab-admin" style="font-size:12px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">Administración</button>
          <button class="btn-tab ${activeTab === 'mecanico' ? 'active-tab' : ''}" id="tab-mecanico" style="font-size:12px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">Uso de Mecánicos</button>
          <button class="btn-tab ${activeTab === 'solicitudes' ? 'active-tab' : ''}" id="tab-solicitudes" style="font-size:12px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">Historial Retiros</button>
        </div>
      </div>
    </div>

    <!-- Contenido dinámico según Tab -->
    <div id="tab-content-root" class="fade-in">
      ${activeTab === 'admin' ? renderAdminView(totalItems, stockBajoCount, valorInventario) : activeTab === 'mecanico' ? renderMecanicoView() : renderSolicitudesView()}
    </div>

    <!-- Modales -->
    ${renderModales()}
  `;

  // Estilo CSS local para pestañas activas
  const style = document.createElement('style');
  style.innerHTML = `
    .btn-tab { color: var(--slate-5); transition: all .15s; }
    .btn-tab:hover { color: var(--dark); }
    .btn-tab.active-tab { background: var(--white) !important; color: var(--dark) !important; box-shadow: var(--shadow-sm); }
  `;
  root.appendChild(style);

  // Registrar eventos principales
  document.getElementById('tab-admin').addEventListener('click', () => { activeTab = 'admin'; renderPage(); });
  document.getElementById('tab-mecanico').addEventListener('click', () => { activeTab = 'mecanico'; renderPage(); });
  document.getElementById('tab-solicitudes').addEventListener('click', () => { activeTab = 'solicitudes'; renderPage(); });

  if (activeTab === 'admin') {
    document.getElementById('search-almacen').addEventListener('input', filtrarAlmacen);
    const btnNew = document.getElementById('btn-nuevo-producto-header');
    if (btnNew) btnNew.addEventListener('click', () => abrirModalProducto());
    document.getElementById('btn-close-prod-x').addEventListener('click', cerrarModalProducto);
    document.getElementById('btn-close-prod-cancel').addEventListener('click', cerrarModalProducto);
    document.getElementById('form-producto').addEventListener('submit', guardarProducto);

    document.getElementById('btn-close-stock-x').addEventListener('click', cerrarModalStock);
    document.getElementById('btn-retirar-stock').addEventListener('click', () => ajustarStockRapido('restar'));
    document.getElementById('btn-ingresar-stock').addEventListener('click', () => ajustarStockRapido('sumar'));

    // Escuchar clicks dinámicos en la tabla admin
    document.getElementById('tabla-almacen-body').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-prod');
      const stockBtn = e.target.closest('.btn-adjust-stock');
      const delBtn = e.target.closest('.btn-delete-prod');

      if (editBtn) abrirModalProducto(editBtn.dataset.id);
      else if (stockBtn) abrirModalStock(stockBtn.dataset.id);
      else if (delBtn) eliminarProd(delBtn.dataset.id);
    });
  } else if (activeTab === 'mecanico') {
    document.getElementById('search-mecanico').addEventListener('input', filtrarMecanico);
    document.getElementById('form-solicitud-mecanico').addEventListener('submit', guardarSolicitudMecanico);
  }
}

// ──────────────────────────────────────────────────────────
// VISTAS
// ──────────────────────────────────────────────────────────

function renderAdminView(total, bajo, valor) {
  return `
    <!-- Stats Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));">
      <div class="stat-card flex items-center gap-4">
        <div style="padding:10px;background:#eff6ff;border-radius:12px;color:#1d4ed8;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div>
          <p style="font-size:11px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Total Ítems</p>
          <p style="font-size:20px;font-weight:900;color:var(--dark);margin-top:2px;">${total}</p>
        </div>
      </div>
      <div class="stat-card flex items-center gap-4">
        <div style="padding:10px;background:#fef3c7;border-radius:12px;color:#b45309;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        </div>
        <div>
          <p style="font-size:11px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Stock Bajo Mínimo</p>
          <p style="font-size:20px;font-weight:900;color:var(--dark);margin-top:2px;">${bajo}</p>
        </div>
      </div>
      <div class="stat-card flex items-center gap-4">
        <div style="padding:10px;background:#d1fae5;border-radius:12px;color:#065f46;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
        </div>
        <div>
          <p style="font-size:11px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Valor Inventario (Costo)</p>
          <p style="font-size:20px;font-weight:900;color:var(--dark);margin-top:2px;font-family:monospace;">S/ ${valor.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div class="mb-4 flex justify-end">
      <input type="text" id="search-almacen" placeholder="Buscar por código o descripción..." class="form-input" style="width:280px;" />
    </div>

    <!-- Table Card -->
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th class="text-center">Stock</th>
              <th class="text-right">Costo Unit.</th>
              <th class="text-right">Precio Venta</th>
              <th class="text-center">Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-almacen-body">
            ${renderAdminTableRows(productosAdmin)}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMecanicoView() {
  return `
    <div class="grid gap-6" style="grid-template-columns: 1fr 340px;align-items:flex-start;">
      <!-- Listado de Insumos sin precios -->
      <div class="card">
        <div class="card-header flex justify-between items-center" style="padding:14px 20px;">
          <span class="card-title">Inventario General (Uso de Taller)</span>
          <input type="text" id="search-mecanico" placeholder="Buscar repuesto..." class="form-input" style="width:200px;padding:6px 12px;font-size:12px;" />
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th class="text-center">Stock Disponible</th>
                <th class="text-center">Estado</th>
              </tr>
            </thead>
            <tbody id="tabla-mecanicos-body">
              ${renderMecanicoTableRows(productosMecanico)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Formulario Retiro Taller -->
      <div class="card">
        <div class="card-header"><span class="card-title">Registrar Retiro de Insumos</span></div>
        <form id="form-solicitud-mecanico" style="padding:20px;display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label class="form-label">Mecánico Responsable</label>
            <select id="sol-mecanico-id" class="form-select" required>
              <option value="">-- Seleccionar Mecánico --</option>
              ${mecanicosList.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Insumo a Retirar</label>
            <select id="sol-producto-id" class="form-select" required>
              <option value="">-- Seleccionar Repuesto --</option>
              ${productosMecanico.map(p => `<option value="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.descripcion} (${p.stock} disp.)</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label class="form-label">Cantidad</label>
              <input type="number" id="sol-cantidad" min="1" value="1" class="form-input text-center font-bold" required />
            </div>
            <div class="form-group">
              <label class="form-label">Fecha Entrega Trab.</label>
              <input type="date" id="sol-fecha-entrega" class="form-input" required />
            </div>
          </div>

          <button type="submit" class="btn-success w-full" style="justify-content:center;margin-top:10px;">
            Confirmar Retiro
          </button>
        </form>
      </div>
    </div>
  `;
}

function renderSolicitudesView() {
  return `
    <div class="card">
      <div class="card-header"><span class="card-title">Historial de Repuestos Entregados a Taller</span></div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha Retiro</th>
              <th>Mecánico</th>
              <th>Repuesto / Insumo</th>
              <th class="text-center">Cantidad</th>
              <th>Fecha Est. Entrega Trabajo</th>
            </tr>
          </thead>
          <tbody>
            ${solicitudesList.length === 0
              ? `<tr><td colspan="5" class="td-empty">No se han registrado retiros en el sistema</td></tr>`
              : solicitudesList.map(s => `
                <tr>
                  <td>${new Date(s.fecha_solicitud).toLocaleDateString('es-PE')}</td>
                  <td><strong>${s.mecanico_nombre}</strong></td>
                  <td>
                    <span class="font-mono text-slate-500">[${s.producto_codigo}]</span>
                    <strong>${s.producto_desc}</strong>
                  </td>
                  <td class="text-center font-bold">${s.cantidad}</td>
                  <td>${new Date(s.fecha_entrega_trabajo).toLocaleDateString('es-PE')}</td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────
// ELEMENTOS DE TABLA
// ──────────────────────────────────────────────────────────

function renderAdminTableRows(productos) {
  if (productos.length === 0) {
    return `<tr><td colspan="8" class="td-empty">No se encontraron productos</td></tr>`;
  }

  return productos.map(p => {
    const alerta = p.stock <= p.stock_min;
    return `
      <tr>
        <td class="font-mono font-bold">${p.codigo}</td>
        <td><strong>${p.descripcion}</strong></td>
        <td><span style="font-size:11px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">${p.categoria}</span></td>
        <td class="text-center font-bold ${alerta ? 'text-red' : ''}" style="${alerta ? 'color:#dc2626;' : ''}">${p.stock}</td>
        <td class="text-right font-mono">S/ ${parseFloat(p.costo || 0).toFixed(2)}</td>
        <td class="text-right font-mono font-bold" style="color:var(--brand);">S/ ${parseFloat(p.precio_venta || 0).toFixed(2)}</td>
        <td class="text-center">
          <span class="badge ${alerta ? 'badge-red' : 'badge-emerald'}">${alerta ? 'Stock Bajo' : 'Normal'}</span>
        </td>
        <td class="text-right">
          <div class="flex justify-end gap-2">
            <button class="btn-icon btn-adjust-stock" data-id="${p.id}" title="Ajuste de Stock">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 4v16m8-8H4"/></svg>
            </button>
            <button class="btn-icon btn-edit-prod" data-id="${p.id}" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="btn-icon btn-delete-prod" data-id="${p.id}" title="Eliminar" style="color:#ef4444;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderMecanicoTableRows(productos) {
  if (productos.length === 0) {
    return `<tr><td colspan="5" class="td-empty">No se encontraron productos</td></tr>`;
  }

  return productos.map(p => {
    const alerta = p.stock <= p.stock_min;
    return `
      <tr>
        <td class="font-mono font-bold">${p.codigo}</td>
        <td><strong>${p.descripcion}</strong></td>
        <td><span style="font-size:11px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">${p.categoria}</span></td>
        <td class="text-center font-bold ${alerta ? 'text-red' : ''}" style="${alerta ? 'color:#dc2626;' : ''}">${p.stock}</td>
        <td class="text-center">
          <span class="badge ${alerta ? 'badge-red' : 'badge-emerald'}">${alerta ? 'Stock Bajo' : 'Normal'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// ──────────────────────────────────────────────────────────
// FILTROS
// ──────────────────────────────────────────────────────────

function filtrarAlmacen() {
  const q = document.getElementById('search-almacen').value.toLowerCase().trim();
  const filtrados = productosAdmin.filter(p => 
    p.codigo.toLowerCase().includes(q) || 
    p.descripcion.toLowerCase().includes(q)
  );
  document.getElementById('tabla-almacen-body').innerHTML = renderAdminTableRows(filtrados);
}

function filtrarMecanico() {
  const q = document.getElementById('search-mecanico').value.toLowerCase().trim();
  const filtrados = productosMecanico.filter(p => 
    p.codigo.toLowerCase().includes(q) || 
    p.descripcion.toLowerCase().includes(q)
  );
  document.getElementById('tabla-mecanicos-body').innerHTML = renderMecanicoTableRows(filtrados);
}

// ──────────────────────────────────────────────────────────
// MODALES Y ACCIONES
// ──────────────────────────────────────────────────────────

function renderModales() {
  return `
    <!-- Modal Nuevo / Editar Producto -->
    <div id="modal-producto" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <span class="modal-title" id="modal-prod-titulo">Nuevo Producto</span>
          </div>
          <button class="modal-close" id="btn-close-prod-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-producto">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
            <input type="hidden" id="prod-id" />
            
            <div class="form-section-title">Información General</div>
            <div class="grid grid-cols-2 gap-3">
              <div class="form-group">
                <label class="form-label">Código (SKU)</label>
                <input type="text" id="prod-codigo" class="form-input font-mono uppercase font-bold" required placeholder="Ej: REP-001" />
              </div>
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select id="prod-categoria" class="form-select" required>
                  <option value="Lubricantes">Lubricantes</option>
                  <option value="Frenos">Frenos</option>
                  <option value="Filtros">Filtros</option>
                  <option value="Suspensión">Suspensión</option>
                  <option value="Eléctrico">Eléctrico</option>
                  <option value="Insumos Taller">Insumos Taller</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Descripción</label>
              <input type="text" id="prod-descripcion" class="form-input" required placeholder="Ej: Aceite Sintético Castrol 10W40" />
            </div>

            <div class="form-section-title" style="margin-top:8px;">Control e Importes</div>
            <div class="grid grid-cols-4 gap-2">
              <div class="form-group">
                <label class="form-label">Stock Act.</label>
                <input type="number" id="prod-stock" min="0" class="form-input text-center" required value="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Stock Mín.</label>
                <input type="number" id="prod-stock-min" min="0" class="form-input text-center" required value="2" />
              </div>
              <div class="form-group">
                <label class="form-label">Costo (S/)</label>
                <input type="number" id="prod-costo" step="0.01" min="0" class="form-input font-mono text-right" required placeholder="0.00" />
              </div>
              <div class="form-group">
                <label class="form-label">P. Venta (S/)</label>
                <input type="number" id="prod-precio-venta" step="0.01" min="0" class="form-input font-mono text-right font-bold" style="color:var(--brand);" required placeholder="0.00" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-prod-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-prod">Guardar Producto</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Ajuste de Stock -->
    <div id="modal-stock" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 4v16m8-8H4"/></svg>
            </div>
            <span class="modal-title">Ajuste de Stock</span>
          </div>
          <button class="modal-close" id="btn-close-stock-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;text-align:center;">
          <input type="hidden" id="ajuste-id" />
          <div style="background:var(--slate-9);padding:12px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
            <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Producto</p>
            <p id="ajuste-desc" style="font-weight:800;color:var(--dark);margin-top:2px;font-size:13px;"></p>
            <p id="ajuste-codigo" style="font-family:monospace;font-size:11px;color:var(--brand);margin-top:2px;"></p>
          </div>

          <div style="margin:8px 0;">
            <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Stock Actual</p>
            <p id="ajuste-actual" style="font-size:24px;font-weight:900;color:var(--dark);"></p>
          </div>

          <div class="form-group" style="align-items:center;">
            <label class="form-label">Cantidad a ajustar</label>
            <input type="number" id="ajuste-cantidad" min="1" value="1" class="form-input text-center" style="width:120px;font-size:16px;font-weight:700;" />
          </div>

          <div class="grid grid-cols-2 gap-3" style="margin-top:8px;">
            <button class="btn-danger flex justify-center py-2" id="btn-retirar-stock" style="font-weight:700;border-radius:var(--radius-sm);cursor:pointer;border:none;">
              Retirar
            </button>
            <button class="btn-success flex justify-center py-2" id="btn-ingresar-stock" style="font-weight:700;border-radius:var(--radius-sm);cursor:pointer;border:none;">
              Ingresar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function abrirModalProducto(id = null) {
  const modal = document.getElementById('modal-producto');
  const form = document.getElementById('form-producto');
  form.reset();

  const title = document.getElementById('modal-prod-titulo');
  const btn = document.getElementById('btn-save-prod');

  if (id) {
    const p = productosAdmin.find(item => item.id == id);
    if (!p) return;

    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-codigo').value = p.codigo;
    document.getElementById('prod-codigo').readOnly = true;
    document.getElementById('prod-categoria').value = p.categoria;
    document.getElementById('prod-descripcion').value = p.descripcion;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-stock-min').value = p.stock_min;
    document.getElementById('prod-costo').value = p.costo;
    document.getElementById('prod-precio-venta').value = p.precio_venta;

    title.textContent = 'Editar Producto';
    btn.textContent = 'Actualizar Producto';
  } else {
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-codigo').readOnly = false;
    title.textContent = 'Nuevo Producto';
    btn.textContent = 'Guardar Producto';
  }

  modal.classList.add('active');
}

function cerrarModalProducto() {
  document.getElementById('modal-producto').classList.remove('active');
}

async function guardarProducto(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const data = {
    codigo: document.getElementById('prod-codigo').value.trim().toUpperCase(),
    categoria: document.getElementById('prod-categoria').value,
    descripcion: document.getElementById('prod-descripcion').value.trim(),
    stock: parseInt(document.getElementById('prod-stock').value) || 0,
    stock_min: parseInt(document.getElementById('prod-stock-min').value) || 0,
    costo: parseFloat(document.getElementById('prod-costo').value) || 0,
    precio_venta: parseFloat(document.getElementById('prod-precio-venta').value) || 0
  };

  try {
    if (id) {
      await updateProducto(id, data);
    } else {
      await createProducto(data);
    }
    cerrarModalProducto();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

function abrirModalStock(id) {
  const p = productosAdmin.find(item => item.id == id);
  if (!p) return;

  document.getElementById('ajuste-id').value = p.id;
  document.getElementById('ajuste-desc').textContent = p.descripcion;
  document.getElementById('ajuste-codigo').textContent = p.codigo;
  document.getElementById('ajuste-actual').textContent = p.stock;
  document.getElementById('ajuste-cantidad').value = 1;

  document.getElementById('modal-stock').classList.add('active');
}

function cerrarModalStock() {
  document.getElementById('modal-stock').classList.remove('active');
}

async function ajustarStockRapido(accion) {
  const id = document.getElementById('ajuste-id').value;
  const cantidad = parseInt(document.getElementById('ajuste-cantidad').value) || 0;
  if (cantidad <= 0) return;

  try {
    await ajustarStock(id, { 
      tipo_ajuste: accion === 'sumar' ? 'ingresar' : 'retirar', 
      cantidad 
    });
    cerrarModalStock();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

async function eliminarProd(id) {
  if (!confirm('¿Está seguro de eliminar este producto?')) return;
  try {
    await deleteProducto(id);
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

async function guardarSolicitudMecanico(e) {
  e.preventDefault();
  const data = {
    mecanico_id: parseInt(document.getElementById('sol-mecanico-id').value),
    producto_id: parseInt(document.getElementById('sol-producto-id').value),
    cantidad: parseInt(document.getElementById('sol-cantidad').value) || 1,
    fecha_entrega_trabajo: document.getElementById('sol-fecha-entrega').value
  };

  const prodSelected = productosMecanico.find(p => p.id == data.producto_id);
  if (prodSelected && data.cantidad > prodSelected.stock) {
    alert(`No puedes retirar más del stock disponible (${prodSelected.stock} unidades).`);
    return;
  }

  try {
    await crearSolicitudMecanico(data);
    alert('Retiro registrado correctamente. El stock ha sido descontado.');
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

export function destroy() {}
