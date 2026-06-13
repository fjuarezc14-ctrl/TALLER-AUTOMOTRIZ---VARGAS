import { 
  getAlmacen, getAlmacenMecanico, createProducto, updateProducto, 
  deleteProducto, ajustarStock, getMecanicos, crearSolicitudMecanico,
  getSolicitudesMecanico
} from '../api.js';

function safeFormatDate(dateVal, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!dateVal) return '—';
  let parsedDate;
  if (typeof dateVal === 'string') {
    if (dateVal.includes('T')) {
      parsedDate = new Date(dateVal);
    } else {
      parsedDate = new Date(dateVal + 'T12:00:00');
    }
  } else {
    parsedDate = new Date(dateVal);
  }
  if (isNaN(parsedDate.getTime())) {
    parsedDate = new Date(dateVal);
    if (isNaN(parsedDate.getTime())) return '—';
  }
  return parsedDate.toLocaleDateString('es-PE', options);
}

let containerElement = null;
let activeTab = 'admin'; // 'admin' | 'mecanico' | 'solicitudes'
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
      <div class="flex flex-col items-center gap-3">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p style="font-size:13px;color:var(--slate-5);font-weight:600;">Cargando inventario...</p>
      </div>
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
    if (window.refreshStockAlerts) window.refreshStockAlerts();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

function renderError(msg) {
  return `
    <div style="max-width:500px;margin:60px auto;background:var(--white);border-radius:var(--radius-lg);padding:40px;text-align:center;box-shadow:var(--shadow-md);border:1px solid var(--slate-8);">
      <div style="width:64px;height:64px;background:#fef2f2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;border:2px solid #fecaca;">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#dc2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <p style="font-size:18px;font-weight:900;color:var(--dark);margin-bottom:8px;">Error al cargar almacén</p>
      <p style="font-size:12px;color:var(--slate-5);margin-bottom:24px;font-family:monospace;background:var(--slate-9);padding:8px 12px;border-radius:6px;border:1px solid var(--slate-8);">${msg}</p>
      <button class="btn-primary" onclick="location.reload()">🔄 Reintentar</button>
    </div>`;
}

function renderPage() {
  const root = document.getElementById('almacen-root');

  const totalItems = productosAdmin.length;
  const stockCritico = productosAdmin.filter(p => p.stock === 0).length;
  const stockBajo = productosAdmin.filter(p => p.stock > 0 && p.stock <= p.stock_min).length;
  const valorInventario = productosAdmin.reduce((acc, p) => acc + (p.stock * parseFloat(p.costo || 0)), 0);
  const valorVenta = productosAdmin.reduce((acc, p) => acc + (p.stock * parseFloat(p.precio_venta || 0)), 0);
  const alertasTotal = stockCritico + stockBajo;

  root.innerHTML = `
    <!-- Header con Gradiente -->
    <div class="flex justify-between items-start mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <div class="flex items-center gap-3" style="margin-bottom:4px;">
          <div style="width:40px;height:40px;background:linear-gradient(135deg,#10b981,#047857);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          </div>
          <div>
            <h1 style="font-size:22px;font-weight:900;color:var(--dark);letter-spacing:-.5px;line-height:1;">Almacén & Repuestos</h1>
            <p style="font-size:12px;color:var(--slate-5);margin-top:1px;">Control de inventario, stock crítico y retiros de taller</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${activeTab === 'admin' ? `
          <button class="btn-primary" id="btn-nuevo-producto-header" style="font-size:12px;padding:8px 14px;display:flex;align-items:center;gap:6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
            Nuevo Producto
          </button>
        ` : ''}
        <div style="background:var(--slate-8);padding:4px;border-radius:10px;display:flex;gap:2px;">
          <button class="btn-tab ${activeTab === 'admin' ? 'active-tab' : ''}" id="tab-admin" style="font-size:11px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">
            📦 Administración
          </button>
          <button class="btn-tab ${activeTab === 'mecanico' ? 'active-tab' : ''}" id="tab-mecanico" style="font-size:11px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">
            🔧 Retiro Taller
          </button>
          <button class="btn-tab ${activeTab === 'solicitudes' ? 'active-tab' : ''}" id="tab-solicitudes" style="font-size:11px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">
            📋 Historial${alertasTotal > 0 ? ` <span style="background:#ef4444;color:#fff;border-radius:99px;font-size:9px;padding:1px 5px;margin-left:3px;">${alertasTotal}</span>` : ''}
          </button>
        </div>
      </div>
    </div>

    <!-- Contenido dinámico -->
    <div id="tab-content-root" class="fade-in">
      ${activeTab === 'admin' 
        ? renderAdminView(totalItems, stockBajo, stockCritico, valorInventario, valorVenta)
        : activeTab === 'mecanico' 
          ? renderMecanicoView() 
          : renderSolicitudesView()}
    </div>

    <!-- Modales -->
    ${renderModales()}
  `;

  // CSS local
  const style = document.createElement('style');
  style.innerHTML = `
    .btn-tab { color: var(--slate-5); transition: all .15s; }
    .btn-tab:hover { color: var(--dark); background: rgba(255,255,255,0.5) !important; }
    .btn-tab.active-tab { background: var(--white) !important; color: var(--dark) !important; box-shadow: var(--shadow-sm); }
    .stock-bar-wrap { height: 4px; background: var(--slate-8); border-radius: 99px; overflow: hidden; margin-top: 4px; }
    .stock-bar-fill { height: 100%; border-radius: 99px; transition: width .5s ease; }
    .prod-row:hover { background: #f8fafc; }
    .badge-agotado { background:#fef2f2;color:#dc2626;border:1px solid #fecaca; animation: pulse-badge 1.5s ease-in-out infinite alternate; }
    .badge-bajo { background:#fffbeb;color:#b45309;border:1px solid #fde68a; }
    .badge-normal { background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0; }
    @keyframes pulse-badge { from { opacity: 0.7; } to { opacity: 1; } }
    .stat-kpi { background:var(--white);border:1px solid var(--slate-8);border-radius:var(--radius-md);padding:16px 20px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow-sm);transition:transform 0.15s ease; }
    .stat-kpi:hover { transform:translateY(-2px); }
    .retiro-card { background:var(--white);border:1px solid var(--slate-7);border-radius:var(--radius-md);padding:14px;transition:all 0.15s; }
    .retiro-card:hover { border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.08); }
  `;
  root.appendChild(style);

  // Eventos de tabs
  document.getElementById('tab-admin').addEventListener('click', () => { activeTab = 'admin'; renderPage(); });
  document.getElementById('tab-mecanico').addEventListener('click', () => { activeTab = 'mecanico'; renderPage(); });
  document.getElementById('tab-solicitudes').addEventListener('click', () => { activeTab = 'solicitudes'; renderPage(); });

  if (activeTab === 'admin') {
    const btnNew = document.getElementById('btn-nuevo-producto-header');
    if (btnNew) btnNew.addEventListener('click', () => abrirModalProducto());
    document.getElementById('search-almacen').addEventListener('input', filtrarAlmacen);
    document.getElementById('btn-close-prod-x').addEventListener('click', cerrarModalProducto);
    document.getElementById('btn-close-prod-cancel').addEventListener('click', cerrarModalProducto);
    document.getElementById('form-producto').addEventListener('submit', guardarProducto);
    document.getElementById('btn-close-stock-x').addEventListener('click', cerrarModalStock);
    document.getElementById('btn-retirar-stock').addEventListener('click', () => ajustarStockRapido('restar'));
    document.getElementById('btn-ingresar-stock').addEventListener('click', () => ajustarStockRapido('sumar'));
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

// ── VISTAS ────────────────────────────────────────────────

function renderAdminView(total, bajo, critico, valorCosto, valorVenta) {
  const margenTotal = valorVenta - valorCosto;
  return `
    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:24px;">
      <div class="stat-kpi">
        <div style="width:44px;height:44px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Total Ítems</p>
          <p style="font-size:22px;font-weight:900;color:var(--dark);line-height:1.1;margin-top:2px;">${total}</p>
          <p style="font-size:10px;color:var(--slate-5);">SKUs registrados</p>
        </div>
      </div>
      <div class="stat-kpi" style="${critico > 0 ? 'border-color:#fecaca;' : ''}">
        <div style="width:44px;height:44px;background:${critico > 0 ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : 'linear-gradient(135deg,#fef3c7,#fde68a)'};border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="${critico > 0 ? '#dc2626' : '#b45309'}" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Alertas de Stock</p>
          <p style="font-size:22px;font-weight:900;color:${critico > 0 ? '#dc2626' : '#b45309'};line-height:1.1;margin-top:2px;">${critico + bajo}</p>
          <p style="font-size:10px;color:var(--slate-5);">${critico} agotados · ${bajo} bajos</p>
        </div>
      </div>
      <div class="stat-kpi">
        <div style="width:44px;height:44px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#15803d" stroke-width="2"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Valor en Stock (Costo)</p>
          <p style="font-size:18px;font-weight:900;color:var(--dark);line-height:1.1;margin-top:2px;font-family:monospace;">S/ ${valorCosto.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
          <p style="font-size:10px;color:#15803d;font-weight:700;">Venta: S/ ${valorVenta.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
        </div>
      </div>
      <div class="stat-kpi" style="border-color:#c084fc;">
        <div style="width:44px;height:44px;background:linear-gradient(135deg,#faf5ff,#ede9fe);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Margen Potencial</p>
          <p style="font-size:18px;font-weight:900;color:#7c3aed;line-height:1.1;margin-top:2px;font-family:monospace;">S/ ${margenTotal.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
          <p style="font-size:10px;color:var(--slate-5);">Si se vende todo el stock</p>
        </div>
      </div>
    </div>

    <!-- Buscador -->
    <div class="flex justify-between items-center mb-4" style="flex-wrap:wrap;gap:10px;">
      <span style="font-size:12px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">
        ${productosAdmin.length} producto${productosAdmin.length !== 1 ? 's' : ''} en inventario
      </span>
      <input type="text" id="search-almacen" placeholder="🔍 Buscar por código o descripción..." class="form-input" style="width:290px;font-size:12px;" />
    </div>

    <!-- Tabla -->
    <div class="card" style="overflow:hidden;">
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:12px;">
          <thead>
            <tr>
              <th style="width:100px;">Código</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th class="text-center" style="width:140px;">Stock / Nivel</th>
              <th class="text-right">Costo</th>
              <th class="text-right">P. Venta</th>
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
    <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:flex-start;">
      <!-- Listado de Insumos -->
      <div class="card" style="overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--slate-8);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:14px;font-weight:800;color:var(--dark);">Inventario Disponible en Taller</span>
            <p style="font-size:11px;color:var(--slate-5);margin-top:1px;">Solo se muestran ítems con stock disponible · Precios restringidos</p>
          </div>
          <input type="text" id="search-mecanico" placeholder="Buscar repuesto..." class="form-input" style="width:200px;font-size:12px;padding:7px 12px;" />
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>Código</th>
                <th>Repuesto / Insumo</th>
                <th>Categoría</th>
                <th class="text-center">Disponible</th>
                <th class="text-center">Estado</th>
              </tr>
            </thead>
            <tbody id="tabla-mecanicos-body">
              ${renderMecanicoTableRows(productosMecanico)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Panel de Retiro -->
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="card" style="overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:16px 20px;">
            <div class="flex items-center gap-3">
              <div style="width:36px;height:36px;background:rgba(255,255,255,0.12);border-radius:10px;display:flex;align-items:center;justify-content:center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              </div>
              <div>
                <span style="font-size:13px;font-weight:800;color:white;display:block;">Registrar Retiro de Insumos</span>
                <span style="font-size:10px;color:rgba(255,255,255,0.6);">El stock se descuenta de inmediato</span>
              </div>
            </div>
          </div>
          <form id="form-solicitud-mecanico" style="padding:20px;display:flex;flex-direction:column;gap:14px;">
            <div class="form-group">
              <label class="form-label">Mecánico Responsable</label>
              <select id="sol-mecanico-id" class="form-select" required>
                <option value="">-- Seleccionar Mecánico --</option>
                ${mecanicosList.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Repuesto / Insumo a Retirar</label>
              <select id="sol-producto-id" class="form-select" required>
                <option value="">-- Seleccionar Repuesto --</option>
                ${productosMecanico.map(p => `<option value="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.descripcion} (${p.stock} disp.)</option>`).join('')}
              </select>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Cantidad</label>
                <input type="number" id="sol-cantidad" min="1" value="1" class="form-input text-center font-bold" required />
              </div>
              <div class="form-group">
                <label class="form-label">Fecha Est. Trabajo</label>
                <input type="date" id="sol-fecha-entrega" class="form-input" required />
              </div>
            </div>

            <button type="submit" class="btn-success w-full" style="justify-content:center;padding:10px;font-size:13px;margin-top:4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;"><path d="M5 13l4 4L19 7"/></svg>
              Confirmar Retiro de Stock
            </button>
          </form>
        </div>

        <!-- Info card -->
        <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px 14px;border-radius:var(--radius-md);">
          <p style="font-size:11px;font-weight:800;color:#1e40af;margin-bottom:4px;">ℹ️ ¿Cuándo usar esta sección?</p>
          <p style="font-size:11px;color:#1e40af;line-height:1.5;">Utiliza esta vista cuando el mecánico necesita retirar físicamente un repuesto del almacén para usarlo en una reparación del taller que NO está vinculada a una orden de servicio. Si hay una OS abierta, prefiere agregar el repuesto directamente desde la sección de Costos de la orden.</p>
        </div>
      </div>
    </div>
  `;
}

function renderSolicitudesView() {
  if (solicitudesList.length === 0) {
    return `
      <div style="text-align:center;padding:80px 20px;background:var(--white);border-radius:var(--radius-lg);border:1px dashed var(--slate-7);">
        <div style="font-size:48px;margin-bottom:16px;">📋</div>
        <p style="font-size:16px;font-weight:800;color:var(--dark);margin-bottom:8px;">Sin historial de retiros</p>
        <p style="font-size:13px;color:var(--slate-5);">Cuando un mecánico registre un retiro de insumos, aparecerá aquí.</p>
      </div>`;
  }

  return `
    <div class="card" style="overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--slate-8);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:14px;font-weight:800;color:var(--dark);">Historial de Retiros de Almacén</span>
          <p style="font-size:11px;color:var(--slate-5);margin-top:1px;">${solicitudesList.length} retiro${solicitudesList.length !== 1 ? 's' : ''} registrado${solicitudesList.length !== 1 ? 's' : ''}</p>
        </div>
        <span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;font-size:10px;font-weight:800;padding:4px 10px;border-radius:99px;">CONFIRMADOS</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:12px;">
          <thead>
            <tr>
              <th>Fecha Retiro</th>
              <th>Mecánico</th>
              <th>Repuesto / Insumo</th>
              <th class="text-center">Cant.</th>
              <th>OS Vinculada</th>
              <th>Fecha Est. Trabajo</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${solicitudesList.map(s => {
              const fechaRetiro = safeFormatDate(s.created_at, { day: '2-digit', month: 'short', year: 'numeric' });
              const fechaEntrega = safeFormatDate(s.fecha_entrega, { day: '2-digit', month: 'short', year: 'numeric' });
              return `
                <tr class="prod-row">
                  <td style="color:var(--slate-5);font-size:11px;">${fechaRetiro}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:28px;height:28px;background:linear-gradient(135deg,#1e293b,#475569);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span style="color:white;font-size:11px;font-weight:800;">${(s.mecanico_nombre || '?')[0]}</span>
                      </div>
                      <strong>${s.mecanico_nombre || '—'}</strong>
                    </div>
                  </td>
                  <td>
                    <strong style="display:block;">${s.repuesto_desc || '—'}</strong>
                    <span style="font-family:monospace;font-size:10px;color:var(--brand);">[${s.repuesto_cod || '—'}]</span>
                  </td>
                  <td class="text-center">
                    <span style="background:#1e293b;color:white;font-weight:800;padding:3px 10px;border-radius:99px;font-size:11px;">${s.cantidad}</span>
                  </td>
                  <td>
                    ${s.orden_numero 
                      ? `<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:10px;font-weight:800;padding:3px 8px;border-radius:99px;font-family:monospace;">OS-${String(s.orden_numero).padStart(4, '0')}</span>` 
                      : `<span style="color:var(--slate-5);font-style:italic;font-size:11px;">Retiro directo</span>`}
                  </td>
                  <td style="color:var(--slate-5);font-size:11px;">${fechaEntrega}</td>
                  <td class="text-center">
                    <span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;">✓ Entregado</span>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── FILAS DE TABLA ────────────────────────────────────────

function renderAdminTableRows(productos) {
  if (productos.length === 0) {
    return `<tr><td colspan="7" class="td-empty">No se encontraron productos en el inventario</td></tr>`;
  }

  return productos.map(p => {
    const agotado = p.stock === 0;
    const bajo = !agotado && p.stock <= p.stock_min;
    const pct = p.stock_min > 0 ? Math.min(100, Math.round((p.stock / (p.stock_min * 2)) * 100)) : 100;
    const barColor = agotado ? '#ef4444' : bajo ? '#f59e0b' : '#10b981';
    const badgeClass = agotado ? 'badge-agotado' : bajo ? 'badge-bajo' : 'badge-normal';
    const badgeLabel = agotado ? '⚠️ Agotado' : bajo ? '↓ Stock Bajo' : '✓ Normal';
    const margen = parseFloat(p.precio_venta || 0) - parseFloat(p.costo || 0);

    return `
      <tr class="prod-row">
        <td class="font-mono" style="font-weight:800;color:var(--brand);letter-spacing:.5px;">${p.codigo}</td>
        <td>
          <strong style="display:block;color:var(--dark);">${p.descripcion}</strong>
          <span style="font-size:10px;color:var(--slate-5);">Margen: S/ ${margen.toFixed(2)}</span>
        </td>
        <td>
          <span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;background:var(--slate-9);padding:3px 8px;border-radius:99px;border:1px solid var(--slate-8);">${p.categoria}</span>
        </td>
        <td class="text-center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:16px;font-weight:900;color:${agotado ? '#dc2626' : bajo ? '#b45309' : 'var(--dark)'};">${p.stock}</span>
            <div class="stock-bar-wrap" style="width:80px;">
              <div class="stock-bar-fill" style="width:${pct}%;background:${barColor};"></div>
            </div>
            <span style="font-size:9px;color:var(--slate-5);">mín: ${p.stock_min}</span>
          </div>
        </td>
        <td class="text-right font-mono" style="color:var(--slate-5);">S/ ${parseFloat(p.costo || 0).toFixed(2)}</td>
        <td class="text-right font-mono font-bold" style="color:var(--brand);">S/ ${parseFloat(p.precio_venta || 0).toFixed(2)}</td>
        <td class="text-right">
          <div class="flex justify-end gap-1">
            <button class="btn-icon btn-adjust-stock" data-id="${p.id}" title="Ajustar Stock" style="color:#10b981;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 4v16m8-8H4"/></svg>
            </button>
            <button class="btn-icon btn-edit-prod" data-id="${p.id}" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="btn-icon btn-delete-prod" data-id="${p.id}" title="Eliminar" style="color:#ef4444;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderMecanicoTableRows(productos) {
  if (productos.length === 0) {
    return `<tr><td colspan="5" class="td-empty">No hay repuestos disponibles en stock</td></tr>`;
  }
  return productos.map(p => {
    const bajo = p.stock <= p.stock_min;
    return `
      <tr class="prod-row">
        <td class="font-mono font-bold" style="color:var(--brand);">${p.codigo}</td>
        <td><strong>${p.descripcion}</strong></td>
        <td><span style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">${p.categoria}</span></td>
        <td class="text-center">
          <span style="font-size:15px;font-weight:900;color:${bajo ? '#b45309' : 'var(--dark)'};">${p.stock}</span>
        </td>
        <td class="text-center">
          <span class="badge ${bajo ? 'badge-bajo' : 'badge-normal'}" style="font-size:10px;">${bajo ? '↓ Bajo' : '✓ OK'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// ── FILTROS ────────────────────────────────────────────────

function filtrarAlmacen() {
  const q = document.getElementById('search-almacen').value.toLowerCase().trim();
  const filtrados = productosAdmin.filter(p =>
    p.codigo.toLowerCase().includes(q) ||
    p.descripcion.toLowerCase().includes(q) ||
    p.categoria.toLowerCase().includes(q)
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

// ── MODALES ────────────────────────────────────────────────

function renderModales() {
  const CATEGORIAS = ['Lubricantes', 'Frenos', 'Filtros', 'Suspensión', 'Eléctrico', 'Insumos Taller', 'Refrigeración', 'Encendido', 'Dirección', 'Carrocería', 'Otros'];
  return `
    <!-- Modal Nuevo / Editar Producto -->
    <div id="modal-producto" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
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

            <div class="form-section-title">Identificación del Producto</div>
            <div class="grid grid-cols-2 gap-3">
              <div class="form-group">
                <label class="form-label">Código SKU</label>
                <input type="text" id="prod-codigo" class="form-input font-mono uppercase font-bold" required placeholder="Ej: REP-010" />
              </div>
              <div class="form-group">
                <label class="form-label">Categoría</label>
                <select id="prod-categoria" class="form-select" required>
                  ${CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Descripción Completa</label>
              <input type="text" id="prod-descripcion" class="form-input" required placeholder="Ej: Aceite Sintético Castrol 10W40 (Galón)" />
            </div>

            <div class="form-section-title" style="margin-top:4px;">Control de Stock e Importes</div>
            <div class="grid grid-cols-4 gap-2">
              <div class="form-group">
                <label class="form-label">Stock Inicial</label>
                <input type="number" id="prod-stock" min="0" class="form-input text-center font-bold" required value="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Stock Mínimo</label>
                <input type="number" id="prod-stock-min" min="0" class="form-input text-center" required value="2" />
              </div>
              <div class="form-group">
                <label class="form-label">Costo (S/)</label>
                <input type="number" id="prod-costo" step="0.01" min="0" class="form-input font-mono text-right" required placeholder="0.00" />
              </div>
              <div class="form-group">
                <label class="form-label">P. Venta (S/)</label>
                <input type="number" id="prod-precio-venta" step="0.01" min="0" class="form-input font-mono text-right font-bold" required placeholder="0.00" style="color:var(--brand);" />
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
            <span class="modal-title">Ajuste Rápido de Stock</span>
          </div>
          <button class="modal-close" id="btn-close-stock-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
          <input type="hidden" id="ajuste-id" />

          <div style="background:var(--slate-9);padding:14px;border-radius:var(--radius-md);border:1px solid var(--slate-8);text-align:center;">
            <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Producto</p>
            <p id="ajuste-desc" style="font-weight:800;color:var(--dark);margin-top:4px;font-size:14px;"></p>
            <p id="ajuste-codigo" style="font-family:monospace;font-size:11px;color:var(--brand);margin-top:2px;"></p>
          </div>

          <div style="text-align:center;">
            <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Stock Actual</p>
            <p id="ajuste-actual" style="font-size:36px;font-weight:900;color:var(--dark);line-height:1.1;margin-top:4px;"></p>
            <p style="font-size:11px;color:var(--slate-5);">unidades en inventario</p>
          </div>

          <div class="form-group" style="align-items:center;text-align:center;">
            <label class="form-label">Cantidad a Ajustar</label>
            <input type="number" id="ajuste-cantidad" min="1" value="1" class="form-input text-center" style="width:130px;font-size:20px;font-weight:800;margin:0 auto;" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
            <button class="btn-danger" id="btn-retirar-stock" style="justify-content:center;padding:10px;font-weight:800;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><path d="M20 12H4"/></svg>
              Retirar
            </button>
            <button class="btn-success" id="btn-ingresar-stock" style="justify-content:center;padding:10px;font-weight:800;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><path d="M12 4v16m8-8H4"/></svg>
              Ingresar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── LÓGICA DE MODALES ─────────────────────────────────────

function abrirModalProducto(id = null) {
  const form = document.getElementById('form-producto');
  const title = document.getElementById('modal-prod-titulo');
  const btn = document.getElementById('btn-save-prod');
  const codigoInput = document.getElementById('prod-codigo');
  form.reset();

  if (id) {
    const p = productosAdmin.find(item => item.id == id);
    if (!p) return;
    document.getElementById('prod-id').value = p.id;
    codigoInput.value = p.codigo;
    codigoInput.readOnly = true;
    codigoInput.style.opacity = '0.6';
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
    codigoInput.readOnly = false;
    codigoInput.style.opacity = '1';
    title.textContent = 'Nuevo Producto';
    btn.textContent = 'Guardar Producto';
  }
  document.getElementById('modal-producto').classList.add('active');
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

async function ajustarStockRapido(operacion) {
  const id = document.getElementById('ajuste-id').value;
  const cantidad = parseInt(document.getElementById('ajuste-cantidad').value) || 0;
  if (cantidad <= 0) { alert('Ingresa una cantidad válida.'); return; }
  try {
    // FIX: usa "operacion: 'sumar'|'restar'" — lo que espera el backend
    await ajustarStock(id, { operacion, cantidad });
    cerrarModalStock();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

async function eliminarProd(id) {
  if (!confirm('¿Está seguro de eliminar este producto del inventario? Esta acción no se puede deshacer.')) return;
  try {
    await deleteProducto(id);
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

async function guardarSolicitudMecanico(e) {
  e.preventDefault();
  const prodId = parseInt(document.getElementById('sol-producto-id').value);
  const cantidad = parseInt(document.getElementById('sol-cantidad').value) || 1;

  const prodSelected = productosMecanico.find(p => p.id === prodId);
  if (prodSelected && cantidad > prodSelected.stock) {
    alert(`No puedes retirar más del stock disponible (${prodSelected.stock} unidades).`);
    return;
  }

  // FIX: parámetros correctos que espera el backend
  const data = {
    mecanico_id: parseInt(document.getElementById('sol-mecanico-id').value),
    repuesto_id: prodId,                                          // FIX: era producto_id
    cantidad,
    fecha_entrega: document.getElementById('sol-fecha-entrega').value  // FIX: era fecha_entrega_trabajo
  };

  try {
    await crearSolicitudMecanico(data);
    // Reset form
    document.getElementById('form-solicitud-mecanico').reset();
    // Mensaje de éxito inline
    const btn = document.querySelector('#form-solicitud-mecanico button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '✅ ¡Retiro registrado! Stock actualizado';
    btn.style.background = '#059669';
    setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 2500);
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

export function destroy() {}
