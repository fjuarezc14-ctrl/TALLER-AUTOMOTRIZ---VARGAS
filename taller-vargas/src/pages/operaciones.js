import {
  getOrdenesActivas, cambiarEstado, getMecanicos,
  getMecanicosStats, createMecanico, updateMecanico, patchOrdenMecanico
} from '../api.js';
import * as TallerModule from './taller.js';
import { store } from '../store.js';


// ─────────────────────────────────────────────────────────────
// ESTADO LOCAL DEL MÓDULO
// ─────────────────────────────────────────────────────────────
let containerEl   = null;
let activeTab     = 'kanban';
let ordenesList   = [];
let mecanicosList = [];
let mecStats      = [];

const COLUMNAS_KANBAN = [
  {
    key: 'Diagnostico',
    label: '1. Diagnóstico',
    sublabel: 'Inspección y recepción',
    icon: '🔍',
    color: '#f59e0b',
    colorBg: '#fef3c7',
    colorBorder: '#f59e0b',
    filter: o => o.estado === 'Diagnostico'
  },
  {
    key: 'En Proceso',
    label: '2. En Taller / Reparación',
    sublabel: 'Activos y en espera de piezas',
    icon: '⚙️',
    color: '#3b82f6',
    colorBg: '#eff6ff',
    colorBorder: '#3b82f6',
    filter: o => o.estado === 'En Proceso' || o.estado === 'Esperando Repuestos'
  },
  {
    key: 'Finalizado',
    label: '3. Listo para Entrega',
    sublabel: 'Pendiente de cobro en Caja',
    icon: '✅',
    color: '#10b981',
    colorBg: '#d1fae5',
    colorBorder: '#10b981',
    filter: o => o.estado === 'Finalizado'
  }
];


// ─────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────
export async function init(container) {
  containerEl = container;
  
  // Controlar pestaña inicial según la ruta de entrada
  const path = window.location.pathname;
  if (path === '/taller') {
    activeTab = 'taller';
  } else if (activeTab === 'taller' && path === '/operaciones') {
    activeTab = 'kanban';
  }

  container.innerHTML = `<div class="fade-in" id="ops-root"></div>`;
  await cargarDatos();
}

export function destroy() {
  TallerModule.destroy();
  containerEl = null;
}

// ─────────────────────────────────────────────────────────────
// CARGA DE DATOS
// ─────────────────────────────────────────────────────────────
async function cargarDatos() {
  const root = document.getElementById('ops-root');
  root.innerHTML = `
    <div class="flex items-center justify-center" style="height:240px;">
      <div class="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>`;
  try {
    const [ords, mecs, stats] = await Promise.all([
      getOrdenesActivas(),
      getMecanicos(),
      getMecanicosStats(),
    ]);
    ordenesList   = ords;
    mecanicosList = mecs;
    mecStats      = stats;
    renderPage();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

function renderError(msg) {
  return `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <div style="padding:48px 24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar Operaciones</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// RENDER PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
function renderPage() {
  const root = document.getElementById('ops-root');
  if (!root) return;

  const esAdmin = window.isAdminAuthorized ? window.isAdminAuthorized() : false;
  if (!esAdmin && activeTab === 'equipo') {
    activeTab = 'kanban';
  }

  // KPI calculations
  const activas   = ordenesList.filter(o => o.estado !== 'Finalizado' && o.estado !== 'No realizo servicio');
  const mesActual = new Date().getMonth();
  const mesAnio   = new Date().getFullYear();
  const finalizadosMes = ordenesList.filter(o => {
    if (o.estado !== 'Finalizado') return false;
    const d = new Date(o.fecha_ingreso);
    return d.getMonth() === mesActual && d.getFullYear() === mesAnio;
  });
  const totalMes = ordenesList.filter(o => {
    const d = new Date(o.fecha_ingreso);
    return d.getMonth() === mesActual && d.getFullYear() === mesAnio;
  });
  const eficiencia = totalMes.length ? Math.round((finalizadosMes.length / totalMes.length) * 100) : 0;

  // Promedio estadía (días) para finalizados
  let diasProm = 0;
  const conFecha = ordenesList.filter(o => o.estado === 'Finalizado' && o.fecha_entrega && o.fecha_ingreso);
  if (conFecha.length) {
    const total = conFecha.reduce((acc, o) => {
      const diff = (new Date(o.fecha_entrega) - new Date(o.fecha_ingreso)) / 86400000;
      return acc + Math.max(0, diff);
    }, 0);
    diasProm = (total / conFecha.length).toFixed(1);
  }

  root.innerHTML = `
    <style>
      .ops-kpi-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px; margin-bottom:24px; }
      .ops-kpi {
        background:var(--white); border-radius:var(--radius-lg); padding:20px 22px;
        box-shadow:var(--shadow-sm); border:1px solid var(--slate-8); position:relative; overflow:hidden;
      }
      .ops-kpi::before {
        content:''; position:absolute; top:0; left:0; right:0; height:3px;
        background:var(--kpi-accent, var(--brand));
      }
      .ops-kpi-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.8px; color:var(--slate-5); margin-bottom:6px; }
      .ops-kpi-val   { font-size:30px; font-weight:900; color:var(--dark); line-height:1; }
      .ops-kpi-sub   { font-size:12px; color:var(--slate-5); margin-top:4px; }

      /* Tabs */
      .ops-tabs { display:flex; gap:4px; background:var(--slate-8); padding:4px; border-radius:10px; margin-bottom:24px; width:fit-content; }
      .ops-tab  { padding:7px 18px; border:none; background:transparent; font-weight:700; font-size:13px; cursor:pointer;
                  color:var(--slate-5); border-radius:7px; transition:all .15s; }
      .ops-tab.active { background:var(--white); color:var(--dark); box-shadow:var(--shadow-sm); }

      /* Kanban */
      /* Kanban de 3 Columnas */
      .kanban-board { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
      @media (max-width: 960px) { .kanban-board { grid-template-columns:repeat(2,1fr); } }
      @media (max-width: 620px) { .kanban-board { grid-template-columns:1fr; } }

      .kanban-col {
        background:var(--slate-9); border-radius:var(--radius-lg); padding:14px;
        border:1px solid var(--slate-8); min-height:300px;
      }
      .kanban-col-header {
        display:flex; align-items:center; gap:8px; margin-bottom:12px; padding-bottom:10px;
        border-bottom:2px solid; border-color:var(--col-border);
      }
      .kanban-col-title { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:var(--dark); }
      .kanban-col-count {
        margin-left:auto; background:var(--col-border); color:#fff;
        border-radius:99px; padding:2px 8px; font-size:11px; font-weight:800;
      }
      .kanban-card {
        background:var(--white); border-radius:var(--radius-md); padding:14px 14px 10px;
        box-shadow:var(--shadow-sm); border:1px solid var(--slate-8);
        margin-bottom:10px; position:relative; transition:transform .15s, box-shadow .15s;
      }
      .kanban-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
      .kanban-card-alerta { border-left:3px solid #ef4444; }
      .kanban-card-esperando-repuestos {
        border: 2px solid #a855f7 !important;
        box-shadow: 0 4px 14px rgba(168, 85, 247, 0.16) !important;
        background: #fdfaff !important;
      }
      .card-placa {

        display:inline-block; background:var(--dark); color:var(--brand);
        font-family:'Courier New',monospace; font-weight:900; font-size:12px;
        border-radius:5px; padding:2px 8px; letter-spacing:1px; margin-bottom:6px;
      }
      .card-vehiculo  { font-size:13px; font-weight:700; color:var(--dark); }
      .card-cliente   { font-size:12px; color:var(--slate-5); margin-bottom:6px; }
      .card-diagnostico { font-size:11px; color:var(--slate-4); font-style:italic; margin-bottom:8px;
                          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .card-dias-badge {
        font-size:10px; font-weight:700; border-radius:99px; padding:2px 7px;
        display:inline-block; margin-bottom:8px;
      }
      .dias-ok    { background:#d1fae5; color:#065f46; }
      .dias-warn  { background:#fef3c7; color:#92400e; }
      .dias-alert { background:#fee2e2; color:#991b1b; }

      .card-mec-row { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
      .card-mec-label { font-size:11px; color:var(--slate-5); }
      .card-mec-select { flex:1; font-size:11px; padding:3px 6px; border:1px solid var(--slate-7);
                          border-radius:6px; color:var(--dark); font-weight:600; background:var(--white); cursor:pointer; }
      .card-mec-select:focus { outline:none; border-color:var(--brand); }

      .card-actions { display:flex; gap:6px; justify-content:flex-end; }
      .btn-kanban-move {
        display:inline-flex; align-items:center; gap:4px; padding:4px 10px;
        border:none; border-radius:7px; font-size:11px; font-weight:700; cursor:pointer;
        transition:all .15s; color:var(--slate-4); background:var(--slate-8);
      }
      .btn-kanban-move:hover { background:var(--brand); color:var(--dark); }
      .btn-kanban-move:disabled { opacity:.4; cursor:not-allowed; }
      .btn-kanban-move.loading { opacity:.6; pointer-events:none; }

      /* Panel mecánicos */
      .mec-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
      .mec-card {
        background:var(--white); border-radius:var(--radius-lg); padding:20px;
        box-shadow:var(--shadow-sm); border:1px solid var(--slate-8);
      }
      .mec-card-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
      .mec-avatar {
        width:44px; height:44px; border-radius:12px; background:var(--dark);
        color:var(--brand); display:flex; align-items:center; justify-content:center;
        font-weight:900; font-size:15px; flex-shrink:0;
      }
      .mec-avatar.inactivo { background:var(--slate-7); color:var(--slate-5); }
      .mec-name { font-size:15px; font-weight:800; color:var(--dark); }
      .mec-status { font-size:11px; font-weight:700; color:var(--slate-5); text-transform:uppercase; letter-spacing:.5px; }
      .mec-stats-row { display:flex; gap:12px; margin-bottom:14px; }
      .mec-stat { flex:1; text-align:center; padding:8px 4px; background:var(--slate-9); border-radius:10px; }
      .mec-stat-val  { font-size:18px; font-weight:900; color:var(--dark); }
      .mec-stat-lbl  { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--slate-5); }
      .workload-bar  { height:6px; background:var(--slate-8); border-radius:99px; overflow:hidden; margin-bottom:14px; }
      .workload-fill { height:100%; background:var(--brand); border-radius:99px; transition:width .4s ease; }
      .workload-fill.red { background:#ef4444; }
      .workload-fill.amber { background:#f59e0b; }
      .mec-actions { display:flex; gap:8px; }

      .badge-activo   { background:#d1fae5; color:#065f46; padding:2px 9px; border-radius:99px; font-size:10px; font-weight:800; }
      .badge-inactivo { background:#fee2e2; color:#991b1b; padding:2px 9px; border-radius:99px; font-size:10px; font-weight:800; }

      /* Modal */
      .ops-modal-overlay {
        position:fixed; inset:0; background:rgba(15,23,42,.5); backdrop-filter:blur(4px);
        z-index:200; display:flex; align-items:center; justify-content:center;
      }
      .ops-modal {
        background:var(--white); border-radius:var(--radius-xl); padding:28px 32px;
        width:min(420px, 95vw); box-shadow:var(--shadow-lg);
        animation:fadeInUp .2s ease;
      }
      @keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      .ops-modal-title { font-size:18px; font-weight:900; color:var(--dark); margin-bottom:20px; }
    </style>

    <!-- Header -->
    <div class="flex items-center justify-between mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Taller y Operaciones</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Control en vivo del flujo de vehículos, gestión del equipo técnico y portal del mecánico.</p>
      </div>
      <button id="btn-refresh-ops" class="btn-ghost flex items-center gap-2" style="font-size:13px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Actualizar
      </button>
    </div>

    <!-- KPI Cards -->
    <div class="ops-kpi-grid">
      <div class="ops-kpi" style="--kpi-accent:#3b82f6;">
        <div class="ops-kpi-label">Bahías Activas</div>
        <div class="ops-kpi-val">${activas.length}</div>
        <div class="ops-kpi-sub">vehículos actualmente en taller</div>
      </div>
      <div class="ops-kpi" style="--kpi-accent:var(--brand);">
        <div class="ops-kpi-label">Mecánicos Activos</div>
        <div class="ops-kpi-val">${mecanicosList.length}</div>
        <div class="ops-kpi-sub">técnicos disponibles hoy</div>
      </div>
      <div class="ops-kpi" style="--kpi-accent:#8b5cf6;">
        <div class="ops-kpi-label">Eficiencia del Mes</div>
        <div class="ops-kpi-val">${eficiencia}<span style="font-size:18px;font-weight:600;color:var(--slate-5);">%</span></div>
        <div class="ops-kpi-sub">${finalizadosMes.length} de ${totalMes.length} órdenes completadas</div>
      </div>
      <div class="ops-kpi" style="--kpi-accent:#f59e0b;">
        <div class="ops-kpi-label">Estadía Promedio</div>
        <div class="ops-kpi-val">${diasProm}<span style="font-size:18px;font-weight:600;color:var(--slate-5);"> días</span></div>
        <div class="ops-kpi-sub">promedio de entrega por vehículo</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="ops-tabs" id="ops-tabs">
      <button class="ops-tab ${activeTab === 'kanban' ? 'active' : ''}" id="tab-kanban">
        📋 Tablero en Vivo
      </button>
      ${esAdmin ? `
      <button class="ops-tab ${activeTab === 'equipo' ? 'active' : ''}" id="tab-equipo">
        👷 Equipo de Mecánicos
      </button>
      ` : ''}
      <button class="ops-tab ${activeTab === 'taller' ? 'active' : ''}" id="tab-taller">
        🛠️ Portal Mecánico
      </button>
    </div>

    <!-- Contenido de tabs -->
    <div id="ops-tab-content"></div>

    <!-- Contenedor de modales -->
    <div id="ops-modales"></div>
  `;

  // Eventos tabs
  document.getElementById('tab-kanban')?.addEventListener('click', () => { activeTab = 'kanban'; renderTabContent(); activarTab(); });
  document.getElementById('tab-equipo')?.addEventListener('click', () => { activeTab = 'equipo'; renderTabContent(); activarTab(); });
  document.getElementById('tab-taller')?.addEventListener('click', () => { activeTab = 'taller'; renderTabContent(); activarTab(); });
  document.getElementById('btn-refresh-ops')?.addEventListener('click', () => cargarDatos());

  renderTabContent();
}

function activarTab() {
  document.querySelectorAll('.ops-tab').forEach(t => t.classList.remove('active'));
  let id = 'tab-kanban';
  if (activeTab === 'equipo') id = 'tab-equipo';
  else if (activeTab === 'taller') id = 'tab-taller';
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ─────────────────────────────────────────────────────────────
// RENDER DEL CONTENIDO DE TABS
// ─────────────────────────────────────────────────────────────
function renderTabContent() {
  const tabContent = document.getElementById('ops-tab-content');
  if (!tabContent) return;

  const esAdmin = window.isAdminAuthorized ? window.isAdminAuthorized() : false;
  if (activeTab === 'equipo' && !esAdmin) {
    activeTab = 'kanban';
    activarTab();
  }

  if (activeTab === 'kanban') {
    TallerModule.destroy();
    containerEl.classList.remove('modo-taller-wrapper');
    renderKanban(tabContent);
  } else if (activeTab === 'equipo') {
    TallerModule.destroy();
    containerEl.classList.remove('modo-taller-wrapper');
    renderEquipo(tabContent);
  } else if (activeTab === 'taller') {
    TallerModule.init(tabContent);
  }
}

// ─────────────────────────────────────────────────────────────
// KANBAN BOARD (3 Columnas de Flujo Continuo)
// ─────────────────────────────────────────────────────────────
function renderKanban(container) {
  // Filtrar sólo activos + finalizados pendientes (sin "No realizo servicio" y sin "Entregado")
  const ordenes = ordenesList.filter(o => o.estado !== 'No realizo servicio' && o.estado !== 'Entregado');

  const cols = COLUMNAS_KANBAN.map(col => {
    const items = ordenes.filter(col.filter);
    const itemsEnEspera = col.key === 'En Proceso' ? items.filter(o => o.estado === 'Esperando Repuestos' || Boolean(o.repuestos_esperando)).length : 0;
    return { col, items, itemsEnEspera };
  });

  container.innerHTML = `
    <div class="kanban-board" id="kanban-board">
      ${cols.map(({ col, items, itemsEnEspera }) => `
        <div class="kanban-col" style="--col-border:${col.colorBorder};">
          <div class="kanban-col-header" style="border-color:${col.colorBorder};">
            <span style="font-size:18px;">${col.icon}</span>
            <div>
              <span class="kanban-col-title" style="color:${col.color};">${col.label}</span>
              <span style="display:block;font-size:10px;color:var(--slate-5);font-weight:600;">${col.sublabel}</span>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
              ${itemsEnEspera > 0 ? `<span style="font-size:10px;font-weight:800;color:#7e22ce;background:#f3e8ff;padding:2px 7px;border-radius:12px;border:1px solid #d8b4fe;" title="Vehículos en espera de repuestos">📦 ${itemsEnEspera} piezas</span>` : ''}
              <span class="kanban-col-count" style="background:${col.color};">${items.length}</span>
            </div>
          </div>
          ${items.length === 0 ? `
            <div style="text-align:center;padding:32px 12px;color:var(--slate-6);font-size:12px;">
              <div style="font-size:28px;margin-bottom:6px;opacity:.4;">🅿</div>
              Bahía libre
            </div>` : items.map(o => renderKanbanCard(o, col)).join('')}
        </div>
      `).join('')}
    </div>
  `;

  // Delegar eventos de las tarjetas
  const board = document.getElementById('kanban-board');
  if (!board) return;

  // Cambio de mecánico inline
  board.addEventListener('change', async e => {
    const sel = e.target.closest('.card-mec-select');
    if (!sel) return;
    const ordenId = sel.dataset.ordenId;
    const mecId   = sel.value || null;
    sel.disabled = true;
    try {
      await patchOrdenMecanico(ordenId, mecId ? parseInt(mecId) : null);
      // Actualizar stats de mecánicos
      const stats = await getMecanicosStats();
      mecStats = stats;
      
      // Actualizar lista local
      const ord = ordenesList.find(o => o.id == ordenId);
      if (ord) {
        const mec = mecanicosList.find(m => m.id == mecId);
        ord.mecanico = mec ? mec.nombre : null;
        ord.mecanico_id = mecId ? parseInt(mecId) : null;
      }
      flashCard(ordenId, 'success');
    } catch {
      flashCard(ordenId, 'error');
    } finally {
      sel.disabled = false;
    }
  });

  // Manejador de acciones contextuales guiadas en tarjetas Kanban
  board.addEventListener('click', async e => {
    const actionBtn = e.target.closest('.btn-kanban-action');
    if (!actionBtn) return;

    const ordenId = actionBtn.dataset.ordenId;
    const action = actionBtn.dataset.action;
    const ord = ordenesList.find(o => o.id == ordenId);
    if (!ord) return;

    let nuevoEst = null;
    let extra = {};

    switch (action) {
      case 'iniciar':
        nuevoEst = 'En Proceso';
        break;

      case 'repuestos': {
        const motivo = prompt(
          '📦 ¿Qué repuestos se necesitan y quién se encarga de conseguirlos?\n\n' +
          'Ejemplo: "2 pastillas Bosch, pedido a Lima, llega el viernes"',
          ord.repuestos_esperando || ''
        );
        if (motivo === null) return;
        if (!motivo.trim()) {
          alert('Por favor ingrese el detalle de los repuestos necesarios.');
          return;
        }
        nuevoEst = 'Esperando Repuestos';
        extra.repuestos_esperando = motivo.trim();
        break;
      }

      case 'terminar':
        if (!confirm('¿Confirmar que el trabajo en el vehículo ha terminado?\n\nLa orden pasará a "Listo para Entrega" y se generará la cuenta por cobrar en Facturación.')) return;
        nuevoEst = 'Finalizado';
        extra.pasar_facturacion = true;
        break;

      case 'rep_listos':
        if (!confirm('¿Los repuestos ya llegaron al taller?\n\nLa orden continuará activa en taller para terminar los trabajos.')) return;
        nuevoEst = 'En Proceso';
        extra.repuestos_esperando = '';
        break;

      case 'volver_diag':
        nuevoEst = 'Diagnostico';
        break;

      case 'volver_proc':
        nuevoEst = 'En Proceso';
        break;

      case 'cobrar':
        if (window.navigate) {
          window.navigate(`/facturacion?cobrar=${ordenId}`);
        } else {
          window.location.href = `/facturacion?cobrar=${ordenId}`;
        }
        return;

      case 'reabrir':
        if (!confirm('¿Desea reabrir esta orden de servicio?\n\nVolverá al taller en estado "En Proceso".')) return;
        nuevoEst = 'En Proceso';
        break;
    }

    if (!nuevoEst) return;

    actionBtn.classList.add('loading');
    actionBtn.disabled = true;

    try {
      await cambiarEstado(ordenId, {
        estado: nuevoEst,
        repuestos_esperando: extra.repuestos_esperando !== undefined ? extra.repuestos_esperando : '',
        pasar_facturacion: extra.pasar_facturacion !== undefined ? extra.pasar_facturacion : (nuevoEst === 'Finalizado')
      });
      ord.estado = nuevoEst;
      if (extra.repuestos_esperando !== undefined) ord.repuestos_esperando = extra.repuestos_esperando;
      store.invalidate('all');
      renderTabContent();
    } catch (err) {
      alert(`⚠️ Error al cambiar estado: ${err.message}`);
      renderTabContent();
    }
  });
}

function renderKanbanCard(o, col) {
  const diasTranscurridos = Math.floor((Date.now() - new Date(o.fecha_ingreso)) / 86400000);
  let diasClase = 'dias-ok', diasLabel = `${diasTranscurridos}d`;
  if (diasTranscurridos > 7) { diasClase = 'dias-alert'; }
  else if (diasTranscurridos > 3) { diasClase = 'dias-warn'; }

  const estaEnEspera = o.estado === 'Esperando Repuestos' || Boolean(o.repuestos_esperando);
  const esCuelloBotella = diasTranscurridos > 3 && (o.estado === 'Diagnostico' || estaEnEspera);

  const optsSelect = mecanicosList.map(m => {
    const stat = mecStats.find(s => s.id === m.id);
    const count = stat ? stat.ordenes_activas : (typeof m.ordenes_activas === 'number' ? m.ordenes_activas : 0);
    let tag = '🟢 0';
    if (count > 0 && count <= 2) tag = `🟡 ${count}`;
    else if (count > 2) tag = `🔴 ${count}`;
    const isSelected = (o.mecanico_id && Number(o.mecanico_id) === Number(m.id)) || 
      (o.mecanico && o.mecanico.trim().toLowerCase() === (m.nombre || '').trim().toLowerCase());
    return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>${m.nombre} (${tag})</option>`;
  }).join('');

  const isAdmin = window.isAdminAuthorized && window.isAdminAuthorized();

  let actionsHtml = '';
  if (col.key === 'Diagnostico') {
    actionsHtml = `
      <div class="card-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="iniciar" style="flex:1;background:#0284c7;color:#fff;border:none;padding:7px 10px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
          🔧 Iniciar Reparación
        </button>
        <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="repuestos" style="background:#f5f3ff;border:1px solid #c084fc;color:#7c3aed;padding:7px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:3px;" title="Solicitar repuestos">
          📦 Pedir Piezas
        </button>
      </div>
    `;
  } else if (col.key === 'En Proceso') {
    if (estaEnEspera) {
      actionsHtml = `
        <div class="card-actions" style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;">
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="rep_listos" style="flex:2;background:#059669;color:#fff;border:none;padding:7px 10px;border-radius:5px;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 2px 5px rgba(5,150,105,0.25);">
            ✅ Repuestos Recibidos
          </button>
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="repuestos" style="background:#f5f3ff;border:1px solid #c084fc;color:#7c3aed;padding:7px 8px;border-radius:5px;font-size:11px;cursor:pointer;" title="Editar texto de repuestos">
            ✏️
          </button>
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="volver_diag" style="background:var(--slate-8);border:none;color:var(--slate-4);padding:7px 8px;border-radius:5px;font-size:11px;cursor:pointer;" title="Volver a Diagnóstico">
            ↩️
          </button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div class="card-actions" style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;">
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="terminar" style="flex:2;background:#059669;color:#fff;border:none;padding:7px 10px;border-radius:5px;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 1px 3px rgba(5,150,105,0.2);">
            🏁 Trabajo Terminado
          </button>
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="repuestos" style="background:#f5f3ff;border:1px solid #c084fc;color:#7c3aed;padding:7px 8px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:3px;" title="Solicitar repuestos">
            📦 Solicitar Repuestos
          </button>
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="volver_diag" style="background:var(--slate-8);border:none;color:var(--slate-4);padding:7px 8px;border-radius:5px;font-size:11px;cursor:pointer;" title="Volver a Diagnóstico">
            ↩️
          </button>
        </div>
      `;
    }
  } else if (col.key === 'Finalizado') {
    if (isAdmin) {
      actionsHtml = `
        <div class="card-actions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="cobrar" style="flex:1;background:#10b981;color:#fff;border:none;padding:7px 10px;border-radius:5px;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
            💳 Cobrar en Caja
          </button>
          <button class="btn-kanban-action" data-orden-id="${o.id}" data-action="reabrir" style="background:var(--slate-8);border:none;color:var(--slate-4);padding:7px 8px;border-radius:5px;font-size:11px;cursor:pointer;" title="Reabrir al taller">
            ↩️
          </button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div style="margin-top:8px;padding:6px;background:#fef3c7;border:1px solid #fde68a;border-radius:5px;font-size:11px;font-weight:700;color:#92400e;text-align:center;">
          ⏳ Pendiente de cobro en caja
        </div>
      `;
    }
  }

  const cardClasses = [
    'kanban-card',
    esCuelloBotella ? 'kanban-card-alerta' : '',
    estaEnEspera ? 'kanban-card-esperando-repuestos' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="${cardClasses}" id="kcard-${o.id}">
      <span class="card-placa">${o.placa || '—'}</span>
      ${esCuelloBotella ? `<span style="float:right;font-size:16px;" title="Cuello de botella: más de 3 días">⚠️</span>` : ''}
      <div class="card-vehiculo">${o.vehiculo || '—'}</div>
      <div class="card-cliente">👤 ${o.cliente || '—'}</div>
      <div class="card-diagnostico">${o.falla_reportada || 'Sin diagnóstico'}</div>
      <span class="card-dias-badge ${diasClase}">⏱ ${diasLabel} en taller</span>

      ${estaEnEspera ? `
        <div style="background:#f3e8ff;border:1px solid #d8b4fe;border-radius:6px;padding:7px 10px;margin:8px 0;display:flex;flex-direction:column;gap:3px;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:13px;">📦</span>
            <strong style="font-size:10px;text-transform:uppercase;color:#7e22ce;letter-spacing:0.4px;">En Espera de Repuestos:</strong>
          </div>
          <span style="font-size:11px;color:#581c87;font-style:italic;line-height:1.3;word-break:break-word;">
            ${o.repuestos_esperando || 'Piezas en proceso de adquisición'}
          </span>
        </div>
      ` : ''}

      <div class="card-mec-row">
        <span class="card-mec-label">🔧</span>
        <select class="card-mec-select" data-orden-id="${o.id}" title="Reasignar mecánico">
          <option value="">Sin asignar</option>
          ${optsSelect}
        </select>
      </div>

      ${actionsHtml}
    </div>
  `;
}



function flashCard(ordenId, tipo) {
  const card = document.getElementById(`kcard-${ordenId}`);
  if (!card) return;
  const color = tipo === 'success' ? '#10b981' : '#ef4444';
  card.style.transition = 'box-shadow .3s';
  card.style.boxShadow  = `0 0 0 2px ${color}`;
  setTimeout(() => { card.style.boxShadow = ''; }, 1200);
}

// ─────────────────────────────────────────────────────────────
// PANEL EQUIPO DE MECÁNICOS
// ─────────────────────────────────────────────────────────────
function renderEquipo(container) {
  // Merge stats con todos (incluyendo inactivos)
  const allMecs = mecStats.length ? mecStats : mecanicosList.map(m => ({ ...m, ordenes_activas: 0, ordenes_completadas: 0, ordenes_total: 0, dias_promedio_finalizacion: null }));

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h2 style="font-size:16px;font-weight:800;color:var(--dark);">Equipo Técnico</h2>
      <button id="btn-nuevo-mec" class="btn-primary flex items-center gap-2" style="padding:7px 16px;font-size:13px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
        Nuevo Mecánico
      </button>
    </div>

    <div class="mec-grid" id="mec-grid">
      ${allMecs.map(m => renderMecanicoCard(m)).join('')}
    </div>
  `;

  document.getElementById('btn-nuevo-mec').addEventListener('click', abrirModalNuevoMecanico);

  // Eventos delegados para las tarjetas de mecánicos
  const grid = document.getElementById('mec-grid');
  grid.addEventListener('click', async e => {
    const toggleBtn = e.target.closest('.btn-toggle-mec');
    const editBtn   = e.target.closest('.btn-edit-mec');

    if (toggleBtn) {
      const id     = parseInt(toggleBtn.dataset.id);
      const activo = toggleBtn.dataset.activo === 'true';
      await toggleMecanico(id, activo);
    }
    if (editBtn) {
      const id     = parseInt(editBtn.dataset.id);
      const nombre = editBtn.dataset.nombre;
      abrirModalEditarMecanico(id, nombre);
    }
  });
}

function renderMecanicoCard(m) {
  const maxActivos = 5; // carga máxima referencial por mecánico
  const cargaPct   = Math.min(100, Math.round(((m.ordenes_activas || 0) / maxActivos) * 100));
  const initials   = m.nombre.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
  const fillClass  = cargaPct >= 80 ? 'red' : cargaPct >= 50 ? 'amber' : '';
  const promDias   = m.dias_promedio_finalizacion != null ? `${m.dias_promedio_finalizacion}d` : '—';

  return `
    <div class="mec-card">
      <div class="mec-card-header">
        <div class="mec-avatar ${!m.activo ? 'inactivo' : ''}">${initials}</div>
        <div>
          <div class="mec-name">${m.nombre}</div>
          <div class="mec-status">
            ${m.activo
              ? `<span class="badge-activo">✓ Activo</span>`
              : `<span class="badge-inactivo">✗ Inactivo</span>`}
          </div>
        </div>
      </div>

      <div class="mec-stats-row">
        <div class="mec-stat">
          <div class="mec-stat-val" style="color:#3b82f6;">${m.ordenes_activas || 0}</div>
          <div class="mec-stat-lbl">Activas</div>
        </div>
        <div class="mec-stat">
          <div class="mec-stat-val" style="color:var(--brand);">${m.ordenes_completadas || 0}</div>
          <div class="mec-stat-lbl">Completadas</div>
        </div>
        <div class="mec-stat">
          <div class="mec-stat-val" style="color:#f59e0b;">${promDias}</div>
          <div class="mec-stat-lbl">Prom. días</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--slate-5);margin-bottom:5px;">
        Carga de Trabajo — ${cargaPct}%
      </div>
      <div class="workload-bar">
        <div class="workload-fill ${fillClass}" style="width:${cargaPct}%"></div>
      </div>

      <div class="mec-actions">
        <button class="btn-ghost flex items-center gap-1 btn-edit-mec"
          data-id="${m.id}" data-nombre="${m.nombre}"
          style="font-size:12px;padding:5px 10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          Editar
        </button>
        <button class="btn-toggle-mec flex items-center gap-1 ${m.activo ? 'btn-danger' : 'btn-success'}"
          data-id="${m.id}" data-activo="${m.activo}"
          style="font-size:12px;padding:5px 10px;flex:1;justify-content:center;">
          ${m.activo ? '⏸ Desactivar' : '▶ Activar'}
        </button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// ACCIONES: MECÁNICOS
// ─────────────────────────────────────────────────────────────
async function toggleMecanico(id, estaActivo) {
  try {
    await updateMecanico(id, { activo: !estaActivo });
    store.invalidate('mecanicos');
    // Actualizar localmente
    const mec = mecStats.find(m => m.id === id);
    if (mec) mec.activo = !estaActivo;
    const mec2 = mecanicosList.find(m => m.id === id);
    if (mec2) mec2.activo = !estaActivo;
    // Si desactivamos, quitarlo del dropdown
    if (estaActivo) mecanicosList = mecanicosList.filter(m => m.id !== id);
    else {
      const m = mecStats.find(m => m.id === id);
      if (m) mecanicosList.push({ id: m.id, nombre: m.nombre, activo: true });
    }
    renderTabContent();
  } catch (err) {
    console.error('Error al togglear mecánico:', err);
  }
}

function abrirModalNuevoMecanico() {
  const modales = document.getElementById('ops-modales');
  modales.innerHTML = `
    <div class="ops-modal-overlay" id="modal-mec-overlay">
      <div class="ops-modal">
        <div class="ops-modal-title">➕ Nuevo Mecánico</div>
        <form id="form-nuevo-mec">
          <div class="form-group mb-4">
            <label class="form-label">Nombre completo</label>
            <input id="mec-nombre-input" type="text" class="form-input w-full" placeholder="Ej: Luis Quispe Torres" required autofocus />
          </div>
          <div class="flex gap-3 justify-end">
            <button type="button" class="btn-ghost" id="btn-cancel-mec">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-mec">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('btn-cancel-mec').addEventListener('click', cerrarModal);
  document.getElementById('modal-mec-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-mec-overlay')) cerrarModal();
  });
  document.getElementById('form-nuevo-mec').addEventListener('submit', async e => {
    e.preventDefault();
    const nombre = document.getElementById('mec-nombre-input').value.trim();
    if (!nombre) return;
    const btn = document.getElementById('btn-save-mec');
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    try {
      const nuevo = await createMecanico({ nombre });
      store.invalidate('mecanicos');
      mecanicosList.push(nuevo);
      mecStats.push({ ...nuevo, ordenes_activas: 0, ordenes_completadas: 0, ordenes_total: 0, dias_promedio_finalizacion: null });
      cerrarModal();
      renderTabContent();
    } catch (err) {
      btn.textContent = '⚠ Error';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = 'Guardar'; }, 2000);
    }
  });
}

function abrirModalEditarMecanico(id, nombreActual) {
  const modales = document.getElementById('ops-modales');
  modales.innerHTML = `
    <div class="ops-modal-overlay" id="modal-edit-mec-overlay">
      <div class="ops-modal">
        <div class="ops-modal-title">✏️ Editar Mecánico</div>
        <form id="form-edit-mec">
          <div class="form-group mb-4">
            <label class="form-label">Nombre completo</label>
            <input id="mec-edit-nombre" type="text" class="form-input w-full" value="${nombreActual}" required autofocus />
          </div>
          <div class="flex gap-3 justify-end">
            <button type="button" class="btn-ghost" id="btn-cancel-edit-mec">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-edit-mec">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('btn-cancel-edit-mec').addEventListener('click', cerrarModal);
  document.getElementById('modal-edit-mec-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-edit-mec-overlay')) cerrarModal();
  });
  document.getElementById('form-edit-mec').addEventListener('submit', async e => {
    e.preventDefault();
    const nombre = document.getElementById('mec-edit-nombre').value.trim();
    if (!nombre) return;
    const btn = document.getElementById('btn-save-edit-mec');
    btn.textContent = 'Guardando...';
    btn.disabled = true;
    try {
      await updateMecanico(id, { nombre });
      store.invalidate('mecanicos');
      // Actualizar localmente
      const m1 = mecStats.find(m => m.id === id);
      if (m1) m1.nombre = nombre;
      const m2 = mecanicosList.find(m => m.id === id);
      if (m2) m2.nombre = nombre;
      cerrarModal();
      renderTabContent();
    } catch (err) {
      btn.textContent = '⚠ Error';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = 'Guardar Cambios'; }, 2000);
    }
  });
}

function cerrarModal() {
  const modales = document.getElementById('ops-modales');
  if (modales) modales.innerHTML = '';
}
