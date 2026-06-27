import { 
  getOrdenes, getOrdenesEnProceso, getOrden, createOrden, updateOrden,
  cambiarEstado, addItem, deleteItem, getVehiculos, getMecanicos, getAlmacen,
  getClientes, guardarDiagnosticoOrden, patchNotaInternaOrden
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

function safeFormatDateTime(dateVal) {
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
  const dateStr = parsedDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = parsedDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr} ${timeStr}`;
}

let containerElement = null;
let activeTab = 'all'; // 'all' | 'process' | 'warranty'
let ordenesList = [];
let vehiculosList = [];
let mecanicosList = [];
let almacenList = [];
let clientesList = [];
let filterEstadoVal = '';
let filterMecanicoVal = '';
let sortVal = 'recientes';
let currentStep = 1;
let isCanvasSigned = false;
let isSignatureModified = false;
let editingOrderId = null;

// Colores para cada tipo de daño
const dmgColors = {
  Q: '#ef4444',
  A: '#f97316',
  R: '#8b5cf6',
  F: '#64748b'
};

// Siluetas vectoriales de las 5 vistas
const leftSilhouette = `
  <!-- Ground reference -->
  <line x1="20" y1="200" x2="380" y2="200" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4" />
  
  <!-- Body Silhouette -->
  <path d="M 30,175 C 30,165 40,150 70,148 L 110,140 L 160,105 Q 210,95 270,105 L 310,135 L 360,138 C 370,138 375,150 375,175 C 375,185 365,190 355,190 L 320,190 L 260,190 H 140 L 80,190 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" stroke-linejoin="round" />
  
  <!-- Windows -->
  <path d="M 165,110 L 210,110 L 210,135 L 150,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  <path d="M 215,110 L 265,110 L 295,135 L 215,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  
  <!-- Door seams -->
  <path d="M 210,110 L 210,190" stroke="#94a3b8" stroke-width="1.5" />
  <path d="M 148,135 L 148,190" stroke="#94a3b8" stroke-width="1.5" />
  <path d="M 270,115 C 275,135 275,190 275,190" stroke="#94a3b8" stroke-width="1.5" />
  
  <!-- Door handles -->
  <line x1="195" y1="142" x2="205" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
  <line x1="255" y1="142" x2="265" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
  
  <!-- Lights -->
  <path d="M 30,158 Q 38,158 38,165 L 30,168 Z" fill="#fef08a" stroke="#eab308" stroke-width="1" />
  <path d="M 374,145 Q 366,145 366,155 L 374,158 Z" fill="#fecaca" stroke="#dc2626" stroke-width="1" />

  <!-- Wheels (under arches) -->
  <!-- Front wheel arch -->
  <path d="M 80,175 A 30,30 0 0,1 140,175" fill="none" stroke="#475569" stroke-width="2" />
  <circle cx="110" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
  <circle cx="110" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
  
  <!-- Rear wheel arch -->
  <path d="M 260,175 A 30,30 0 0,1 320,175" fill="none" stroke="#475569" stroke-width="2" />
  <circle cx="290" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
  <circle cx="290" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
`;

const leftSvgContent = leftSilhouette;

const rightSilhouette = `
  <!-- Ground reference -->
  <line x1="20" y1="200" x2="380" y2="200" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4" />
  <g transform="translate(400, 0) scale(-1, 1)">
    <!-- Body Silhouette -->
    <path d="M 30,175 C 30,165 40,150 70,148 L 110,140 L 160,105 Q 210,95 270,105 L 310,135 L 360,138 C 370,138 375,150 375,175 C 375,185 365,190 355,190 L 320,190 L 260,190 H 140 L 80,190 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" stroke-linejoin="round" />
    
    <!-- Windows -->
    <path d="M 165,110 L 210,110 L 210,135 L 150,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
    <path d="M 215,110 L 265,110 L 295,135 L 215,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
    
    <!-- Door seams -->
    <path d="M 210,110 L 210,190" stroke="#94a3b8" stroke-width="1.5" />
    <path d="M 148,135 L 148,190" stroke="#94a3b8" stroke-width="1.5" />
    <path d="M 270,115 C 275,135 275,190 275,190" stroke="#94a3b8" stroke-width="1.5" />
    
    <!-- Door handles -->
    <line x1="195" y1="142" x2="205" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
    <line x1="255" y1="142" x2="265" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
    
    <!-- Lights -->
    <path d="M 30,158 Q 38,158 38,165 L 30,168 Z" fill="#fef08a" stroke="#eab308" stroke-width="1" />
    <path d="M 374,145 Q 366,145 366,155 L 374,158 Z" fill="#fecaca" stroke="#dc2626" stroke-width="1" />

    <!-- Wheels (under arches) -->
    <!-- Front wheel arch -->
    <path d="M 80,175 A 30,30 0 0,1 140,175" fill="none" stroke="#475569" stroke-width="2" />
    <circle cx="110" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
    <circle cx="110" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
    
    <!-- Rear wheel arch -->
    <path d="M 260,175 A 30,30 0 0,1 320,175" fill="none" stroke="#475569" stroke-width="2" />
    <circle cx="290" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
    <circle cx="290" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
  </g>
`;

const rightSvgContent = rightSilhouette;

const topSvgContent = `
  <!-- Symmetry Axis -->
  <line x1="40" y1="125" x2="360" y2="125" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2" />
  
  <!-- Body Outer border -->
  <path d="M 40,125 C 40,90 60,65 110,65 L 290,65 C 340,65 360,90 360,125 C 360,160 340,185 290,185 L 110,185 C 60,185 40,160 40,125 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" stroke-linejoin="round" />
  
  <!-- Hood seam -->
  <path d="M 105,65 L 105,185" stroke="#94a3b8" stroke-width="1.5" />
  
  <!-- Front windshield -->
  <path d="M 105,75 Q 140,125 105,175 L 130,170 Q 155,125 130,80 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  
  <!-- Roof -->
  <path d="M 130,80 H 270 V 170 H 130 Z" fill="#f8fafc" stroke="#475569" stroke-width="1.5" />
  
  <!-- Rear window -->
  <path d="M 270,80 Q 255,125 270,170 L 290,175 Q 275,125 290,75 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  
  <!-- Trunk seam -->
  <path d="M 290,65 L 290,185" stroke="#94a3b8" stroke-width="1.5" />
  
  <!-- Mirrors -->
  <path d="M 115,65 C 115,55 125,50 130,55 C 130,60 125,65 115,65 Z" fill="#475569" stroke="#475569" />
  <path d="M 115,185 C 115,195 125,200 130,195 C 130,190 125,185 115,185 Z" fill="#475569" stroke="#475569" />
`;

const frontSvgContent = `
  <!-- Roof -->
  <path d="M 130,80 Q 200,70 270,80" stroke="#475569" stroke-width="2" fill="none" />
  <!-- Windshield -->
  <path d="M 130,80 L 270,80 L 285,130 L 115,130 Z" fill="#e2e8f0" stroke="#475569" stroke-width="2" />
  <!-- Hood -->
  <path d="M 115,130 L 285,130 L 300,170 L 100,170 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- Headlights -->
  <path d="M 102,170 H 140 L 135,185 H 105 Z" fill="#fef08a" stroke="#eab308" stroke-width="1.5" />
  <path d="M 298,170 H 260 L 265,185 H 295 Z" fill="#fef08a" stroke="#eab308" stroke-width="1.5" />
  
  <!-- Grille -->
  <path d="M 150,170 H 250 V 190 H 150 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
  <line x1="170" y1="170" x2="170" y2="190" stroke="#475569" stroke-width="1" />
  <line x1="190" y1="170" x2="190" y2="190" stroke="#475569" stroke-width="1" />
  <line x1="210" y1="170" x2="210" y2="190" stroke="#475569" stroke-width="1" />
  <line x1="230" y1="170" x2="230" y2="190" stroke="#475569" stroke-width="1" />
  
  <!-- Front bumper -->
  <path d="M 90,185 H 310 C 310,210 290,215 200,215 C 110,215 90,210 90,185 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- Wheels showing at bottom -->
  <rect x="100" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  <rect x="280" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  
  <!-- Mirrors -->
  <path d="M 110,115 C 95,115 90,120 95,125 Z" fill="#475569" stroke="#475569" />
  <path d="M 290,115 C 305,115 310,120 305,125 Z" fill="#475569" stroke="#475569" />
`;

const rearSvgContent = `
  <!-- Roof -->
  <path d="M 130,80 Q 200,70 270,80" stroke="#475569" stroke-width="2" fill="none" />
  <!-- Rear window -->
  <path d="M 130,80 L 270,80 L 285,135 L 115,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="2" />
  <!-- Trunk lid -->
  <path d="M 115,135 L 285,135 L 295,175 L 105,175 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- License plate -->
  <rect x="170" y="180" width="60" height="18" fill="#fef08a" stroke="#eab308" stroke-width="1" rx="2" />
  <text x="200" y="191" font-size="8" font-family="monospace" text-anchor="middle" fill="#000">PLACA</text>
  
  <!-- Tail lights -->
  <path d="M 105,170 H 145 V 185 H 105 Z" fill="#ef4444" stroke="#dc2626" stroke-width="1.5" />
  <path d="M 295,170 H 255 V 185 H 295 Z" fill="#ef4444" stroke="#dc2626" stroke-width="1.5" />
  
  <!-- Bumper -->
  <path d="M 90,185 H 310 C 310,210 290,215 200,215 C 110,215 90,210 90,185 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- Wheels showing at bottom -->
  <rect x="100" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  <rect x="280" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  
  <!-- Mirrors -->
  <path d="M 110,115 C 95,115 90,120 95,125 Z" fill="#475569" stroke="#475569" />
  <path d="M 290,115 C 305,115 310,120 305,125 Z" fill="#475569" stroke="#475569" />
`;

function generatePrintSVG(points = []) {
  const getMarkers = (viewName) => {
    return points
      .filter(pt => pt.view === viewName)
      .map(pt => {
        const color = dmgColors[pt.type] || '#ef4444';
        return `
          <g class="dmg-marker">
            <circle cx="${pt.x}" cy="${pt.y}" r="12" fill="${color}30" stroke="${color}" stroke-width="2"></circle>
            <text x="${pt.x}" y="${pt.y}" fill="${color}" font-family="system-ui, sans-serif" font-weight="bold" font-size="9" text-anchor="middle" dominant-baseline="central">${pt.type}</text>
          </g>
        `;
      })
      .join('');
  };

  return `
    <svg viewBox="0 0 560 225" class="vargas-print-chassis-svg" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;">
      <!-- VISTA LATERAL IZQUIERDA -->
      <g transform="translate(15, -10) scale(0.58)">
        ${leftSilhouette}
        ${getMarkers('left')}
      </g>
      <text x="131" y="112" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">LATERAL IZQUIERDA</text>

      <!-- VISTA LATERAL DERECHA -->
      <g transform="translate(310, -10) scale(0.58)">
        ${rightSilhouette}
        ${getMarkers('right')}
      </g>
      <text x="426" y="112" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">LATERAL DERECHA</text>

      <!-- VISTA FRONTAL -->
      <g transform="translate(15, 115) scale(0.48)">
        ${frontSvgContent}
        ${getMarkers('front')}
      </g>
      <text x="111" y="222" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">VISTA FRONTAL</text>

      <!-- VISTA SUPERIOR -->
      <g transform="translate(184, 115) scale(0.48)">
        ${topSvgContent}
        ${getMarkers('top')}
      </g>
      <text x="280" y="222" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">VISTA SUPERIOR</text>

      <!-- VISTA POSTERIOR -->
      <g transform="translate(353, 115) scale(0.48)">
        ${rearSvgContent}
        ${getMarkers('rear')}
      </g>
      <text x="449" y="222" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">VISTA POSTERIOR</text>
    </svg>
  `;
}

function initDamageCanvas() {
  if (window.initDamageInspector) {
    window.initDamageInspector();
  }
}

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="ordenes-root"></div>`;
  editingOrderId = null;
  isSignatureModified = false;
  
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

  // 1. Filtrar según pestaña
  let filtradas = activeTab === 'process'
    ? ordenesList.filter(o => o.estado === 'En Proceso' || o.estado === 'Esperando Repuestos' || o.estado === 'Diagnostico')
    : activeTab === 'warranty'
      ? ordenesList.filter(o => o.estado === 'Entregado')
      : ordenesList;

  // 2. Filtrar por estado select
  if (filterEstadoVal) {
    filtradas = filtradas.filter(o => o.estado === filterEstadoVal);
  }

  // 3. Filtrar por mecánico select
  if (filterMecanicoVal) {
    filtradas = filtradas.filter(o => o.mecanico === filterMecanicoVal);
  }

  // 4. Aplicar ordenamiento
  if (sortVal === 'recientes') {
    filtradas.sort((a, b) => b.id - a.id);
  } else if (sortVal === 'antiguas') {
    filtradas.sort((a, b) => a.id - b.id);
  } else if (sortVal === 'total-desc') {
    filtradas.sort((a, b) => parseFloat(b.total_estimado || 0) - parseFloat(a.total_estimado || 0));
  } else if (sortVal === 'total-asc') {
    filtradas.sort((a, b) => parseFloat(a.total_estimado || 0) - parseFloat(b.total_estimado || 0));
  }

  // 5. Filtrar por buscador si ya tiene texto
  const searchInput = document.getElementById('search-ordenes');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  if (q) {
    filtradas = filtradas.filter(o => 
      o.id.toString().includes(q) ||
      (o.placa && o.placa.toLowerCase().includes(q)) ||
      (o.cliente && o.cliente.toLowerCase().includes(q)) ||
      (o.vehiculo && o.vehiculo.toLowerCase().includes(q))
    );
  }

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
        <button class="btn-tab ${activeTab === 'warranty' ? 'active-tab' : ''}" id="tab-ord-warranty" style="font-size:12px;padding:6px 12px;border:none;background:transparent;cursor:pointer;font-weight:700;border-radius:6px;">🛡️ Garantías</button>
      </div>
    </div>

    <!-- Search, Filter & Sort Row -->
    <div class="mb-4 flex gap-3 justify-between items-center" style="flex-wrap:wrap;">
      <div class="flex gap-2" style="flex-wrap:wrap; align-items:center;">
        <select id="filter-orden-estado" class="form-select" style="width:170px; font-size:12px; padding:6px 10px; border-radius:8px;">
          <option value="">Todos los Estados</option>
          <option value="Diagnostico" ${filterEstadoVal === 'Diagnostico' ? 'selected' : ''}>🔍 Diagnóstico</option>
          <option value="En Proceso" ${filterEstadoVal === 'En Proceso' ? 'selected' : ''}>⚙️ En Proceso</option>
          <option value="Esperando Repuestos" ${filterEstadoVal === 'Esperando Repuestos' ? 'selected' : ''}>📦 Esperando Repuestos</option>
          <option value="Finalizado" ${filterEstadoVal === 'Finalizado' ? 'selected' : ''}>✅ Finalizado</option>
          <option value="Entregado" ${filterEstadoVal === 'Entregado' ? 'selected' : ''}>🟢 Entregado</option>
          <option value="No realizo servicio" ${filterEstadoVal === 'No realizo servicio' ? 'selected' : ''}>⚫ Sin Servicio</option>
        </select>
        <select id="filter-orden-mecanico" class="form-select" style="width:170px; font-size:12px; padding:6px 10px; border-radius:8px;">
          <option value="">Todos los Mecánicos</option>
          ${mecanicosList.map(m => `<option value="${m.nombre}" ${filterMecanicoVal === m.nombre ? 'selected' : ''}>${m.nombre}</option>`).join('')}
        </select>
        <select id="sort-ordenes" class="form-select" style="width:170px; font-size:12px; padding:6px 10px; border-radius:8px;">
          <option value="recientes" ${sortVal === 'recientes' ? 'selected' : ''}>📅 Más recientes primero</option>
          <option value="antiguas" ${sortVal === 'antiguas' ? 'selected' : ''}>📅 Más antiguas primero</option>
          <option value="total-desc" ${sortVal === 'total-desc' ? 'selected' : ''}>💰 Total: Mayor a menor</option>
          <option value="total-asc" ${sortVal === 'total-asc' ? 'selected' : ''}>💰 Total: Menor a mayor</option>
        </select>
      </div>
      <input type="text" id="search-ordenes" placeholder="Buscar por placa, orden o cliente..." value="${q}" class="form-input" style="width:260px;" />
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
  document.getElementById('tab-ord-warranty').addEventListener('click', () => { activeTab = 'warranty'; renderPage(); });
  document.getElementById('search-ordenes').addEventListener('input', filtrarOrdenes);
  document.getElementById('filter-orden-estado').addEventListener('change', () => { filterEstadoVal = document.getElementById('filter-orden-estado').value; filtrarOrdenes(); });
  document.getElementById('filter-orden-mecanico').addEventListener('change', () => { filterMecanicoVal = document.getElementById('filter-orden-mecanico').value; filtrarOrdenes(); });
  document.getElementById('sort-ordenes').addEventListener('change', () => { sortVal = document.getElementById('sort-ordenes').value; filtrarOrdenes(); });
  document.getElementById('btn-nueva-orden-header').addEventListener('click', abrirModalNuevaOrden);

  // --- EVENTOS DEL STEPPER DE RECEPCIÓN ---
  currentStep = 1;
  isCanvasSigned = false;

  window.toggleInvAccordion = function(header) {
    const content = header.nextElementSibling;
    content.classList.toggle('active');
    header.classList.toggle('active');
  };

  window.checkAllCategory = function(btn, event) {
    event.stopPropagation();
    const content = btn.parentElement.nextElementSibling;
    const checkboxes = content.querySelectorAll('.inv-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    window.guardarBorradorEnLocalStorage();
  };

  function updateStepIndicators() {
    document.querySelectorAll('.stepper-header .step-indicator').forEach(el => {
      const stepNum = parseInt(el.dataset.step);
      el.classList.toggle('active', stepNum === currentStep);
    });
    
    // Mostrar/ocultar pasos
    document.querySelectorAll('.stepper-step').forEach((el, idx) => {
      el.classList.toggle('active', idx === currentStep - 1);
    });

    const prevBtn = document.getElementById('btn-step-prev');
    const nextBtn = document.getElementById('btn-step-next');
    const saveBtn = document.getElementById('btn-save-ord');

    if (currentStep === 1) {
      prevBtn.style.visibility = 'hidden';
    } else {
      prevBtn.style.visibility = 'visible';
    }

    if (currentStep === 4) {
      nextBtn.classList.add('hidden');
      saveBtn.classList.remove('hidden');
    } else {
      nextBtn.classList.remove('hidden');
      saveBtn.classList.add('hidden');
    }
  }

  function validarPaso(step) {
    if (step === 1) {
      const cli = document.getElementById('cli-select-id').value;
      const veh = document.getElementById('veh-select-id').value;
      const km = document.getElementById('ord-km').value;
      if (!cli) { alert('Por favor, selecciona un cliente.'); return false; }
      if (!veh) { alert('Por favor, selecciona un vehículo.'); return false; }
      if (!km || parseInt(km) <= 0) { alert('Por favor, ingresa un kilometraje válido.'); return false; }
    }
    return true;
  }

  document.getElementById('btn-step-next').addEventListener('click', () => {
    if (validarPaso(currentStep)) {
      currentStep++;
      updateStepIndicators();
      if (currentStep === 4) {
        initSignatureCanvas();
        initDamageCanvas();
      }
      window.guardarBorradorEnLocalStorage();
    }
  });

  document.getElementById('btn-step-prev').addEventListener('click', () => {
    currentStep--;
    updateStepIndicators();
    window.guardarBorradorEnLocalStorage();
  });

  // Selector táctil de combustible
  document.querySelectorAll('.fuel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.target.dataset.val;
      document.getElementById('ord-combustible').value = val;
      document.querySelectorAll('.fuel-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === val);
        if (b.dataset.val === val) {
          b.style.background = 'var(--white)';
          b.style.color = 'var(--dark)';
          b.style.fontWeight = '800';
        } else {
          b.style.background = 'transparent';
          b.style.color = 'var(--slate-4)';
          b.style.fontWeight = '700';
        }
      });
      window.guardarBorradorEnLocalStorage();
    });
  });

  // Botones de prueba de ruta
  document.getElementById('btn-pruebaruta-si').addEventListener('click', () => {
    document.getElementById('ord-pruebaruta').value = 'SI';
    document.getElementById('btn-pruebaruta-si').className = 'active';
    document.getElementById('btn-pruebaruta-si').style.background = 'var(--white)';
    document.getElementById('btn-pruebaruta-si').style.color = 'var(--dark)';
    document.getElementById('btn-pruebaruta-si').style.fontWeight = '800';
    document.getElementById('btn-pruebaruta-si').style.boxShadow = 'var(--shadow-sm)';

    document.getElementById('btn-pruebaruta-no').className = '';
    document.getElementById('btn-pruebaruta-no').style.background = 'transparent';
    document.getElementById('btn-pruebaruta-no').style.color = 'var(--slate-4)';
    document.getElementById('btn-pruebaruta-no').style.fontWeight = '700';
    document.getElementById('btn-pruebaruta-no').style.boxShadow = 'none';
    window.guardarBorradorEnLocalStorage();
  });

  document.getElementById('btn-pruebaruta-no').addEventListener('click', () => {
    document.getElementById('ord-pruebaruta').value = 'NO';
    document.getElementById('btn-pruebaruta-no').className = 'active';
    document.getElementById('btn-pruebaruta-no').style.background = 'var(--white)';
    document.getElementById('btn-pruebaruta-no').style.color = 'var(--dark)';
    document.getElementById('btn-pruebaruta-no').style.fontWeight = '800';
    document.getElementById('btn-pruebaruta-no').style.boxShadow = 'var(--shadow-sm)';

    document.getElementById('btn-pruebaruta-si').className = '';
    document.getElementById('btn-pruebaruta-si').style.background = 'transparent';
    document.getElementById('btn-pruebaruta-si').style.color = 'var(--slate-4)';
    document.getElementById('btn-pruebaruta-si').style.fontWeight = '700';
    document.getElementById('btn-pruebaruta-si').style.boxShadow = 'none';
    window.guardarBorradorEnLocalStorage();
  });

  window.guardarBorradorEnLocalStorage = function() {
    if (editingOrderId) return;
    const cliSearch = document.getElementById('cli-search-input')?.value || '';
    const cliId = document.getElementById('cli-select-id')?.value || '';
    const vehId = document.getElementById('veh-select-id')?.value || '';
    const km = document.getElementById('ord-km')?.value || '';
    const combustible = document.getElementById('ord-combustible')?.value || '1/2';
    const mecanicoId = document.getElementById('ord-mecanico')?.value || '';
    const fecha_ingreso = document.getElementById('ord-fecha-ingreso')?.value || '';
    const hora_ingreso = document.getElementById('ord-hora-ingreso')?.value || '';
    
    // Conductor
    const hasConductor = document.getElementById('ord-has-conductor')?.checked || false;
    const conductor_nombre = document.getElementById('ord-conductor-nombre')?.value || '';
    const conductor_doc = document.getElementById('ord-conductor-doc')?.value || '';
    const conductor_telefono = document.getElementById('ord-conductor-telefono')?.value || '';

    // Garantia
    const es_garantia = document.getElementById('ord-es-garantia')?.checked || false;
    const mecanico_negligente_id = document.getElementById('ord-mecanico-negligente-id')?.value || '';
    const garantia_motivo = document.getElementById('ord-garantia-motivo')?.value || '';
    
    const sintomas = [];
    document.querySelectorAll('.sintomas-checkbox:checked').forEach(cb => {
      sintomas.push(cb.dataset.sintoma);
    });

    const otros_sintomas = document.getElementById('ord-falla')?.value || '';

    const servicios_adicionales = [];
    if (document.getElementById('add-lavado')?.checked) servicios_adicionales.push('add-lavado');
    if (document.getElementById('add-retiro-rep')?.checked) servicios_adicionales.push('add-retiro-rep');
    if (document.getElementById('add-cliente-inv')?.checked) servicios_adicionales.push('add-cliente-inv');

    const fecha_estimada = document.getElementById('ord-fecha-entrega-est')?.value || '';
    const hora_estimada = document.getElementById('ord-hora-entrega-est')?.value || '';
    const comprobante_num = document.getElementById('ord-comprobante-num')?.value || '';

    const inventario = {};
    document.querySelectorAll('.inv-checkbox').forEach(cb => {
      inventario[cb.dataset.item] = cb.checked;
    });

    const prueba_ruta = document.getElementById('ord-pruebaruta')?.value || 'NO';
    const observaciones = document.getElementById('ord-observaciones')?.value || '';

    const draft = {
      cliId,
      cliSearch,
      vehId,
      km,
      combustible,
      mecanicoId,
      sintomas,
      otros_sintomas,
      servicios_adicionales,
      fecha_estimada,
      hora_estimada,
      comprobante_num,
      inventario,
      prueba_ruta,
      observaciones,
      fecha_ingreso,
      hora_ingreso,
      hasConductor,
      conductor_nombre,
      conductor_doc,
      conductor_telefono,
      es_garantia,
      mecanico_negligente_id,
      garantia_motivo,
      currentStep
    };

    localStorage.setItem('vargas_nueva_orden_draft', JSON.stringify(draft));
  };

  window.restaurarBorradorDesdeLocalStorage = function() {
    const draftStr = localStorage.getItem('vargas_nueva_orden_draft');
    if (!draftStr) return false;

    try {
      const draft = JSON.parse(draftStr);
      if (!draft) return false;

      // Restaurar Paso 1
      const cliSearch = document.getElementById('cli-search-input');
      if (cliSearch) cliSearch.value = draft.cliSearch || '';

      const cliSelect = document.getElementById('cli-select-id');
      if (cliSelect) {
        cliSelect.value = draft.cliId || '';
      }

      // Filtrar vehículos para ese cliente
      filtrarVehiculosPorCliente();

      const vehSelect = document.getElementById('veh-select-id');
      if (vehSelect) {
        vehSelect.value = draft.vehId || '';
        autoAsignarClienteYKm();
      }

      const kmInput = document.getElementById('ord-km');
      if (kmInput) kmInput.value = draft.km || '';

      const combustibleInput = document.getElementById('ord-combustible');
      if (combustibleInput) {
        combustibleInput.value = draft.combustible || '1/2';
        document.querySelectorAll('.fuel-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.val === draft.combustible);
          if (btn.dataset.val === draft.combustible) {
            btn.style.background = 'var(--white)';
            btn.style.color = 'var(--dark)';
            btn.style.fontWeight = '800';
          } else {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--slate-4)';
            btn.style.fontWeight = '700';
          }
        });
      }

      const mecanicoSelect = document.getElementById('ord-mecanico');
      if (mecanicoSelect) mecanicoSelect.value = draft.mecanicoId || '';

      // Restaurar Conductor
      const hasConductorInput = document.getElementById('ord-has-conductor');
      if (hasConductorInput) {
        hasConductorInput.checked = !!draft.hasConductor;
        const condFields = document.getElementById('conductor-fields');
        if (condFields) condFields.style.display = draft.hasConductor ? 'grid' : 'none';
      }
      const condNombre = document.getElementById('ord-conductor-nombre');
      if (condNombre) condNombre.value = draft.conductor_nombre || '';
      const condDoc = document.getElementById('ord-conductor-doc');
      if (condDoc) condDoc.value = draft.conductor_doc || '';
      const condTelf = document.getElementById('ord-conductor-telefono');
      if (condTelf) condTelf.value = draft.conductor_telefono || '';

      // Restaurar Garantia
      const esGarantiaInput = document.getElementById('ord-es-garantia');
      if (esGarantiaInput) {
        esGarantiaInput.checked = !!draft.es_garantia;
        const garFields = document.getElementById('garantia-fields');
        if (garFields) garFields.style.display = draft.es_garantia ? 'grid' : 'none';
      }
      const garMec = document.getElementById('ord-mecanico-negligente-id');
      if (garMec) garMec.value = draft.mecanico_negligente_id || '';
      const garMotivo = document.getElementById('ord-garantia-motivo');
      if (garMotivo) garMotivo.value = draft.garantia_motivo || '';

      // Restaurar Paso 2
      document.querySelectorAll('.sintomas-checkbox').forEach(cb => {
        cb.checked = (draft.sintomas || []).includes(cb.dataset.sintoma);
      });

      const fallaTextarea = document.getElementById('ord-falla');
      if (fallaTextarea) fallaTextarea.value = draft.otros_sintomas || '';

      if (document.getElementById('add-lavado')) {
        document.getElementById('add-lavado').checked = (draft.servicios_adicionales || []).includes('add-lavado');
      }
      if (document.getElementById('add-retiro-rep')) {
        document.getElementById('add-retiro-rep').checked = (draft.servicios_adicionales || []).includes('add-retiro-rep');
      }
      if (document.getElementById('add-cliente-inv')) {
        document.getElementById('add-cliente-inv').checked = (draft.servicios_adicionales || []).includes('add-cliente-inv');
      }

      const fechaInput = document.getElementById('ord-fecha-entrega-est');
      if (fechaInput) fechaInput.value = draft.fecha_estimada || '';

      const horaInput = document.getElementById('ord-hora-entrega-est');
      if (horaInput) horaInput.value = draft.hora_estimada || '';

      const fechaIngresoInput = document.getElementById('ord-fecha-ingreso');
      if (fechaIngresoInput) fechaIngresoInput.value = draft.fecha_ingreso || '';

      const horaIngresoInput = document.getElementById('ord-hora-ingreso');
      if (horaIngresoInput) horaIngresoInput.value = draft.hora_ingreso || '';

      const comprobanteInput = document.getElementById('ord-comprobante-num');
      if (comprobanteInput) {
        comprobanteInput.value = draft.comprobante_num || '';
        if (!comprobanteInput.value) {
          const maxId = ordenesList.length > 0 ? Math.max(...ordenesList.map(o => o.id)) : 0;
          const nextId = maxId + 1;
          comprobanteInput.value = `OS-${String(nextId).padStart(4, '0')}`;
        }
      }

      // Restaurar Paso 3 (Inventario)
      document.querySelectorAll('.inv-checkbox').forEach(cb => {
        if (draft.inventario && draft.inventario[cb.dataset.item] !== undefined) {
          cb.checked = draft.inventario[cb.dataset.item];
        }
      });

      // Restaurar Paso 4
      const pruebaInput = document.getElementById('ord-pruebaruta');
      if (pruebaInput) {
        pruebaInput.value = draft.prueba_ruta || 'NO';
        const btnSi = document.getElementById('btn-pruebaruta-si');
        const btnNo = document.getElementById('btn-pruebaruta-no');
        if (btnSi && btnNo) {
          if (draft.prueba_ruta === 'SI') {
            btnSi.classList.add('active');
            btnNo.classList.remove('active');
            btnSi.style.background = 'var(--white)';
            btnSi.style.color = 'var(--dark)';
            btnSi.style.fontWeight = '800';
            btnSi.style.boxShadow = 'var(--shadow-sm)';
            btnNo.style.background = 'transparent';
            btnNo.style.color = 'var(--slate-4)';
            btnNo.style.fontWeight = '700';
            btnNo.style.boxShadow = 'none';
          } else {
            btnNo.classList.add('active');
            btnSi.classList.remove('active');
            btnNo.style.background = 'var(--white)';
            btnNo.style.color = 'var(--dark)';
            btnNo.style.fontWeight = '800';
            btnNo.style.boxShadow = 'var(--shadow-sm)';
            btnSi.style.background = 'transparent';
            btnSi.style.color = 'var(--slate-4)';
            btnSi.style.fontWeight = '700';
            btnSi.style.boxShadow = 'none';
          }
        }
      }

      const obsTextarea = document.getElementById('ord-observaciones');
      if (obsTextarea) obsTextarea.value = draft.observaciones || '';

      // Restaurar paso actual
      currentStep = draft.currentStep || 1;
      updateStepIndicators();

      if (currentStep === 4) {
        initSignatureCanvas();
        initDamageCanvas();
      }

      return true;
    } catch (e) {
      console.error('Error restaurando borrador de orden:', e);
      return false;
    }
  };

  function initSignatureCanvas() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;
    
    // Clonar el canvas para limpiar controladores antiguos
    const newCanvas = canvas.cloneNode(true);
    canvas.replaceWith(newCanvas);
    
    setTimeout(() => {
      const rect = newCanvas.getBoundingClientRect();
      newCanvas.width = rect.width;
      newCanvas.height = 110;
      
      const ctx = newCanvas.getContext('2d');
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      let drawing = false;
      let lastPos = { x: 0, y: 0 };
      
      // Dibujar la firma existente si estamos editando
      if (editingOrderId) {
        const oExistente = ordenesList.find(item => item.id == editingOrderId);
        if (oExistente && oExistente.diagnostico) {
          try {
            const diagExistente = typeof oExistente.diagnostico === 'string' ? JSON.parse(oExistente.diagnostico) : oExistente.diagnostico;
            const firmaExistente = diagExistente && diagExistente.firma_cliente;
            if (firmaExistente) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0, newCanvas.width, newCanvas.height);
              };
              img.src = firmaExistente;
              isCanvasSigned = true;
            }
          } catch (_) {}
        }
      }
      
      const getMousePos = (e) => {
        const r = newCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - r.left,
          y: clientY - r.top
        };
      };
      
      const startDrawing = (e) => {
        drawing = true;
        lastPos = getMousePos(e);
        isCanvasSigned = true;
        isSignatureModified = true;
        e.preventDefault();
      };
      
      const draw = (e) => {
        if (!drawing) return;
        const pos = getMousePos(e);
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos = pos;
        e.preventDefault();
      };
      
      const stopDrawing = () => {
        drawing = false;
      };
      
      newCanvas.addEventListener('mousedown', startDrawing);
      newCanvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', stopDrawing);
      
      newCanvas.addEventListener('touchstart', startDrawing, { passive: false });
      newCanvas.addEventListener('touchmove', draw, { passive: false });
      newCanvas.addEventListener('touchend', stopDrawing);
      
      const clearBtn = document.getElementById('btn-clear-signature');
      if (clearBtn) clearBtn.onclick = () => {
        ctx.clearRect(0, 0, newCanvas.width, newCanvas.height);
        isCanvasSigned = false;
        isSignatureModified = true;
      };
    }, 150);
  }

  function initDamageCanvas() {
    initDamageInspector();
  }

  let activeView = 'top';
  let activeDmgType = 'Q';

  function initDamageInspector() {
    activeView = 'top';
    activeDmgType = 'Q';

    let damagePoints = [];
    try {
      const existingVal = document.getElementById('ord-damage-data').value;
      damagePoints = JSON.parse(existingVal || '[]');
    } catch(e) {
      damagePoints = [];
    }

    const svgWrap = document.getElementById('dmg-svg-wrap');
    if (!svgWrap) return;

    // Selector de tipo activo
    document.querySelectorAll('.dmg-type-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        activeDmgType = btn.dataset.type;
        document.querySelectorAll('.dmg-type-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.type === activeDmgType);
        });
      };
    });

    // Selector de vistas
    document.querySelectorAll('.dmg-view-tab').forEach(tab => {
      tab.onclick = (e) => {
        e.preventDefault();
        activeView = tab.dataset.view;
        document.querySelectorAll('.dmg-view-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.view === activeView);
        });
        redrawSVG();
      };
    });

    function redrawSVG() {
      let content = '';
      if (activeView === 'left') content = leftSvgContent;
      else if (activeView === 'right') content = rightSvgContent;
      else if (activeView === 'top') content = topSvgContent;
      else if (activeView === 'front') content = frontSvgContent;
      else if (activeView === 'rear') content = rearSvgContent;

      const viewPoints = damagePoints.filter(pt => pt.view === activeView);

      const markersHtml = viewPoints.map((pt) => {
        const color = dmgColors[pt.type] || '#ef4444';
        return `
          <g class="dmg-marker" data-x="${pt.x}" data-y="${pt.y}" style="cursor: pointer;">
            <circle cx="${pt.x}" cy="${pt.y}" r="12" fill="${color}30" stroke="${color}" stroke-width="2"></circle>
            <text x="${pt.x}" y="${pt.y}" fill="${color}" font-family="system-ui, sans-serif" font-weight="bold" font-size="9" text-anchor="middle" dominant-baseline="central">${pt.type}</text>
          </g>
        `;
      }).join('');

      svgWrap.innerHTML = `
        <svg id="interactive-damage-svg" viewBox="0 0 400 250" style="width: 100%; height: auto; display: block; border-radius: 8px;">
          ${content}
          <g id="damage-points-g">
            ${markersHtml}
          </g>
        </svg>
      `;

      const svgEl = document.getElementById('interactive-damage-svg');
      if (svgEl) {
        svgEl.addEventListener('click', (e) => {
          const rect = svgEl.getBoundingClientRect();
          const clickX = ((e.clientX - rect.left) / rect.width) * 400;
          const clickY = ((e.clientY - rect.top) / rect.height) * 250;

          const idx = damagePoints.findIndex(pt => pt.view === activeView && Math.hypot(pt.x - clickX, pt.y - clickY) < 16);
          if (idx !== -1) {
            damagePoints.splice(idx, 1);
          } else {
            damagePoints.push({ x: clickX, y: clickY, type: activeDmgType, view: activeView });
          }

          document.getElementById('ord-damage-data').value = JSON.stringify(damagePoints);
          window.guardarBorradorEnLocalStorage();
          redrawSVG();
        });
      }
    }

    const clearDmgBtn = document.getElementById('btn-clear-damage');
    if (clearDmgBtn) {
      clearDmgBtn.onclick = (e) => {
        e.preventDefault();
        damagePoints = [];
        document.getElementById('ord-damage-data').value = '[]';
        window.guardarBorradorEnLocalStorage();
        redrawSVG();
      };
    }

    redrawSVG();
  }
  window.initDamageInspector = initDamageInspector;

  window.resetStepperForm = function() {
    currentStep = 1;
    isCanvasSigned = false;
    updateStepIndicators();
  };

  // Registrar cierres de modales
  document.getElementById('btn-close-ord-x').addEventListener('click', cerrarModalNuevaOrden);
  document.getElementById('btn-close-ord-cancel').addEventListener('click', cerrarModalNuevaOrden);
  // Usar click en botón directamente en lugar de form submit para mayor compatibilidad
  document.getElementById('btn-save-ord').addEventListener('click', guardarNuevaOrden);
  document.getElementById('form-nueva-orden').addEventListener('input', () => window.guardarBorradorEnLocalStorage());
  document.getElementById('form-nueva-orden').addEventListener('change', () => window.guardarBorradorEnLocalStorage());
  document.getElementById('form-nueva-orden').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-quick-sintoma');
    if (btn) {
      const textarea = document.getElementById('ord-falla');
      if (textarea) {
        const val = btn.dataset.val;
        const currentVal = textarea.value.trim();
        if (currentVal) {
          textarea.value = currentVal + ', ' + val;
        } else {
          textarea.value = val;
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });
  document.getElementById('veh-select-id').addEventListener('change', autoAsignarClienteYKm);
  document.getElementById('cli-select-id').addEventListener('change', filtrarVehiculosPorCliente);
  
  // Toggle conductor fields
  const hasConductorCheckbox = document.getElementById('ord-has-conductor');
  if (hasConductorCheckbox) {
    hasConductorCheckbox.addEventListener('change', (e) => {
      const fields = document.getElementById('conductor-fields');
      if (fields) fields.style.display = e.target.checked ? 'grid' : 'none';
    });
  }

  // Toggle garantia fields
  const esGarantiaCheckbox = document.getElementById('ord-es-garantia');
  if (esGarantiaCheckbox) {
    esGarantiaCheckbox.addEventListener('change', (e) => {
      const fields = document.getElementById('garantia-fields');
      if (fields) fields.style.display = e.target.checked ? 'grid' : 'none';
    });
  }

  document.getElementById('cli-search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const cliSelect = document.getElementById('cli-select-id');
    Array.from(cliSelect.options).forEach(opt => {
      opt.style.display = (!q || opt.textContent.toLowerCase().includes(q) || !opt.value) ? '' : 'none';
    });
    // Auto-seleccionar si hay exactamente una coincidencia
    const visibles = Array.from(cliSelect.options).filter(o => o.value && o.style.display !== 'none');
    if (visibles.length === 1) {
      cliSelect.value = visibles[0].value;
      filtrarVehiculosPorCliente();
    }
  });

  // Buscador dinámico de vehículo/placa
  document.getElementById('veh-search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const vehSelect = document.getElementById('veh-select-id');
    Array.from(vehSelect.options).forEach(opt => {
      opt.style.display = (!q || opt.textContent.toLowerCase().includes(q) || !opt.value) ? '' : 'none';
    });
    // Auto-seleccionar si hay exactamente una coincidencia visible
    const visibles = Array.from(vehSelect.options).filter(o => o.value && o.style.display !== 'none');
    if (visibles.length === 1) {
      vehSelect.value = visibles[0].value;
      autoAsignarClienteYKm();
    }
  });

  // Buscador dinámico de repuesto en almacén (modal de costos)
  document.getElementById('item-repuesto-search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const repSelect = document.getElementById('item-repuesto-select');
    Array.from(repSelect.options).forEach(opt => {
      opt.style.display = (!q || opt.textContent.toLowerCase().includes(q) || !opt.value) ? '' : 'none';
    });
    // Auto-seleccionar y auto-asignar precio si hay exactamente una coincidencia
    const visibles = Array.from(repSelect.options).filter(o => o.value && o.style.display !== 'none');
    if (visibles.length === 1) {
      repSelect.value = visibles[0].value;
      const precio = visibles[0].dataset.precio;
      if (precio) document.getElementById('item-precio').value = parseFloat(precio).toFixed(2);
    }
  });

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
    const garBtn = e.target.closest('.btn-garantia-ord');

    if (viewBtn) verDetalleOrden(viewBtn.dataset.id);
    else if (costBtn) abrirModalCostos(costBtn.dataset.id);
    else if (statusBtn) abrirModalEstado(statusBtn.dataset.id);
    else if (garBtn) abrirOpcionesGarantia(garBtn.dataset);
  });

  // Eventos de Modales de Garantía
  document.getElementById('btn-close-gar-opt-x').addEventListener('click', () => {
    document.getElementById('modal-garantia-opciones').classList.remove('active');
  });
  document.getElementById('btn-close-gar-dev-x').addEventListener('click', () => {
    document.getElementById('modal-garantia-devolucion').classList.remove('active');
  });
  document.getElementById('btn-close-gar-dev-cancel').addEventListener('click', () => {
    document.getElementById('modal-garantia-devolucion').classList.remove('active');
  });
  document.getElementById('form-garantia-devolucion').addEventListener('submit', guardarGarantiaDevolucion);

  // Auto-abrir modal si se solicitó desde el Dashboard
  if (window.autoOpenNuevaOrden) {
    window.autoOpenNuevaOrden = false;
    abrirModalNuevaOrden();
  }
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
      'Entregado': 'badge-emerald',
      'No realizo servicio': 'badge-slate'
    };
    return `<span class="badge ${map[est] || 'badge-slate'}">${est === 'Diagnostico' ? 'Diagnóstico' : est}</span>`;
  };

  const isReadOnly = (estado) => ['Finalizado', 'Entregado', 'No realizo servicio'].includes(estado);

  return ordenes.map(o => `
    <tr>
      <td class="font-mono font-bold" style="color:var(--brand);">
        OS-${o.id}
        ${o.es_garantia ? `<div style="font-size:9px;background:#fee2e2;color:#b91c1c;padding:1px 4px;border-radius:4px;display:inline-block;font-family:sans-serif;margin-top:2px;font-weight:bold;">GARANTÍA</div>` : ''}
      </td>
      <td><span class="placa-badge">${o.placa || '—'}</span></td>
      <td><strong style="color:var(--dark);">${o.vehiculo || '—'}</strong></td>
      <td>
        <span style="font-weight:600;color:var(--dark);">${o.cliente || '—'}</span>
        ${o.cliente_telefono ? `<div style="font-size:11px;color:var(--slate-5);">${o.cliente_telefono}</div>` : ''}
        ${o.conductor_nombre ? `<div style="font-size:10px;color:var(--slate-5);margin-top:2px;"><span style="color:var(--brand);font-weight:bold;">Cond:</span> ${o.conductor_nombre}</div>` : ''}
      </td>
      <td><span style="font-weight:500;color:var(--slate-4);">${o.mecanico || '—'}</span></td>
      <td>
        ${badgeEstado(o.estado)}
        ${o.estado === 'Entregado' && activeTab === 'warranty' ? (() => {
          const fEntrega = o.fecha_entrega || o.fecha_ingreso || new Date();
          const dias = Math.floor((new Date() - new Date(fEntrega)) / 86400000);
          const activa = dias <= 15;
          const restantes = 15 - dias;
          return `<div style="margin-top:4px;">
            <span class="badge ${activa ? 'badge-green' : 'badge-slate'}" style="font-size:9px;">
              ${activa ? `✅ ${restantes}d restantes` : `⏰ Vencida +${-restantes}d`}
            </span>
          </div>`;
        })() : ''}
      </td>
      <td class="text-right font-mono font-bold">S/ ${parseFloat(o.total_estimado || 0).toFixed(2)}</td>
      <td class="text-right">
        <div class="flex justify-end gap-1">
          <button class="btn-action-ord btn-view-ord" data-id="${o.id}" title="Ver Expediente" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Ver
          </button>
          <button class="btn-action-ord btn-costs-ord" data-id="${o.id}" title="${isReadOnly(o.estado) ? 'Ver Insumos (Solo Lectura)' : 'Administrar Insumos y Costos'}" style="background:${isReadOnly(o.estado) ? '#f8fafc' : '#faf5ff'};color:${isReadOnly(o.estado) ? '#94a3b8' : '#7c3aed'};border:1px solid ${isReadOnly(o.estado) ? '#e2e8f0' : '#e9d5ff'};">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 11v-1m0-1v-4m-5 4h10"/></svg>
            ${isReadOnly(o.estado) ? 'Insumos' : 'Costos'}
          </button>
          <button class="btn-action-ord btn-status-ord" data-id="${o.id}" title="Cambiar Estado" style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6.002L16.24 11M4 9h5M4 9l4.76-4.76"/></svg>
            Estado
          </button>
          ${o.estado === 'Entregado' && activeTab === 'warranty' ? (() => {
            const fEntrega = o.fecha_entrega || o.fecha_ingreso || new Date();
            const dias = Math.floor((new Date() - new Date(fEntrega)) / 86400000);
            const activa = dias <= 15;
            return `<button class="btn-action-ord btn-garantia-ord"
              data-id="${o.id}" data-placa="${o.placa || ''}"
              data-cliente="${(o.cliente || '').replace(/"/g,'&quot;')}"
              data-mecanico-id="${o.mecanico_id || ''}" data-mecanico="${(o.mecanico || '').replace(/"/g,'&quot;')}"
              data-dias="${dias}" data-activa="${activa}"
              title="${activa ? 'Garantía activa (' + (15 - dias) + ' días restantes)' : 'Garantía expirada hace ' + (dias - 15) + ' días'}"
              style="background:${activa ? '#f0fdf4' : '#f8fafc'};color:${activa ? '#15803d' : '#94a3b8'};border:1px solid ${activa ? '#bbf7d0' : '#e2e8f0'};">
              🛡️
            </button>`;
          })() : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarOrdenes() {
  const q = document.getElementById('search-ordenes').value.toLowerCase().trim();
  filterEstadoVal = document.getElementById('filter-orden-estado').value;
  filterMecanicoVal = document.getElementById('filter-orden-mecanico').value;
  sortVal = document.getElementById('sort-ordenes').value;

  // 1. Filtrar por pestaña
  let filtradas = activeTab === 'process' 
    ? ordenesList.filter(o => o.estado === 'En Proceso' || o.estado === 'Esperando Repuestos' || o.estado === 'Diagnostico')
    : ordenesList;

  // 2. Filtrar por buscador
  if (q) {
    filtradas = filtradas.filter(o => 
      o.id.toString().includes(q) ||
      (o.placa && o.placa.toLowerCase().includes(q)) ||
      (o.cliente && o.cliente.toLowerCase().includes(q)) ||
      (o.vehiculo && o.vehiculo.toLowerCase().includes(q))
    );
  }

  // 3. Filtrar por estado select
  if (filterEstadoVal) {
    filtradas = filtradas.filter(o => o.estado === filterEstadoVal);
  }

  // 4. Filtrar por mecánico select
  if (filterMecanicoVal) {
    filtradas = filtradas.filter(o => o.mecanico === filterMecanicoVal);
  }

  // 5. Aplicar ordenamiento
  if (sortVal === 'recientes') {
    filtradas.sort((a, b) => b.id - a.id);
  } else if (sortVal === 'antiguas') {
    filtradas.sort((a, b) => a.id - b.id);
  } else if (sortVal === 'total-desc') {
    filtradas.sort((a, b) => parseFloat(b.total_estimado || 0) - parseFloat(a.total_estimado || 0));
  } else if (sortVal === 'total-asc') {
    filtradas.sort((a, b) => parseFloat(a.total_estimado || 0) - parseFloat(b.total_estimado || 0));
  }

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
            <span class="modal-title" id="modal-nueva-orden-title">Registrar Orden de Servicio</span>
          </div>
          <button class="modal-close" id="btn-close-ord-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-nueva-orden" novalidate>
          <!-- Barra de Progreso Stepper -->
          <div class="stepper-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:12px; border-bottom:1px solid var(--slate-8);">
            <div class="step-indicator active" data-step="1" style="font-size:11px; font-weight:800; color:var(--brand); display:flex; align-items:center; gap:6px;">
              <span class="step-num" style="width:20px; height:20px; background:var(--brand); color:var(--dark); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; transition: all 0.2s;">1</span>
              Vehículo
            </div>
            <div style="flex:1; height:1px; background:var(--slate-8); margin:0 8px;"></div>
            <div class="step-indicator" data-step="2" style="font-size:11px; font-weight:800; color:var(--slate-5); display:flex; align-items:center; gap:6px;">
              <span class="step-num" style="width:20px; height:20px; background:var(--slate-8); color:var(--slate-5); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; transition: all 0.2s;">2</span>
              Fallas
            </div>
            <div style="flex:1; height:1px; background:var(--slate-8); margin:0 8px;"></div>
            <div class="step-indicator" data-step="3" style="font-size:11px; font-weight:800; color:var(--slate-5); display:flex; align-items:center; gap:6px;">
              <span class="step-num" style="width:20px; height:20px; background:var(--slate-8); color:var(--slate-5); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; transition: all 0.2s;">3</span>
              Inventario
            </div>
            <div style="flex:1; height:1px; background:var(--slate-8); margin:0 8px;"></div>
            <div class="step-indicator" data-step="4" style="font-size:11px; font-weight:800; color:var(--slate-5); display:flex; align-items:center; gap:6px;">
              <span class="step-num" style="width:20px; height:20px; background:var(--slate-8); color:var(--slate-5); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; transition: all 0.2s;">4</span>
              Firma
            </div>
          </div>

          <div class="modal-body" style="display:flex; flex-direction:column; gap:14px; min-height:360px; overflow-y:auto; max-height:calc(80vh - 150px);">
            
            <!-- PASO 1: CLIENTE Y VEHICULO -->
            <div class="stepper-step active" id="step-1">
              <div class="form-section-title" style="margin:0;">Recepción de Unidad</div>
              
              <!-- Buscador de cliente con filtrado bidireccional -->
              <div style="background:var(--slate-9);border:1px solid var(--slate-8);border-radius:var(--radius-md);padding:12px;display:flex;flex-direction:column;gap:10px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <span style="font-size:11px;font-weight:800;color:var(--slate-4);text-transform:uppercase;letter-spacing:.5px;">Buscar y seleccionar</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Cliente</label>
                    <input type="text" id="cli-search-input" class="form-input" placeholder="🔍 Escribir nombre del cliente..." autocomplete="off" style="font-size:12px;" />
                    <select id="cli-select-id" class="form-select" required style="margin-top:6px;">
                      <option value="">-- Seleccionar cliente --</option>
                      ${clientesList.map(c => `<option value="${c.id}">${c.nombre} (${c.num_doc})</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Vehículo / Placa</label>
                    <input type="text" id="veh-search-input" class="form-input" placeholder="🔍 Buscar por placa o modelo..." autocomplete="off" style="font-size:12px;" />
                    <select id="veh-select-id" class="form-select" required style="margin-top:6px;">
                      <option value="">-- Primero selecciona un cliente --</option>
                      ${vehiculosList.map(v => `<option value="${v.id}" data-cliente-id="${v.cliente_id}" data-km="${v.km_actual || 0}">${v.placa} — ${v.marca_modelo}</option>`).join('')}
                    </select>
                    <div id="km-anterior-hint" style="display:none;margin-top:5px;font-size:11px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:5px 10px;border-radius:6px;font-weight:600;">
                      📍 Km anterior: <span id="km-anterior-valor">—</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Conductor diferente al propietario -->
              <div style="background:var(--slate-9);border:1px solid var(--slate-8);border-radius:var(--radius-md);padding:12px;display:flex;flex-direction:column;gap:10px;margin-top:10px;">
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--dark); cursor:pointer;">
                  <input type="checkbox" id="ord-has-conductor" style="width:15px; height:15px; accent-color:var(--brand);" />
                  ¿El conductor es diferente al propietario?
                </label>
                <div id="conductor-fields" style="display:none;" class="grid grid-cols-3 gap-3">
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Nombre del Conductor</label>
                    <input type="text" id="ord-conductor-nombre" class="form-input" placeholder="Nombre completo" />
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">DNI / Doc</label>
                    <input type="text" id="ord-conductor-doc" class="form-input" placeholder="N° Documento" />
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Teléfono</label>
                    <input type="text" id="ord-conductor-telefono" class="form-input" placeholder="N° Teléfono" />
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div class="form-group">
                  <label class="form-label">Kilometraje</label>
                  <input type="number" id="ord-km" class="form-input text-center font-bold" required placeholder="Km" />
                </div>
                <div class="form-group col-span-2">
                  <label class="form-label">Nivel Combustible</label>
                  <input type="hidden" id="ord-combustible" value="1/2" />
                  <div class="fuel-selector-wrap" style="display:flex; justify-content:space-between; background:var(--slate-8); padding:4px; border-radius:10px; border:1px solid var(--slate-7);">
                    <button type="button" class="fuel-btn" data-val="Vacio" style="flex:1; padding:8px; border:none; background:transparent; font-size:11px; font-weight:700; color:var(--slate-4); border-radius:6px; cursor:pointer;">E</button>
                    <button type="button" class="fuel-btn" data-val="1/4" style="flex:1; padding:8px; border:none; background:transparent; font-size:11px; font-weight:700; color:var(--slate-4); border-radius:6px; cursor:pointer;">1/4</button>
                    <button type="button" class="fuel-btn active" data-val="1/2" style="flex:1; padding:8px; border:none; background:var(--white); font-size:11px; font-weight:800; color:var(--dark); border-radius:6px; cursor:pointer; box-shadow:var(--shadow-sm);">1/2</button>
                    <button type="button" class="fuel-btn" data-val="3/4" style="flex:1; padding:8px; border:none; background:transparent; font-size:11px; font-weight:700; color:var(--slate-4); border-radius:6px; cursor:pointer;">3/4</button>
                    <button type="button" class="fuel-btn" data-val="Lleno" style="flex:1; padding:8px; border:none; background:transparent; font-size:11px; font-weight:700; color:var(--slate-4); border-radius:6px; cursor:pointer;">F</button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Mecánico Asignado (Opcional)</label>
                <select id="ord-mecanico" class="form-select">
                  <option value="">-- Sin asignar --</option>
                  ${mecanicosList.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3" style="margin-top: 10px;">
                <div class="form-group">
                  <label class="form-label">Fecha de Ingreso</label>
                  <input type="date" id="ord-fecha-ingreso" class="form-input" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Hora de Ingreso</label>
                  <input type="time" id="ord-hora-ingreso" class="form-input" required />
                </div>
              </div>
            </div>

            <!-- PASO 2: FALLAS Y SERVICIOS SOLICITADOS -->
            <div class="stepper-step" id="step-2">
              <div class="form-section-title" style="margin:0;">Síntomas & Trabajos Solicitados</div>
              
              <!-- Checkboxes de Fallas Comunes -->
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; background:var(--slate-9); padding:12px; border-radius:8px; border:1px solid var(--slate-8);">
                ${['Demora al encender', 'Falta de potencia', 'Vibraciones inusuales', 'Sobrecalentamiento', 'Problemas de transmisión', 'Luces del tablero encendidas', 'Problemas de dirección', 'Fugas o consumo de líquidos', 'Problemas de frenado', 'Problemas de suspensión', 'Humo de colores', 'Olores inusuales'].map(sint => `
                  <label style="display:flex; align-items:center; gap:8px; font-size:11px; color:var(--dark); cursor:pointer;">
                    <input type="checkbox" class="sintomas-checkbox" data-sintoma="${sint}" style="width:14px; height:14px; accent-color:var(--brand);" />
                    ${sint}
                  </label>
                `).join('')}
              </div>

              <div class="form-group">
                <label class="form-label">Otros / Especificaciones</label>
                <textarea id="ord-falla" class="form-textarea" rows="2" placeholder="Especifica fallas adicionales aquí..."></textarea>
                <div class="flex gap-2 mt-2" style="flex-wrap:wrap;">
                  <span style="font-size:10px;font-weight:700;color:var(--slate-5);display:flex;align-items:center;">⚡ Rápido:</span>
                  <button type="button" class="btn-quick-sintoma" data-val="Cambio de Aceite y Filtro" style="font-size:10px;padding:3px 8px;background:var(--slate-9);border:1px solid var(--slate-8);border-radius:4px;cursor:pointer;color:var(--dark);font-weight:600;">🛢️ Aceite</button>
                  <button type="button" class="btn-quick-sintoma" data-val="Afinamiento Motor" style="font-size:10px;padding:3px 8px;background:var(--slate-9);border:1px solid var(--slate-8);border-radius:4px;cursor:pointer;color:var(--dark);font-weight:600;">🔧 Afinamiento</button>
                  <button type="button" class="btn-quick-sintoma" data-val="Revisión de Frenos" style="font-size:10px;padding:3px 8px;background:var(--slate-9);border:1px solid var(--slate-8);border-radius:4px;cursor:pointer;color:var(--dark);font-weight:600;">🛑 Frenos</button>
                  <button type="button" class="btn-quick-sintoma" data-val="Alineamiento y Balanceo" style="font-size:10px;padding:3px 8px;background:var(--slate-9);border:1px solid var(--slate-8);border-radius:4px;cursor:pointer;color:var(--dark);font-weight:600;">🛞 Alineamiento</button>
                  <button type="button" class="btn-quick-sintoma" data-val="Lavado y Salón" style="font-size:10px;padding:3px 8px;background:var(--slate-9);border:1px solid var(--slate-8);border-radius:4px;cursor:pointer;color:var(--dark);font-weight:600;">🧼 Lavado</button>
                  <button type="button" class="btn-quick-sintoma" data-val="Diagnóstico Eléctrico" style="font-size:10px;padding:3px 8px;background:var(--slate-9);border:1px solid var(--slate-8);border-radius:4px;cursor:pointer;color:var(--dark);font-weight:600;">⚡ Electricidad</button>
                </div>
              </div>

              <div class="form-section-title" style="margin:4px 0 0 0;">Servicios Adicionales</div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; background:var(--slate-9); padding:10px; border-radius:8px; border:1px solid var(--slate-8);">
                <label style="display:flex; align-items:center; gap:8px; font-size:11px; color:var(--dark); cursor:pointer;">
                  <input type="checkbox" id="add-lavado" style="width:14px; height:14px; accent-color:var(--brand);" />
                  Lavado de vehículo
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:11px; color:var(--dark); cursor:pointer;">
                  <input type="checkbox" id="add-retiro-rep" style="width:14px; height:14px; accent-color:var(--brand);" />
                  Retiro de repuestos usados
                </label>
                <label style="display:flex; align-items:center; gap:8px; font-size:11px; color:var(--dark); cursor:pointer;">
                  <input type="checkbox" id="add-cliente-inv" style="width:14px; height:14px; accent-color:var(--brand);" />
                  Cliente participa en inventario
                </label>
              </div>

              <!-- Garantía por Negligencia -->
              <div style="background:var(--slate-9);border:1px solid var(--slate-8);border-radius:var(--radius-md);padding:12px;display:flex;flex-direction:column;gap:10px;margin-top:10px;margin-bottom:10px;">
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--dark); cursor:pointer;">
                  <input type="checkbox" id="ord-es-garantia" style="width:15px; height:15px; accent-color:var(--brand);" />
                  ⚠️ ¿Esta orden es una Garantía por Negligencia?
                </label>
                <div id="garantia-fields" style="display:none;" class="grid grid-cols-2 gap-3">
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Mecánico Responsable de la Negligencia</label>
                    <select id="ord-mecanico-negligente-id" class="form-select">
                      <option value="">-- Seleccionar mecánico responsable --</option>
                      ${mecanicosList.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Motivo / Detalle de la Falla Inicial</label>
                    <input type="text" id="ord-garantia-motivo" class="form-input" placeholder="Especificar qué falló o por qué aplica garantía..." />
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div class="form-group">
                  <label class="form-label">Fecha Est. Entrega</label>
                  <input type="date" id="ord-fecha-entrega-est" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Hora Est. Entrega</label>
                  <input type="time" id="ord-hora-entrega-est" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="display:flex; align-items:center; gap:4px;">
                    N° de Comprobante
                    <span style="font-size:9px; background:#ecfdf5; color:#059669; padding:1px 5px; border-radius:4px; font-weight:700;">AUTO</span>
                  </label>
                  <input type="text" id="ord-comprobante-num" class="form-input font-mono" placeholder="OS-0001" readonly style="background:#f8fafc; border-color:#cbd5e1; color:#64748b; cursor:not-allowed;" />
                </div>
              </div>
            </div>

            <!-- PASO 3: INVENTARIO DE ENTRADA -->
            <div class="stepper-step" id="step-3" style="gap: 10px;">
              <div class="form-section-title" style="margin: 0; display: flex; justify-content: space-between; align-items: center;">
                <span>📋 Inventario de Unidad</span>
                <span style="font-size: 10px; color: var(--slate-5); font-weight: 500;">Usa "Todo OK" para marcar rápido</span>
              </div>

              <!-- Acordeón 1: Documentación y Llaves -->
              <div class="inv-accordion">
                <div class="inv-accordion-header" onclick="toggleInvAccordion(this)">
                  <span>📁 1. Documentación y Llaves</span>
                  <button type="button" class="btn-ghost" onclick="checkAllCategory(this, event)" style="font-size: 10px; padding: 2px 6px; background:#10b981; color:#fff; border:none; border-radius:4px; font-weight:800;">Todo OK</button>
                </div>
                <div class="inv-accordion-content active">
                  <div class="inv-grid">
                    ${['Llave principal', 'Llavero', 'Tarjeta de Propiedad', 'SOAT', 'Manual del vehículo', 'Llave de repuesto', 'Control de alarma', 'Permiso lunas'].map(item => `
                      <label class="inv-item-label">
                        <input type="checkbox" class="inv-checkbox" data-item="${item}" checked />
                        ${item}
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>

              <!-- Acordeón 2: Accesorios e Interior -->
              <div class="inv-accordion">
                <div class="inv-accordion-header" onclick="toggleInvAccordion(this)">
                  <span>🛋️ 2. Accesorios e Interior</span>
                  <button type="button" class="btn-ghost" onclick="checkAllCategory(this, event)" style="font-size: 10px; padding: 2px 6px; background:#10b981; color:#fff; border:none; border-radius:4px; font-weight:800;">Todo OK</button>
                </div>
                <div class="inv-accordion-content">
                  <div class="inv-grid">
                    ${['Pisos delanteros', 'Pisos posteriores', 'Espejo retrovisor', 'Claxon', 'Alarma', 'Radio base estación', 'Medidor de presión', 'Encendedor', 'Cargador Usb', 'Cenicero', 'Linterna', 'Autoradio', 'Soporte de celular', 'Adornos colgantes', 'Ambientadores', 'Respaldo de asiento', 'Tapasoles', 'Cámara de retroceso', 'Amplificador de sonido'].map(item => `
                      <label class="inv-item-label">
                        <input type="checkbox" class="inv-checkbox" data-item="${item}" checked />
                        ${item}
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>

              <!-- Acordeón 3: Exterior e Iluminación -->
              <div class="inv-accordion">
                <div class="inv-accordion-header" onclick="toggleInvAccordion(this)">
                  <span>💡 3. Exterior e Iluminación</span>
                  <button type="button" class="btn-ghost" onclick="checkAllCategory(this, event)" style="font-size: 10px; padding: 2px 6px; background:#10b981; color:#fff; border:none; border-radius:4px; font-weight:800;">Todo OK</button>
                </div>
                <div class="inv-accordion-content">
                  <div class="inv-grid">
                    ${['Espejos laterales', 'Brazos y plumillas', 'Manijas de puertas', 'Luz de freno', 'Faros delanteros', 'Luz faros delanteros', 'Faros posteriores', 'Luz faros posteriores', 'Faros neblineros', 'Luz faros neblineros', 'Luz de placa', 'Antena', 'Antena de radio', 'Emblema delantero', 'Emblema posterior', 'Parabrisas delantero', 'Parabrisas posterior', 'Lunas delanteras', 'Lunas posteriores', 'Lunas de esquina', 'Tapa radiador', 'Tapa combustible'].map(item => `
                      <label class="inv-item-label">
                        <input type="checkbox" class="inv-checkbox" data-item="${item}" checked />
                        ${item}
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>

              <!-- Acordeón 4: Seguridad y Herramientas -->
              <div class="inv-accordion">
                <div class="inv-accordion-header" onclick="toggleInvAccordion(this)">
                  <span>🛠️ 4. Seguridad y Herramientas</span>
                  <button type="button" class="btn-ghost" onclick="checkAllCategory(this, event)" style="font-size: 10px; padding: 2px 6px; background:#10b981; color:#fff; border:none; border-radius:4px; font-weight:800;">Todo OK</button>
                </div>
                <div class="inv-accordion-content">
                  <div class="inv-grid">
                    ${['Batería', 'Computadora', 'Gata y palanca', 'Kit de herramientas', 'Llanta de repuesto', 'Triángulos de seguridad', 'Conos de seguridad', 'Cables de batería', 'Cable de remolque', 'Sogas/Eslingas', 'Bola de remolque', 'Extintor', 'Botiquín', 'Circulina', 'Sirena', 'Pértiga', 'Seguro de ruedas', 'Tacos de seguridad', 'Tapa fusibles'].map(item => `
                      <label class="inv-item-label">
                        <input type="checkbox" class="inv-checkbox" data-item="${item}" checked />
                        ${item}
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <!-- PASO 4: INSPECCION Y FIRMA DIGITAL -->
            <div class="stepper-step" id="step-4">
              <div class="form-section-title" style="margin:0;">Inspección de Daños & Firma</div>
              
              <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <div class="form-group" style="margin:0; min-width:140px;">
                  <label class="form-label">Prueba de Ruta</label>
                  <input type="hidden" id="ord-pruebaruta" value="NO" />
                  <div style="display:flex; border:1px solid var(--slate-8); border-radius:8px; overflow:hidden; background:var(--slate-9); padding:3px; gap:2px;">
                    <button type="button" id="btn-pruebaruta-si" style="flex:1; padding:6px; border:none; background:transparent; border-radius:6px; font-size:11px; font-weight:700; color:var(--slate-4); cursor:pointer; transition:all 0.1s;">SÍ</button>
                    <button type="button" id="btn-pruebaruta-no" class="active" style="flex:1; padding:6px; border:none; background:var(--white); border-radius:6px; font-size:11px; font-weight:800; color:var(--dark); cursor:pointer; box-shadow:var(--shadow-sm); transition:all 0.1s;">NO</button>
                  </div>
                </div>
                <!-- Leyenda de tipos de daño -->
                <div style="font-size:10px; color:var(--slate-5); font-weight:600; line-height:1.8; background:var(--slate-9); border:1px solid var(--slate-8); border-radius:8px; padding:8px 12px; flex:1; min-width:180px;">
                  <div style="font-size:10px; font-weight:800; color:var(--dark); text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px;">🔍 Tipo de Daño</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:2px 12px;">
                    <span><strong style="color:#ef4444;">Q</strong> — Quiñado</span>
                    <span><strong style="color:#f97316;">A</strong> — Abollado</span>
                    <span><strong style="color:#8b5cf6;">R</strong> — Rayado</span>
                    <span><strong style="color:#64748b;">F</strong> — Faltante</span>
                  </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px; min-width:100px;">
                  <button type="button" id="btn-clear-damage" style="font-size:10px; background:var(--slate-8); border:1px solid var(--slate-7); color:var(--dark); font-weight:700; padding:4px 8px; border-radius:6px; cursor:pointer;">🗑 Limpiar Daños</button>
                  <div style="font-size:9px; color:var(--slate-5); text-align:center;">Click en zona = marcar</div>
                </div>
              </div>

              <!-- Inspector SVG de Daños — 5 Vistas Profesionales -->
              <div class="dmg-inspector-card">
                <div class="dmg-inspector-header">
                  <span class="dmg-inspector-title">🚗 Inspector de Daños — Selecciona una vista y haz clic sobre la zona afectada</span>
                </div>

                <!-- Selector de tipo de daño -->
                <div class="dmg-type-selector" id="damage-type-selector">
                  <button type="button" class="dmg-type-btn active" data-type="Q"><span class="dmg-dot" style="background:#ef4444"></span>Quiñado</button>
                  <button type="button" class="dmg-type-btn" data-type="A"><span class="dmg-dot" style="background:#f97316"></span>Abollado</button>
                  <button type="button" class="dmg-type-btn" data-type="R"><span class="dmg-dot" style="background:#8b5cf6"></span>Rayado</button>
                  <button type="button" class="dmg-type-btn" data-type="F"><span class="dmg-dot" style="background:#64748b"></span>Faltante</button>
                </div>

                <!-- Selector de vistas -->
                <div class="dmg-view-tabs" id="dmg-view-tabs">
                  <button type="button" class="dmg-view-tab active" data-view="top">🔝 Superior</button>
                  <button type="button" class="dmg-view-tab" data-view="front">⬆️ Frontal</button>
                  <button type="button" class="dmg-view-tab" data-view="rear">⬇️ Trasera</button>
                  <button type="button" class="dmg-view-tab" data-view="left">◀️ Lat. Izq.</button>
                  <button type="button" class="dmg-view-tab" data-view="right">▶️ Lat. Der.</button>
                </div>

                <!-- SVG Container -->
                <div class="dmg-svg-wrap" id="dmg-svg-wrap"></div>

                <input type="hidden" id="ord-damage-data" value="[]" />
              </div>

              <div class="form-group" style="margin:0;">
                <label class="form-label">Observaciones de Carrocería</label>
                <textarea id="ord-observaciones" class="form-textarea" rows="2" placeholder="Ej: Abolladura leve en parachoques posterior..."></textarea>
              </div>

              <div class="form-group" style="margin:0;">
                <label class="form-label" style="display:flex; justify-content:space-between; align-items:center; margin:0 0 4px 0;">
                  <span>✍️ Firma del Cliente (Conformidad)</span>
                  <button type="button" id="btn-clear-signature" style="font-size:9px; background:var(--slate-8); border:1px solid var(--slate-7); color:var(--dark); font-weight:800; padding:2px 8px; border-radius:4px; cursor:pointer; transition: background 0.1s;">Limpiar</button>
                </label>
                <div style="border:2px dashed var(--slate-7); border-radius:8px; background:var(--slate-9); height:110px; position:relative; overflow:hidden;">
                  <canvas id="signature-canvas" style="width:100%; height:110px; cursor:crosshair; display:block; background:#fff;"></canvas>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer" style="justify-content:space-between; flex-shrink: 0; background: var(--white); padding: 12px 24px;">
            <button type="button" class="btn-ghost" id="btn-step-prev" style="visibility:hidden; padding: 8px 16px;">🠴 Atrás</button>
            <div style="display:flex; gap:10px;">
              <button type="button" class="btn-ghost" id="btn-close-ord-cancel" style="padding: 8px 16px;">Cancelar</button>
              <button type="button" class="btn-primary" id="btn-step-next" style="padding: 8px 16px;">Siguiente 🠲</button>
              <button type="button" class="btn-primary hidden" id="btn-save-ord" style="padding: 8px 16px;">✅ Registrar Recepción</button>
            </div>
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
              <!-- Conductor info block inside Cliente card -->
              <div id="det-conductor-wrapper" style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--slate-8); display:none;">
                <span style="font-size:9px;font-weight:700;color:var(--slate-5);text-transform:uppercase;display:block;">Conductor</span>
                <p id="det-conductor-nombre" style="font-size:12px;font-weight:700;color:var(--dark);margin:0;"></p>
                <p id="det-conductor-doc-tel" style="font-size:11px;color:var(--slate-5);margin:0;"></p>
              </div>
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

          <!-- Alerta de Garantía por Negligencia -->
          <div id="det-garantia-wrapper" class="hidden" style="background:#fef2f2;border:1px solid #fee2e2;color:#991b1b;padding:12px 16px;border-radius:var(--radius-md);font-weight:600;">
            <p style="font-size:11px;text-transform:uppercase;margin:0;">⚠️ ORDEN DE GARANTÍA POR NEGLIGENCIA (COSTO AL CLIENTE: S/ 0.00)</p>
            <p style="font-size:13px;margin-top:4px;color:#7f1d1d;font-weight:bold;margin-bottom:0;">
              Mecánico Responsable: <span id="det-garantia-mecanico" style="font-weight:normal;"></span>
            </p>
            <p style="font-size:12px;margin-top:2px;color:#7f1d1d;font-style:italic;margin-bottom:0;">
              Motivo: <span id="det-garantia-motivo" style="font-weight:normal;"></span>
            </p>
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
          <div class="flex flex-col gap-2 pt-2" style="border-top:1px solid var(--slate-8);">
            <div class="flex gap-3">
              <button class="btn-ghost" id="btn-print-hoja" style="flex:1;justify-content:center;background:#f8fafc;border:1px solid var(--slate-7);color:var(--dark);">
                🖨️ Orden de Servicio (Taller)
              </button>
              <button class="btn-success" id="btn-print-nota" style="flex:1;justify-content:center;color:var(--white);background:var(--dark);">
                🎫 Nota Interna (Cliente)
              </button>
            </div>
            <button class="btn-primary" id="btn-edit-ord" style="justify-content:center;width:100%;background:var(--brand);color:var(--dark);font-weight:800;">
              📝 Editar Orden de Servicio (Recepcionar Datos / Daños / Firma)
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
                <option value="Entregado">Entregado</option>
                <option value="No realizo servicio">No se realizó el servicio</option>
              </select>
            </div>

            <!-- Si está esperando repuestos -->
            <div class="form-group hidden" id="wrapper-repuestos-espera">
              <label class="form-label">Detalle de Repuestos Requeridos</label>
              <textarea id="status-repuestos-textarea" class="form-textarea" rows="3" placeholder="Ingresa los repuestos que hacen falta..."></textarea>
            </div>

            <!-- Si se marca como entregado, pedir fecha y hora real de salida -->
            <div class="grid grid-cols-2 gap-3 hidden" id="wrapper-fecha-entrega-real">
              <div class="form-group">
                <label class="form-label">Fecha de Salida / Entrega</label>
                <input type="date" id="status-fecha-entrega-real" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Hora de Salida / Entrega</label>
                <input type="time" id="status-hora-entrega-real" class="form-input" />
              </div>
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
            
            <div class="cost-add-grid">
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
                <input type="text" id="item-repuesto-search-input" class="form-input" placeholder="🔍 Buscar por código o descripción..." autocomplete="off" style="font-size:12px;" />
                <select id="item-repuesto-select" class="form-select" style="margin-top:6px;">
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
        <div class="modal-footer" style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <button class="btn-success" id="btn-share-whatsapp" style="display:none; gap:6px; align-items:center; background:#22c55e; border:none; color:#fff; padding:8px 16px; border-radius:var(--radius-md); font-weight:700; cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right:4px; display:inline-block; vertical-align:middle;">
              <path d="M13.601 2.326A7.85 7.85 0 0 0 8 0a7.86 7.86 0 0 0-6.68 11.754l-.533 1.956a.375.375 0 0 0 .425.474l2.008-.527A7.85 7.85 0 0 0 8 16a7.86 7.86 0 0 0 6.68-11.754H13.6zM8 14.5a6.52 6.52 0 0 1-3.376-.94l-.242-.14-1.258.33.336-1.233-.153-.244A6.5 6.5 0 0 1 1.5 8a6.5 6.5 0 0 1 6.5-6.5A6.5 6.5 0 0 1 14.5 8 6.5 6.5 0 0 1 8 14.5z"/>
            </svg>
            Compartir Presupuesto (WhatsApp)
          </button>
          <button class="btn-primary" id="btn-close-costos-cancel">Terminado</button>
        </div>
      </div>
    </div>

    <!-- Modal Opciones de Garantía -->
    <div id="modal-garantia-opciones" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <span class="modal-title">🛡️ Opciones de Garantía</span>
          </div>
          <button class="modal-close" id="btn-close-gar-opt-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; padding:20px;">
          <p style="font-size:13px; color:var(--slate-4); line-height:1.4;">
            Selecciona cómo proceder con el reclamo de garantía de la unidad <strong id="gar-opt-placa"></strong> (<span id="gar-opt-cliente"></span>):
          </p>
          
          <button id="btn-gar-opt-reparar" class="btn-success" style="width:100%; justify-content:center; padding:12px; font-weight:800; font-size:13px; display:flex; align-items:center; gap:6px;">
            🔧 Reparación sin costo (Nueva OS)
          </button>
          
          <button id="btn-gar-opt-devolucion" class="btn-ghost" style="width:100%; justify-content:center; padding:12px; font-weight:800; font-size:13px; border:1px solid var(--slate-7); color:var(--dark); background:#f8fafc; display:flex; align-items:center; gap:6px;">
            💸 Devolución de Dinero (Nota Interna)
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Registrar Devolución de Dinero -->
    <div id="modal-garantia-devolucion" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <span class="modal-title">💸 Registrar Devolución</span>
          </div>
          <button class="modal-close" id="btn-close-gar-dev-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-garantia-devolucion">
          <input type="hidden" id="gar-dev-orden-id" />
          <div class="modal-body" style="display:flex; flex-direction:column; gap:14px; padding:20px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Monto a Devolver (S/)</label>
              <input type="number" id="gar-dev-monto" step="0.01" min="0.01" class="form-input" required placeholder="0.00" style="font-weight:bold;" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">Detalles / Motivo de la Devolución</label>
              <textarea id="gar-dev-motivo" class="form-input" style="height:90px; resize:none; font-size:12px; padding:8px;" required placeholder="Ej: Devolución de dinero por disconformidad con el servicio de amortiguadores..."></textarea>
            </div>
          </div>
          <div class="modal-footer" style="padding-top:10px;">
            <button type="button" class="btn-ghost" id="btn-close-gar-dev-cancel">Cancelar</button>
            <button type="submit" class="btn-primary">Registrar Devolución</button>
          </div>
        </form>
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
  document.getElementById('cli-select-id').disabled = false;
  
  // Limpiar el autocompletado y Km anterior
  document.getElementById('km-anterior-hint').style.display = 'none';
  document.getElementById('cli-search-input').value = '';
  const vehSearchInput = document.getElementById('veh-search-input');
  if (vehSearchInput) vehSearchInput.value = '';
  // Filtrar todos los vehículos para restablecer
  filtrarVehiculosPorCliente();
  
  // Limpiar botones de combustible a estado inicial (1/2 active)
  document.getElementById('ord-combustible').value = '1/2';
  document.querySelectorAll('.fuel-btn').forEach(b => {
    const isHalf = b.dataset.val === '1/2';
    b.classList.toggle('active', isHalf);
    b.style.background = isHalf ? 'var(--white)' : 'transparent';
    b.style.color = isHalf ? 'var(--dark)' : 'var(--slate-4)';
    b.style.fontWeight = isHalf ? '800' : '700';
  });

  // Limpiar botones de prueba de ruta a NO
  document.getElementById('ord-pruebaruta').value = 'NO';
  const btnSi = document.getElementById('btn-pruebaruta-si');
  const btnNo = document.getElementById('btn-pruebaruta-no');
  if (btnSi && btnNo) {
    btnNo.className = 'active';
    btnNo.style.background = 'var(--white)';
    btnNo.style.color = 'var(--dark)';
    btnNo.style.fontWeight = '800';
    btnNo.style.boxShadow = 'var(--shadow-sm)';
    btnSi.className = '';
    btnSi.style.background = 'transparent';
    btnSi.style.color = 'var(--slate-4)';
    btnSi.style.fontWeight = '700';
    btnSi.style.boxShadow = 'none';
  }

  if (window.resetStepperForm) window.resetStepperForm();

  // Inicializar fecha y hora de ingreso al crear
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now - tzOffset)).toISOString();
  const fIngInput = document.getElementById('ord-fecha-ingreso');
  if (fIngInput) fIngInput.value = localISOTime.split('T')[0];
  const hIngInput = document.getElementById('ord-hora-ingreso');
  if (hIngInput) hIngInput.value = localISOTime.split('T')[1].substring(0, 5);

  modal.classList.add('active');

  // Auto-generar N° de Comprobante (OS-XXXX basado en el ID siguiente estimado)
  setTimeout(() => {
    const comprobanteInput = document.getElementById('ord-comprobante-num');
    if (comprobanteInput && !comprobanteInput.value) {
      const maxId = ordenesList.length > 0 ? Math.max(...ordenesList.map(o => o.id)) : 0;
      const nextId = maxId + 1;
      comprobanteInput.value = `OS-${String(nextId).padStart(4, '0')}`;
    }
  }, 50);

  // Preguntar si restaurar borrador
  if (localStorage.getItem('vargas_nueva_orden_draft')) {
    setTimeout(() => {
      if (confirm('Se encontró un borrador de orden de servicio sin terminar. ¿Deseas restaurar los datos anteriores?')) {
        window.restaurarBorradorDesdeLocalStorage();
      } else {
        localStorage.removeItem('vargas_nueva_orden_draft');
      }
    }, 120);
  }

  // Detectar reclamo de garantía desde el portal de garantías
  const garantiaDataRaw = sessionStorage.getItem('vargas_nueva_orden_garantia_de');
  if (garantiaDataRaw) {
    sessionStorage.removeItem('vargas_nueva_orden_garantia_de');
    try {
      const gData = JSON.parse(garantiaDataRaw);
      setTimeout(() => {
        // Activar checkbox de garantía
        const chkGar = document.getElementById('ord-es-garantia');
        if (chkGar) {
          chkGar.checked = true;
          const garFields = document.getElementById('garantia-fields');
          if (garFields) garFields.style.display = 'grid';
        }
        // Asignar mecánico negligente (el que hizo la orden original)
        if (gData.mecanicoId) {
          const selMecNeg = document.getElementById('ord-mecanico-negligente-id');
          if (selMecNeg) selMecNeg.value = gData.mecanicoId;
        }
        // Rellenar motivo con referencia a la orden original
        const motivoInput = document.getElementById('ord-garantia-motivo');
        if (motivoInput) {
          motivoInput.value = `Reclamo de garantía por falla en trabajo de OS-${String(gData.ordenOrigenId).padStart(4,'0')} · Mecánico: ${gData.mecanico || '—'}`;
        }
        // Buscar el vehículo por placa para pre-seleccionarlo
        if (gData.placa) {
          const vehSearch = document.getElementById('veh-search-input');
          const vehSelect = document.getElementById('veh-select-id');
          if (vehSearch && vehSelect) {
            vehSearch.value = gData.placa;
            // Filtrar y seleccionar
            Array.from(vehSelect.options).forEach(opt => {
              opt.style.display = opt.textContent.toLowerCase().includes(gData.placa.toLowerCase()) || !opt.value ? '' : 'none';
            });
            const match = Array.from(vehSelect.options).find(o => o.value && o.textContent.toLowerCase().includes(gData.placa.toLowerCase()));
            if (match) {
              vehSelect.value = match.value;
              autoAsignarClienteYKm();
            }
          }
        }
      }, 200);
    } catch (_) { /* silenciar error de parse */ }
  }
}

function cerrarModalNuevaOrden() {
  document.getElementById('modal-nueva-orden').classList.remove('active');
  editingOrderId = null;
  isSignatureModified = false;
  const titleEl = document.getElementById('modal-nueva-orden-title');
  if (titleEl) titleEl.textContent = 'Registrar Orden de Servicio';
  const saveBtn = document.getElementById('btn-save-ord');
  if (saveBtn) saveBtn.textContent = '✅ Registrar Recepción';
}

function abrirOpcionesGarantia(data) {
  const modal = document.getElementById('modal-garantia-opciones');
  document.getElementById('gar-opt-placa').textContent = data.placa;
  document.getElementById('gar-opt-cliente').textContent = data.cliente;

  document.getElementById('btn-gar-opt-reparar').onclick = () => {
    modal.classList.remove('active');
    
    // Alerta de confirmación solo si la garantía está vencida
    if (data.activa !== 'true') {
      const msg = `⚠️ La garantía de la unidad ${data.placa} ya expiró.\n¿Desea registrar igualmente una orden de garantía de forma excepcional?`;
      if (!confirm(msg)) return;
    }

    sessionStorage.setItem('vargas_nueva_orden_garantia_de', JSON.stringify({
      ordenOrigenId: data.id,
      placa: data.placa,
      cliente: data.cliente,
      mecanicoId: data.mecanicoId,
      mecanico: data.mecanico
    }));

    abrirModalNuevaOrden();
  };

  document.getElementById('btn-gar-opt-devolucion').onclick = () => {
    modal.classList.remove('active');
    abrirModalGarantiaDevolucion(data);
  };

  modal.classList.add('active');
}

function abrirModalGarantiaDevolucion(data) {
  const modal = document.getElementById('modal-garantia-devolucion');
  document.getElementById('form-garantia-devolucion').reset();
  document.getElementById('gar-dev-orden-id').value = data.id;
  document.getElementById('gar-dev-motivo').value = `Devolución de dinero por disconformidad con el servicio original OS-${String(data.id).padStart(4,'0')}.`;
  modal.classList.add('active');
}

async function guardarGarantiaDevolucion(e) {
  e.preventDefault();
  const id = document.getElementById('gar-dev-orden-id').value;
  const monto = parseFloat(document.getElementById('gar-dev-monto').value) || 0;
  const motivo = document.getElementById('gar-dev-motivo').value.trim();

  if (monto <= 0) {
    alert('Por favor ingrese un monto de devolución válido.');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    const orden = await getOrden(id);
    const notaAnterior = orden.nota_interna ? orden.nota_interna + '\n' : '';
    const nuevaNota = `${notaAnterior}[DEVOLUCIÓN DE GARANTÍA - ${new Date().toLocaleDateString('es-PE')}] Monto devuelto: S/ ${monto.toFixed(2)}. Motivo: ${motivo}`;

    await patchNotaInternaOrden(id, nuevaNota);
    alert('Devolución registrada exitosamente en la Nota Interna de la orden original.');
    document.getElementById('modal-garantia-devolucion').classList.remove('active');
    await cargarDatos();
  } catch (err) {
    alert('Error al registrar la devolución: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function abrirEditarOrden(id) {
  try {
    const o = await getOrden(id);
    if (!o) return;
    
    // Cerrar detalle modal si estaba abierto
    cerrarModalDetalle();

    editingOrderId = o.id;
    isSignatureModified = false;

    // Actualizar título y botón
    const titleEl = document.getElementById('modal-nueva-orden-title');
    if (titleEl) titleEl.textContent = `Editar Orden de Servicio: OS-${o.id}`;
    const saveBtn = document.getElementById('btn-save-ord');
    if (saveBtn) saveBtn.textContent = '💾 Guardar Cambios';

    const modal = document.getElementById('modal-nueva-orden');
    const form = document.getElementById('form-nueva-orden');
    form.reset();

    // Llenar datos del Paso 1
    const cliSelect = document.getElementById('cli-select-id');
    if (cliSelect) {
      cliSelect.value = o.cliente_id ? String(o.cliente_id) : '';
    }
    const cliSearch = document.getElementById('cli-search-input');
    if (cliSearch) {
      cliSearch.value = o.cliente || '';
      // Filtrar visualmente la lista de opciones sin auto-seleccionar
      const q = cliSearch.value.toLowerCase().trim();
      if (cliSelect) {
        Array.from(cliSelect.options).forEach(opt => {
          opt.style.display = (!q || opt.textContent.toLowerCase().includes(q) || !opt.value) ? '' : 'none';
        });
      }
    }
    
    // Filtrar vehículos para ese cliente y setear el vehículo
    filtrarVehiculosPorCliente();
    const vehSelect = document.getElementById('veh-select-id');
    if (vehSelect) {
      vehSelect.value = o.vehiculo_id ? String(o.vehiculo_id) : '';
      autoAsignarClienteYKm();
    }

    const kmInput = document.getElementById('ord-km');
    if (kmInput) kmInput.value = o.kilometraje || '';

    // Diagnóstico OBJ
    let diag = null;
    try {
      if (o.diagnostico) {
        diag = typeof o.diagnostico === 'string' ? JSON.parse(o.diagnostico) : o.diagnostico;
      }
    } catch(e) {
      console.error('Error parseando diagnostico para edicion:', e);
    }

    const comprobanteInput = document.getElementById('ord-comprobante-num');
    if (comprobanteInput) {
      comprobanteInput.value = o.comprobante_num || (diag && diag.comprobante_num) || '';
    }

    // Paso 2: Mecánico y Combustible
    const mecSelect = document.getElementById('ord-mecanico');
    if (mecSelect) mecSelect.value = o.mecanico_id ? String(o.mecanico_id) : '';

    // Llenar Conductor
    const hasConductorVal = !!(o.conductor_nombre || o.conductor_doc || o.conductor_telefono);
    const hasConductorInput = document.getElementById('ord-has-conductor');
    if (hasConductorInput) {
      hasConductorInput.checked = hasConductorVal;
      const condFields = document.getElementById('conductor-fields');
      if (condFields) condFields.style.display = hasConductorVal ? 'grid' : 'none';
    }
    const condNombre = document.getElementById('ord-conductor-nombre');
    if (condNombre) condNombre.value = o.conductor_nombre || '';
    const condDoc = document.getElementById('ord-conductor-doc');
    if (condDoc) condDoc.value = o.conductor_doc || '';
    const condTelf = document.getElementById('ord-conductor-telefono');
    if (condTelf) condTelf.value = o.conductor_telefono || '';

    // Llenar Garantia
    const esGarantiaVal = !!o.es_garantia;
    const esGarantiaInput = document.getElementById('ord-es-garantia');
    if (esGarantiaInput) {
      esGarantiaInput.checked = esGarantiaVal;
      const garFields = document.getElementById('garantia-fields');
      if (garFields) garFields.style.display = esGarantiaVal ? 'grid' : 'none';
    }
    const garMec = document.getElementById('ord-mecanico-negligente-id');
    if (garMec) garMec.value = o.mecanico_negligente_id ? String(o.mecanico_negligente_id) : '';
    const garMotivo = document.getElementById('ord-garantia-motivo');
    if (garMotivo) garMotivo.value = o.garantia_motivo || '';

    // Llenar fecha y hora de ingreso
    if (o.fecha_ingreso) {
      const d = new Date(o.fecha_ingreso);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d - tzOffset)).toISOString();
      const fIng = document.getElementById('ord-fecha-ingreso');
      if (fIng) fIng.value = localISOTime.split('T')[0];
      const hIng = document.getElementById('ord-hora-ingreso');
      if (hIng) hIng.value = localISOTime.split('T')[1].substring(0, 5);
    }

    const combustible = o.nivel_combustible || '1/2';
    document.getElementById('ord-combustible').value = combustible;
    document.querySelectorAll('.fuel-btn').forEach(b => {
      const isActive = b.dataset.val === combustible;
      b.classList.toggle('active', isActive);
      b.style.background = isActive ? 'var(--white)' : 'transparent';
      b.style.color = isActive ? 'var(--dark)' : 'var(--slate-4)';
      b.style.fontWeight = isActive ? '800' : '700';
    });

    // Síntomas
    const sintomas = (diag && diag.sintomas) || [];
    document.querySelectorAll('.sintomas-checkbox').forEach(cb => {
      cb.checked = sintomas.includes(cb.dataset.sintoma);
    });

    const otros_sintomas = (diag && diag.otros_sintomas) || o.falla_reportada || '';
    const fallaInput = document.getElementById('ord-falla');
    if (fallaInput) fallaInput.value = otros_sintomas;

    // Servicios adicionales
    const addServices = (diag && diag.servicios_adicionales) || [];
    const lav = document.getElementById('add-lavado');
    if (lav) lav.checked = addServices.includes('Lavado de vehículo') || addServices.includes('add-lavado');
    const ret = document.getElementById('add-retiro-rep');
    if (ret) ret.checked = addServices.includes('Retiro de repuestos usados') || addServices.includes('add-retiro-rep');
    const cliInv = document.getElementById('add-cliente-inv');
    if (cliInv) cliInv.checked = addServices.includes('Cliente participa en inventario') || addServices.includes('add-cliente-inv');

    // Fechas estimadas
    const fEnt = document.getElementById('ord-fecha-entrega-est');
    if (fEnt) fEnt.value = (diag && diag.fecha_estimada) || '';
    const hEnt = document.getElementById('ord-hora-entrega-est');
    if (hEnt) hEnt.value = (diag && diag.hora_estimada) || '';

    // Paso 3: Inventario
    const inventario = (diag && diag.inventario) || {};
    document.querySelectorAll('.inv-checkbox').forEach(cb => {
      cb.checked = !!inventario[cb.dataset.item];
    });

    // Paso 4: Daños y observaciones
    const prRuta = (diag && diag.prueba_ruta) || 'NO';
    document.getElementById('ord-pruebaruta').value = prRuta;
    const isSi = prRuta === 'SI';
    const btnSi = document.getElementById('btn-pruebaruta-si');
    const btnNo = document.getElementById('btn-pruebaruta-no');
    if (btnSi && btnNo) {
      btnSi.className = isSi ? 'active' : '';
      btnSi.style.background = isSi ? 'var(--white)' : 'transparent';
      btnSi.style.color = isSi ? 'var(--dark)' : 'var(--slate-4)';
      btnSi.style.fontWeight = isSi ? '800' : '700';
      btnSi.style.boxShadow = isSi ? 'var(--shadow-sm)' : 'none';

      btnNo.className = !isSi ? 'active' : '';
      btnNo.style.background = !isSi ? 'var(--white)' : 'transparent';
      btnNo.style.color = !isSi ? 'var(--dark)' : 'var(--slate-4)';
      btnNo.style.fontWeight = !isSi ? '800' : '700';
      btnNo.style.boxShadow = !isSi ? 'var(--shadow-sm)' : 'none';
    }

    const obsInput = document.getElementById('ord-observaciones');
    if (obsInput) obsInput.value = (diag && diag.observaciones) || '';

    // Inspector de daños
    const dmgDataStr = JSON.stringify((diag && diag.damage_points) || []);
    document.getElementById('ord-damage-data').value = dmgDataStr;

    if (window.initDamageInspector) {
      window.initDamageInspector();
    }

    // Firma
    const canvas = document.getElementById('signature-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (diag && diag.firma_cliente) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = diag.firma_cliente;
        isCanvasSigned = true;
      } else {
        isCanvasSigned = false;
      }
    }

    if (window.resetStepperForm) window.resetStepperForm();
    modal.classList.add('active');
  } catch(err) {
    alert('Error al cargar la orden para edición: ' + err.message);
  }
}

function filtrarVehiculosPorCliente() {
  const cliSelect = document.getElementById('cli-select-id');
  const vehSelect = document.getElementById('veh-select-id');
  const selectedCliId = cliSelect.value;

  // Resetear vehículo
  vehSelect.innerHTML = '<option value="">-- Seleccionar vehículo --</option>';
  document.getElementById('km-anterior-hint').style.display = 'none';

  if (!selectedCliId) {
    vehSelect.innerHTML = '<option value="">-- Primero selecciona un cliente --</option>';
    vehiculosList.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.dataset.clienteId = v.cliente_id;
      opt.dataset.km = v.km_actual || 0;
      opt.textContent = `${v.placa} — ${v.marca_modelo}`;
      vehSelect.appendChild(opt);
    });
    return;
  }

  const vehiculosDelCliente = vehiculosList.filter(v => String(v.cliente_id) === String(selectedCliId));
  if (vehiculosDelCliente.length === 0) {
    vehSelect.innerHTML = '<option value="">— Este cliente no tiene vehículos registrados —</option>';
    return;
  }

  vehiculosDelCliente.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.dataset.clienteId = v.cliente_id;
    opt.dataset.km = v.km_actual || 0;
    opt.textContent = `${v.placa} — ${v.marca_modelo}`;
    vehSelect.appendChild(opt);
  });

  // Auto-seleccionar si solo hay un vehículo
  if (vehiculosDelCliente.length === 1) {
    vehSelect.value = vehiculosDelCliente[0].id;
    mostrarKmAnterior(vehiculosDelCliente[0].km_actual);
  }
}

function mostrarKmAnterior(km) {
  const hint = document.getElementById('km-anterior-hint');
  const valor = document.getElementById('km-anterior-valor');
  if (km && parseInt(km) > 0) {
    valor.textContent = `${parseInt(km).toLocaleString()} Km`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

function autoAsignarClienteYKm() {
  const selectVeh = document.getElementById('veh-select-id');
  const cliSelect = document.getElementById('cli-select-id');
  const selectedOpt = selectVeh.options[selectVeh.selectedIndex];

  if (!selectedOpt || !selectedOpt.value) {
    cliSelect.value = '';
    cliSelect.disabled = false;
    document.getElementById('km-anterior-hint').style.display = 'none';
    return;
  }

  const clienteId = selectedOpt.dataset.clienteId;
  const km = selectedOpt.dataset.km;

  if (clienteId) {
    cliSelect.value = clienteId;
    cliSelect.disabled = true;
  } else {
    cliSelect.disabled = false;
  }

  mostrarKmAnterior(km);
}

async function guardarNuevaOrden(e) {
  // Funciona como click handler de botón (no como form submit)
  if (e && e.preventDefault) e.preventDefault();

  // Validación final del Paso 1: cliente, vehículo y kilometraje
  const cli = document.getElementById('cli-select-id').value;
  const veh = document.getElementById('veh-select-id').value;
  const km = document.getElementById('ord-km').value;
  if (!cli || !veh || !km || parseInt(km) <= 0) {
    alert('Por favor, completa los datos requeridos en el Paso 1 (Cliente, Vehículo y Kilometraje).');
    if (window.resetStepperForm) window.resetStepperForm();
    return;
  }

  const saveBtn = document.getElementById('btn-save-ord');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Guardando...';
  }

  const sintomas = [];
  document.querySelectorAll('.sintomas-checkbox:checked').forEach(cb => {
    sintomas.push(cb.dataset.sintoma);
  });

  const addServices = [];
  if (document.getElementById('add-lavado')?.checked) addServices.push('Lavado de vehículo');
  if (document.getElementById('add-retiro-rep')?.checked) addServices.push('Retiro de repuestos usados');
  if (document.getElementById('add-cliente-inv')?.checked) addServices.push('Cliente participa en inventario');

  const inventario = {};
  document.querySelectorAll('.inv-checkbox').forEach(cb => {
    inventario[cb.dataset.item] = cb.checked;
  });

  const canvas = document.getElementById('signature-canvas');
  const oExistente = editingOrderId ? ordenesList.find(item => item.id == editingOrderId) : null;
  let firmaExistente = null;
  if (oExistente && oExistente.diagnostico) {
    try {
      const diagExistente = typeof oExistente.diagnostico === 'string' ? JSON.parse(oExistente.diagnostico) : oExistente.diagnostico;
      firmaExistente = diagExistente && diagExistente.firma_cliente;
    } catch (_) {}
  }
  const firma_cliente = isSignatureModified
    ? (isCanvasSigned && canvas ? canvas.toDataURL() : null)
    : (firmaExistente || null);

  const otros_sintomas = document.getElementById('ord-falla')?.value.trim() || '';

  // Datos del inspector de daños
  let damageData = [];
  try {
    const dmgRaw = document.getElementById('ord-damage-data')?.value || '[]';
    damageData = JSON.parse(dmgRaw);
  } catch (_) { damageData = []; }

  // Capturar imagen del canvas de daños si tiene puntos
  let damageImage = null;
  const damageCanvas = document.getElementById('damage-canvas');
  if (damageData.length > 0 && damageCanvas) {
    damageImage = damageCanvas.toDataURL();
  }

  const diagnosticoObj = {
    sintomas,
    otros_sintomas,
    servicios_adicionales: addServices,
    inventario,
    prueba_ruta: document.getElementById('ord-pruebaruta')?.value || 'NO',
    observaciones: document.getElementById('ord-observaciones')?.value.trim() || '',
    firma_cliente,
    fecha_estimada: document.getElementById('ord-fecha-entrega-est')?.value || '',
    hora_estimada: document.getElementById('ord-hora-entrega-est')?.value || '',
    comprobante_num: document.getElementById('ord-comprobante-num')?.value.trim() || '',
    damage_points: damageData,
    damage_image: damageImage
  };

  const fallasText = [
    sintomas.length > 0 ? `SÍNTOMAS: ${sintomas.join(', ')}` : '',
    otros_sintomas ? `DETALLE: ${otros_sintomas}` : ''
  ].filter(Boolean).join('\n') || 'Ninguno indicado';

  const fechaIngresoInput = document.getElementById('ord-fecha-ingreso')?.value || '';
  const horaIngresoInput = document.getElementById('ord-hora-ingreso')?.value || '';
  let fecha_ingreso_val = null;
  if (fechaIngresoInput && horaIngresoInput) {
    const [yy, mm, dd] = fechaIngresoInput.split('-').map(Number);
    const [hh, min] = horaIngresoInput.split(':').map(Number);
    const parsedDate = new Date(yy, mm - 1, dd, hh, min, 0);
    fecha_ingreso_val = parsedDate.toISOString();
  }

  const hasConductor = document.getElementById('ord-has-conductor')?.checked || false;
  const es_garantia = document.getElementById('ord-es-garantia')?.checked || false;

  const data = {
    vehiculo_id: parseInt(document.getElementById('veh-select-id').value),
    cliente_id: parseInt(document.getElementById('cli-select-id').value),
    mecanico_id: parseInt(document.getElementById('ord-mecanico').value) || null,
    kilometraje: parseInt(document.getElementById('ord-km').value),
    nivel_combustible: document.getElementById('ord-combustible').value,
    falla_reportada: fallasText,
    diagnostico: diagnosticoObj,
    fecha_ingreso: fecha_ingreso_val,
    
    // New fields
    conductor_nombre: hasConductor ? document.getElementById('ord-conductor-nombre')?.value.trim() || null : null,
    conductor_doc: hasConductor ? document.getElementById('ord-conductor-doc')?.value.trim() || null : null,
    conductor_telefono: hasConductor ? document.getElementById('ord-conductor-telefono')?.value.trim() || null : null,
    es_garantia,
    garantia_motivo: es_garantia ? document.getElementById('ord-garantia-motivo')?.value.trim() || null : null,
    mecanico_negligente_id: es_garantia ? (parseInt(document.getElementById('ord-mecanico-negligente-id')?.value) || null) : null
  };

  if (editingOrderId) {
    try {
      const updateData = {
        vehiculo_id: data.vehiculo_id,
        cliente_id: data.cliente_id,
        mecanico_id: data.mecanico_id,
        kilometraje: data.kilometraje,
        nivel_combustible: data.nivel_combustible,
        falla_reportada: data.falla_reportada,
        estado: oExistente ? oExistente.estado : 'Diagnostico',
        repuestos_esperando: oExistente ? oExistente.repuestos_esperando : '',
        fecha_entrega: oExistente ? oExistente.fecha_entrega : null,
        nota_interna: oExistente ? oExistente.nota_interna : '',
        fecha_ingreso: data.fecha_ingreso,
        
        // New fields
        conductor_nombre: data.conductor_nombre,
        conductor_doc: data.conductor_doc,
        conductor_telefono: data.conductor_telefono,
        es_garantia: data.es_garantia,
        garantia_motivo: data.garantia_motivo,
        mecanico_negligente_id: data.mecanico_negligente_id
      };
      
      await updateOrden(editingOrderId, updateData);
      await guardarDiagnosticoOrden(editingOrderId, diagnosticoObj);
      
      cerrarModalNuevaOrden();
      await cargarDatos();
    } catch (err) {
      alert(`Error al guardar cambios de la orden: ${err.message}`);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Guardar Cambios';
      }
    }
    return;
  }

  try {
    await createOrden(data);
    localStorage.removeItem('vargas_nueva_orden_draft'); // Eliminar borrador al guardar con éxito
    cerrarModalNuevaOrden();
    await cargarDatos();
  } catch (err) {
    alert(`Error al registrar la orden: ${err.message}`);
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ Registrar Recepción';
    }
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
      'Entregado': 'badge badge-emerald',
      'No realizo servicio': 'badge badge-slate'
    };
    badge.className = badgeMap[o.estado] || 'badge badge-slate';

    document.getElementById('det-falla').textContent = o.falla_reportada || '—';

    // Conductor info
    const condWrapper = document.getElementById('det-conductor-wrapper');
    if (condWrapper) {
      if (o.conductor_nombre) {
        document.getElementById('det-conductor-nombre').textContent = o.conductor_nombre;
        document.getElementById('det-conductor-doc-tel').textContent = `DNI: ${o.conductor_doc || '—'} | Tel: ${o.conductor_telefono || '—'}`;
        condWrapper.style.display = 'block';
      } else {
        condWrapper.style.display = 'none';
      }
    }

    // Garantia info
    const garWrapper = document.getElementById('det-garantia-wrapper');
    if (garWrapper) {
      if (o.es_garantia) {
        const isAuth = window.isAdminAuthorized && window.isAdminAuthorized();
        const mecLabel = document.getElementById('det-garantia-mecanico');
        const motLabel = document.getElementById('det-garantia-motivo');
        if (isAuth) {
          if (mecLabel) {
            mecLabel.textContent = o.mecanico_negligente || 'No especificado';
            mecLabel.parentNode.style.display = 'block';
          }
          if (motLabel) {
            motLabel.textContent = o.garantia_motivo || 'No especificado';
            motLabel.parentNode.style.display = 'block';
          }
        } else {
          if (mecLabel) mecLabel.parentNode.style.display = 'none';
          if (motLabel) motLabel.parentNode.style.display = 'none';
        }
        garWrapper.classList.remove('hidden');
      } else {
        garWrapper.classList.add('hidden');
      }
    }

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
      tbody.innerHTML = o.items.map(it => {
        const precio = o.es_garantia ? 0.00 : parseFloat(it.precio_unitario);
        const subtotal = o.es_garantia ? 0.00 : (it.cantidad * parseFloat(it.precio_unitario));
        return `
          <tr>
            <td><strong>${it.descripcion}</strong>${it.repuesto_cod ? `<div style="font-size:10px;color:var(--slate-5);font-family:monospace;">SKU: ${it.repuesto_cod}</div>` : ''}</td>
            <td><span class="badge ${it.tipo === 'almacen' ? 'badge-purple' : 'badge-slate'}">${it.tipo === 'almacen' ? 'Repuesto' : 'Mano Obra'}</span></td>
            <td class="text-center font-bold">${it.cantidad}</td>
            <td class="text-right font-mono">S/ ${precio.toFixed(2)}</td>
            <td class="text-right font-mono font-bold">S/ ${subtotal.toFixed(2)}</td>
          </tr>
        `;
      }).join('');
    }

    document.getElementById('det-total').textContent = `S/ ${parseFloat(o.total_estimado || 0).toFixed(2)}`;

    // Asignar eventos de impresión y edición
    document.getElementById('btn-print-nota').onclick = () => imprimirDocumento('nota', o);
    document.getElementById('btn-print-hoja').onclick = () => imprimirDocumento('hoja', o);
    document.getElementById('btn-edit-ord').onclick = () => abrirEditarOrden(o.id);

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
  const chk = document.getElementById('chk-pasar-factura');
  if (chk) chk.checked = true;

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
  const wrpEntregaReal = document.getElementById('wrapper-fecha-entrega-real');
  const oId = document.getElementById('status-orden-id').value;
  const o = ordenesList.find(item => item.id == oId);

  if (est === 'Esperando Repuestos') {
    wrpRepuestos.classList.remove('hidden');
    document.getElementById('status-repuestos-textarea').required = true;
  } else {
    wrpRepuestos.classList.add('hidden');
    document.getElementById('status-repuestos-textarea').required = false;
  }

  if (est === 'Entregado') {
    wrpEntregaReal.classList.remove('hidden');
    const fInput = document.getElementById('status-fecha-entrega-real');
    const hInput = document.getElementById('status-hora-entrega-real');
    if (o && o.fecha_entrega) {
      const d = new Date(o.fecha_entrega);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d - tzOffset)).toISOString();
      fInput.value = localISOTime.split('T')[0];
      hInput.value = localISOTime.split('T')[1].substring(0, 5);
    } else {
      // Ajustar a zona horaria local para pre-llenar fecha y hora
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now - tzOffset)).toISOString();
      fInput.value = localISOTime.split('T')[0];
      hInput.value = localISOTime.split('T')[1].substring(0, 5);
    }
    fInput.required = true;
    hInput.required = true;
  } else {
    wrpEntregaReal.classList.add('hidden');
    document.getElementById('status-fecha-entrega-real').required = false;
    document.getElementById('status-hora-entrega-real').required = false;
  }

  if (est === 'Finalizado' && o && !o.cobro_id) {
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

  let fecha_entrega_val = null;
  if (estado === 'Entregado') {
    const fVal = document.getElementById('status-fecha-entrega-real').value;
    const hVal = document.getElementById('status-hora-entrega-real').value;
    if (fVal && hVal) {
      const [yy, mm, dd] = fVal.split('-').map(Number);
      const [hh, min] = hVal.split(':').map(Number);
      const parsedDate = new Date(yy, mm - 1, dd, hh, min, 0);
      fecha_entrega_val = parsedDate.toISOString();
    }
  }

  const o = ordenesList.find(item => item.id == id);
  if (estado === 'Entregado' && o && o.cobro_estado === 'Pendiente') {
    alert('No se puede marcar como Entregado porque tiene un cobro pendiente en Facturación.');
    return;
  }

  try {
    await cambiarEstado(id, { estado, repuestos_esperando, pasar_facturacion, fecha_entrega: fecha_entrega_val });
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
    if (window.refreshStockAlerts) window.refreshStockAlerts();
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

  const estadosReadOnly = ['Finalizado', 'Entregado', 'No realizo servicio'];
  const esReadOnly = estadosReadOnly.includes(o.estado);

  document.getElementById('costos-orden-id').value = o.id;

  // Mostrar/ocultar panel de solo lectura según estado
  const formAgregarCosto = document.getElementById('form-agregar-costo');
  const diagnosticoBox = document.getElementById('diagnostico-preventivo-box');
  const btnCerrar = document.getElementById('btn-close-costos-cancel');
  const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');

  if (o.estado === 'Diagnostico') {
    btnShareWhatsapp.style.display = 'flex';
    btnShareWhatsapp.onclick = () => {
      let telefonoClean = (o.cliente_telefono || '').replace(/\D/g, '');
      if (telefonoClean.length === 9) {
        telefonoClean = '51' + telefonoClean;
      }
      const msg = `Estimado(a) ${o.cliente || 'Cliente'}, le saludamos de Inversiones y Servicios Vargas E.I.R.L. Cajamarca.

Hemos realizado el diagnóstico de su vehículo ${o.vehiculo || ''} con placa ${o.placa || ''}.

Puede revisar el presupuesto detallado de repuestos/servicios y autorizar digitalmente el inicio de los trabajos ingresando aquí:
${window.location.origin}/confirmar?id=${o.id}

Quedamos atentos a su aprobación para proceder con la reparación.`;

      const url = `https://wa.me/${telefonoClean}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    };
  } else {
    btnShareWhatsapp.style.display = 'none';
  }

  if (esReadOnly) {
    formAgregarCosto.style.display = 'none';
    diagnosticoBox.style.display = 'none';

    // Mostrar banner de solo lectura si no existe aún
    let bannerRO = document.getElementById('costos-readonly-banner');
    if (!bannerRO) {
      bannerRO = document.createElement('div');
      bannerRO.id = 'costos-readonly-banner';
      bannerRO.style.cssText = 'background:#fef3c7;border:1px solid #fde68a;border-radius:var(--radius-md);padding:12px 16px;display:flex;align-items:center;gap:10px;';
      bannerRO.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#d97706" stroke-width="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        <div><p style="font-weight:800;color:#92400e;font-size:12px;">Orden en estado: ${o.estado}</p><p style="font-size:11px;color:#b45309;margin-top:1px;">Esta orden está cerrada. Solo se puede consultar el detalle de insumos registrados.</p></div>
      `;
      formAgregarCosto.parentNode.insertBefore(bannerRO, formAgregarCosto);
    } else {
      bannerRO.style.display = 'flex';
      bannerRO.querySelector('p').textContent = `Orden en estado: ${o.estado}`;
    }
    btnCerrar.textContent = 'Cerrar';
  } else {
    formAgregarCosto.style.display = '';
    document.getElementById('item-tipo').value = 'mano_obra';
    toggleTipoCostoForm();
    const fb = document.getElementById('sug-feedback-msg');
    if (fb) fb.style.display = 'none';
    const v = vehiculosList.find(x => x.placa === o.placa || x.id === o.vehiculo_id);
    renderDiagnosticoPreventivo(v, o.id);
    const bannerRO = document.getElementById('costos-readonly-banner');
    if (bannerRO) bannerRO.style.display = 'none';
    btnCerrar.textContent = 'Terminado';
  }

  await cargarCostosItemsTable(o.id, esReadOnly);
  document.getElementById('modal-costos').classList.add('active');
}

// Mantener compatibilidad con llamadas legacy
window.sugerirConsumible = function(tipo, texto) {
  window.prellenarCostoForm(tipo, 'almacen', texto);
};


async function cargarCostosItemsTable(ordenId, readOnly = false) {
  const o = await getOrden(ordenId);
  const tbody = document.getElementById('tabla-costos-items-body');
  
  if (o.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${readOnly ? 5 : 6}" class="td-empty">No hay insumos ni servicios asociados a esta orden.</td></tr>`;
  } else {
    tbody.innerHTML = o.items.map(it => `
      <tr>
        <td><strong>${it.descripcion}</strong>${it.repuesto_cod ? `<div style="font-size:9px;color:var(--slate-5);font-family:monospace;">SKU: ${it.repuesto_cod}</div>` : ''}</td>
        <td><span class="badge ${it.tipo === 'almacen' ? 'badge-purple' : 'badge-slate'}">${it.tipo === 'almacen' ? 'Repuesto' : 'Mano Obra'}</span></td>
        <td class="text-center font-bold">${it.cantidad}</td>
        <td class="text-right font-mono">S/ ${parseFloat(it.precio_unitario).toFixed(2)}</td>
        <td class="text-right font-mono font-bold">S/ ${(it.cantidad * parseFloat(it.precio_unitario)).toFixed(2)}</td>
        ${!readOnly ? `<td class="text-right">
          <button class="btn-icon btn-delete-item" data-item-id="${it.id}" style="color:#ef4444;" title="Quitar">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>` : ''}
      </tr>
    `).join('');

    if (!readOnly) {
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
}

function toggleTipoCostoForm() {
  const tipo = document.getElementById('item-tipo').value;
  const wrpManual = document.getElementById('wrapper-item-manual');
  const wrpAlmacen = document.getElementById('wrapper-item-almacen');
  const inputManual = document.getElementById('item-desc-manual');
  const selectRepuesto = document.getElementById('item-repuesto-select');
  const searchRepuesto = document.getElementById('item-repuesto-search-input');
  const priceInput = document.getElementById('item-precio');

  if (tipo === 'almacen') {
    wrpManual.classList.add('hidden');
    wrpAlmacen.classList.remove('hidden');
    inputManual.required = false;
    selectRepuesto.required = true;
    if (searchRepuesto) searchRepuesto.focus();
    
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
    // Limpiar buscador y restaurar todas las opciones
    if (searchRepuesto) {
      searchRepuesto.value = '';
      Array.from(selectRepuesto.options).forEach(opt => opt.style.display = '');
    }
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
  
  // Parsear diagnóstico para incluirlo visualmente en los documentos
  let diag = null;
  try {
    if (o.diagnostico) {
      diag = typeof o.diagnostico === 'string' ? JSON.parse(o.diagnostico) : o.diagnostico;
    }
  } catch (e) {
    console.error('Error parseando diagnostico para impresion:', e);
  }

  let estEntregaFormatted = '';
  if (o.estado === 'Entregado' && diag && diag.fecha_estimada) {
    const dateStr = safeFormatDate(diag.fecha_estimada, { day:'numeric', month:'long', year:'numeric' });
    const timeStr = diag.hora_estimada ? ` ${diag.hora_estimada}` : '';
    estEntregaFormatted = `${dateStr}${timeStr}`;
  }

  const dateFormatted = safeFormatDate(o.fecha_ingreso || new Date(), { day:'numeric', month:'long', year:'numeric' });
  const itemsHtml = o.items.map(it => {
    const precio = o.es_garantia ? 0.00 : parseFloat(it.precio_unitario);
    const subtotal = o.es_garantia ? 0.00 : (it.cantidad * parseFloat(it.precio_unitario));
    return `
      <tr>
        <td>${it.descripcion} ${it.repuesto_cod ? `[${it.repuesto_cod}]` : ''}</td>
        <td style="text-align:center;">${it.tipo === 'almacen' ? 'Repuesto' : 'Mano Obra'}</td>
        <td style="text-align:center;">${it.cantidad}</td>
        ${tipo === 'nota' ? `<td style="text-align:right;">S/ ${precio.toFixed(2)}</td>` : ''}
        ${tipo === 'nota' ? `<td style="text-align:right;">S/ ${subtotal.toFixed(2)}</td>` : ''}
      </tr>
    `;
  }).join('');

  let diagnosticoHtml = '';
  if (diag && Object.keys(diag).length > 0 && tipo === 'nota') {
    const ESTADOS_TEXT = {
      ok: '🟢 OK',
      review: '🟡 Revisión',
      repair: '🔴 Crítico',
      na: '⚫ N/A'
    };
    const NOMBRES_COMPONENTE = {
      motor: 'Motor',
      transmision: 'Transmisión',
      direccion: 'Dirección',
      electrico: 'Sis. Eléctrico',
      frenos_del: 'Frenos Del.',
      suspension_del: 'Susp. Delantera',
      frenos_tras: 'Frenos Tras.',
      suspension_tras: 'Susp. Trasera'
    };

    const rows = Object.entries(diag).map(([key, item]) => {
      if (['sintomas', 'otros_sintomas', 'servicios_adicionales', 'inventario', 'prueba_ruta', 'observaciones', 'firma_cliente', 'fecha_estimada', 'hora_estimada', 'comprobante_num', 'damage_points', 'damage_image'].includes(key)) {
        return '';
      }
      const compLabel = NOMBRES_COMPONENTE[key] || key;
      const estadoLabel = item && item.estado ? (ESTADOS_TEXT[item.estado] || ESTADOS_TEXT.na) : ESTADOS_TEXT.na;
      const notas = item ? (item.notes || item.notas || 'Inspeccionado.') : 'Inspeccionado.';
      return `
        <tr style="border-bottom:1px dashed #ccc;">
          <td style="padding:4px 6px;"><strong>${compLabel}</strong></td>
          <td style="padding:4px 6px;text-align:center;font-weight:bold;">${estadoLabel}</td>
          <td style="padding:4px 6px;color:#333;font-size:10px;">${notas}</td>
        </tr>
      `;
    }).filter(Boolean).join('');

    if (rows) {
      diagnosticoHtml = `
        <h4 style="margin:20px 0 5px;text-transform:uppercase;font-size:11px;border-bottom:1px solid #000;padding-bottom:2px;">Ficha de Diagnóstico e Inspección</h4>
        <table class="print-table" style="font-size:10px; width:100%; border-collapse:collapse; margin-bottom:15px;">
          <thead>
            <tr style="background:#f3f4f6; border-bottom:1px solid #000;">
              <th style="padding:4px;text-align:left;width:30%;">Componente</th>
              <th style="padding:4px;text-align:center;width:30%;">Estado</th>
              <th style="padding:4px;text-align:left;width:40%;">Notas / Observación</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }
  }
  let damageSummaryHtml = '';
  if (diag && diag.damage_points && diag.damage_points.length > 0) {
    const VIEW_NAMES = {
      left: 'Lateral Izquierda',
      right: 'Lateral Derecha',
      top: 'Vista Superior',
      front: 'Vista Frontal',
      rear: 'Vista Posterior'
    };
    const DAMAGE_NAMES = {
      Q: 'Quiñado',
      A: 'Abollado',
      R: 'Rayado',
      F: 'Faltante'
    };
    const pointsList = diag.damage_points.map(pt => {
      const typeLabel = DAMAGE_NAMES[pt.type] || pt.type;
      const viewLabel = VIEW_NAMES[pt.view] || pt.view;
      return `<span style="display:inline-block; margin-right: 10px; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:10px; border:1px solid #cbd5e1;">⚠️ ${typeLabel} (${viewLabel})</span>`;
    }).join(' ');

    damageSummaryHtml = `
      <h4 style="margin:15px 0 5px;text-transform:uppercase;font-size:11px;border-bottom:1px solid #000;padding-bottom:2px;">Detalle de Inspección de Carrocería (Daños)</h4>
      <div style="margin:5px 0; line-height:1.6; font-size:10px;">
        ${pointsList}
      </div>
    `;
    if (diag.observaciones) {
      damageSummaryHtml += `<p style="font-size:10px; margin: 5px 0; font-style:italic;"><strong>Obs. Carrocería:</strong> ${diag.observaciones}</p>`;
    }
  }

  if (tipo === 'nota') {
    // 🎫 Ticket Cliente (Nota Interna de Entrega de Vehículo)
    printArea.innerHTML = `
      <div class="print-header" style="text-align:center; margin-bottom:15px;">
        <h2 style="margin:0;text-transform:uppercase;letter-spacing:0.5px;font-size:15px;font-weight:bold;">INVERSIONES Y SERVICIOS VARGAS E.I.R.L.</h2>
        <p style="margin:4px 0 0;font-size:10px;color:#475569;line-height:1.3;">
          📞 076-366683 | 📱 931 163 369 - 976 864 137<br>
          📍 Jr. Reyna Farge N° 648 - Cajamarca | ✉️ inversionesyserviciosvargas@gmail.com
        </p>
        <h3 style="margin:12px 0 0;text-transform:uppercase;font-size:12px;border-top:1px dashed #000;padding-top:8px;font-weight:bold;">Nota Interna de Entrega</h3>
      </div>

      ${o.es_garantia ? `
      <div style="background:#fee2e2; border:1px dashed #fca5a5; color:#991b1b; padding:6px; text-align:center; font-weight:bold; font-size:10px; border-radius:4px; margin-bottom:10px; text-transform:uppercase; line-height:1.2;">
        ⚠️ COMPROBANTE DE GARANTÍA (S/ 0.00)<br>
        <span style="font-size:9px; font-weight:normal;">Mecánico Resp.: ${o.mecanico_negligente || '—'}</span><br>
        <span style="font-size:9px; font-weight:normal; font-style:italic;">Motivo: ${o.garantia_motivo || '—'}</span>
      </div>
      ` : ''}

      <div style="font-size:11px;line-height:1.4;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:15px;background:#f8fafc;padding:8px;border-radius:6px;border:1px solid #e2e8f0;">
        <div><strong>N° Expediente:</strong> OS-${o.id}</div>
        <div><strong>Fecha/Hora Ingreso:</strong> ${safeFormatDateTime(o.fecha_ingreso)}</div>
        <div><strong>Cliente / RS:</strong> ${o.cliente}</div>
        <div><strong>DNI/RUC:</strong> ${o.num_doc || '—'}</div>
        <div style="grid-column: span 2;"><strong>Vehículo:</strong> ${o.vehiculo} (Placa: <strong style="font-family:monospace;font-size:11px;">${o.placa}</strong>)</div>
        <div><strong>Kilometraje:</strong> ${o.kilometraje ? o.kilometraje.toLocaleString() : '0'} Km</div>
        <div><strong>Combustible:</strong> ${o.nivel_combustible || '—'}</div>
        ${estEntregaFormatted ? `<div><strong>Est. Entrega:</strong> ${estEntregaFormatted}</div>` : ''}
        ${o.fecha_entrega ? `<div><strong>Salida Real:</strong> ${safeFormatDateTime(o.fecha_entrega)}</div>` : ''}
        ${o.conductor_nombre ? `
        <div style="grid-column: span 2; border-top:1px dashed #ccc; padding-top:4px; margin-top:4px;">
          <strong>🚗 Conductor que entrega:</strong> ${o.conductor_nombre} ${o.conductor_doc ? `(DNI: ${o.conductor_doc})` : ''}
        </div>
        ` : ''}
      </div>

      <h4 style="margin:15px 0 5px;text-transform:uppercase;font-size:11px;border-bottom:1px solid #000;padding-bottom:2px;">Trabajos y Repuestos Detallados</h4>
      <table class="print-table" style="font-size:10px;width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:1px solid #000;">
            <th style="padding:4px;text-align:left;">Concepto / Producto</th>
            <th style="padding:4px;text-align:center;width:15%;">Tipo</th>
            <th style="padding:4px;text-align:center;width:10%;">Cant.</th>
            <th style="padding:4px;text-align:right;width:15%;">Unit.</th>
            <th style="padding:4px;text-align:right;width:15%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="5" style="text-align:center;padding:8px;">No se registraron costos asociados.</td></tr>'}
        </tbody>
      </table>

      <div style="text-align:right;margin-top:5px;font-size:12px;font-weight:bold;border-top:1px double #000;padding-top:4px;margin-bottom:15px;">
        TOTAL ESTIMADO: S/ ${parseFloat(o.total_estimado || 0).toFixed(2)}
      </div>

      ${damageSummaryHtml}
      ${diagnosticoHtml}

      <!-- Firmas en Nota Interna -->
      <div class="vargas-print-signatures" style="margin-top:60px; margin-bottom: 25px; display:flex; justify-content:space-between; gap: 20px;">
        <div class="vargas-print-sig-box" style="flex:1; text-align:center; font-size:8.5px; margin-top:25px;">
          <div class="vargas-print-sig-slot" style="height:55px; display:flex; align-items:center; justify-content:center;"></div>
          <div class="vargas-print-sig-line" style="border-top:1px solid #000; padding-top:4px;">
            Firma del Taller Vargas<br>
            <strong>Inversiones y Servicios Vargas</strong>
          </div>
        </div>
        <div class="vargas-print-sig-box" style="flex:1; text-align:center; font-size:8.5px; margin-top:25px;">
          <div class="vargas-print-sig-slot" style="height:55px; display:flex; align-items:center; justify-content:center;">
            ${diag && diag.firma_cliente ? `<img src="${diag.firma_cliente}" class="vargas-print-sig-img" style="max-height:50px; display:block; margin:0 auto;" alt="Firma Cliente" />` : ''}
          </div>
          <div class="vargas-print-sig-line" style="border-top:1px solid #000; padding-top:4px;">
            Firma de Conformidad ${o.conductor_nombre ? 'Conductor (Físico)' : 'Cliente'}<br>
            <strong>DNI/RUC:</strong> ${o.conductor_nombre ? (o.conductor_doc || '___________________') : (o.num_doc || '___________________')}
          </div>
        </div>
      </div>

      <div style="font-size:9px;margin-top:45px;text-align:center;border-top:1px dashed #000;padding-top:8px;color:#475569;">
        <p>El vehículo se entrega a conformidad en sus componentes mecánicos y de carrocería reportados.</p>
        <p style="margin-top:3px;font-weight:bold;color:#0f172a;">¡Gracias por su confianza en Taller Vargas!</p>
      </div>
    `;
  } else {
    // 🖨️ Hoja Técnica de Taller (Orden de Servicio)
    const categoriasInventario = [
      {
        nombre: "Documentación y Llaves",
        items: ['Llave principal', 'Llavero', 'Tarjeta de Propiedad', 'SOAT', 'Manual del vehículo', 'Llave de repuesto', 'Control de alarma', 'Permiso lunas']
      },
      {
        nombre: "Accesorios e Interior",
        items: ['Pisos delanteros', 'Pisos posteriores', 'Espejo retrovisor', 'Claxon', 'Alarma', 'Radio base estación', 'Medidor de presión', 'Encendedor', 'Cargador Usb', 'Cenicero', 'Linterna', 'Autoradio', 'Soporte de celular', 'Adornos colgantes', 'Ambientadores', 'Respaldo de asiento', 'Tapasoles', 'Cámara de retroceso', 'Amplificador de sonido']
      },
      {
        nombre: "Exterior e Iluminación",
        items: ['Espejos laterales', 'Brazos y plumillas', 'Manijas de puertas', 'Luz de freno', 'Faros delanteros', 'Luz faros delanteros', 'Faros posteriores', 'Luz faros posteriores', 'Faros neblineros', 'Luz faros neblineros', 'Luz de placa', 'Antena', 'Antena de radio', 'Emblema delantero', 'Emblema posterior', 'Parabrisas delantero', 'Parabrisas posterior', 'Lunas delanteras', 'Lunas posteriores', 'Lunas de esquina', 'Tapa radiador', 'Tapa combustible']
      },
      {
        nombre: "Seguridad y Herramientas",
        items: ['Batería', 'Computadora', 'Gata y palanca', 'Kit de herramientas', 'Llanta de repuesto', 'Triángulos de seguridad', 'Conos de seguridad', 'Cables de batería', 'Cable de remolque', 'Sogas/Eslingas', 'Bola de remolque', 'Extintor', 'Botiquín', 'Circulina', 'Sirena', 'Pértiga', 'Seguro de ruedas', 'Tacos de seguridad', 'Tapa fusibles']
      }
    ];

    const invItemsHtml = categoriasInventario.map(cat => {
      return cat.items.map(item => {
        const isChecked = (diag && diag.inventario && diag.inventario[item] === true);
        const checkSymbol = isChecked ? 'X' : '&nbsp;';
        return `
          <div class="vargas-print-inv-item">
            <span class="vargas-print-checkbox">${checkSymbol}</span>
            <span>${item}</span>
          </div>
        `;
      }).join('');
    }).join('');

    const damagePoints = diag && diag.damage_points ? diag.damage_points : [];
    const chassisSvg = generatePrintSVG(damagePoints);

    printArea.innerHTML = `
      ${o.es_garantia ? `
      <div style="background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; padding:8px; text-align:center; font-weight:bold; font-size:12px; border-radius:4px; margin-bottom:8px; text-transform:uppercase;">
        ⚠️ ORDEN DE SERVICIO POR GARANTÍA DE NEGLIGENCIA (COSTO AL CLIENTE: S/ 0.00)
        ${o.mecanico_negligente ? `<br><span style="font-size:10px; font-weight:normal;">Mecánico responsable del evento: ${o.mecanico_negligente}</span>` : ''}
        ${o.garantia_motivo ? `<br><span style="font-size:10px; font-weight:normal; font-style:italic;">Motivo: ${o.garantia_motivo}</span>` : ''}
      </div>
      ` : ''}

      <!-- Cabecera Corporativa -->
      <div class="vargas-print-header">
        <div class="vargas-print-logo-wrap">
          <div>
            <h2 class="vargas-print-title">INVERSIONES Y SERVICIOS VARGAS E.I.R.L.</h2>
            <p class="vargas-print-contact">
              📞 076-366683 | 📱 931 163 369 - 976 864 137<br>
              📍 Jr. Reyna Farge N° 648 - Cajamarca | ✉️ inversionesyserviciosvargas@gmail.com
            </p>
          </div>
        </div>
        <div class="vargas-print-number">
          <h3 style="margin: 0; font-size: 11px; text-transform: uppercase;">ORDEN DE SERVICIO</h3>
          <h3 style="color: #ef4444; font-size: 14px; font-weight: 900; margin-top: 2px;">N°: 001 - ${String(o.id).padStart(7, '0')}</h3>
        </div>
      </div>

      <!-- Datos Cliente y Vehículo -->
      <div class="vargas-print-section-title">Datos del Cliente y Vehículo</div>
      <table class="vargas-print-table" style="margin-bottom: 8px;">
        <tbody>
          <tr>
            <td style="width: 50%;"><strong>Nombre / RS:</strong> ${o.cliente || '—'}</td>
            <td style="width: 50%;"><strong>Clase/Tipo:</strong> ${o.vehiculo_clase || '—'}</td>
          </tr>
          ${o.conductor_nombre ? `
          <tr>
            <td colspan="2" style="background:#f8fafc; border-top:1px dashed #cbd5e1; border-bottom:1px dashed #cbd5e1; padding: 4px 8px;">
              <strong>🚗 Conductor que deja el vehículo físicamente:</strong> ${o.conductor_nombre} 
              ${o.conductor_doc ? `&nbsp;&nbsp;&nbsp;&nbsp;<strong>DNI:</strong> ${o.conductor_doc}` : ''}
              ${o.conductor_telefono ? `&nbsp;&nbsp;&nbsp;&nbsp;<strong>Teléfono:</strong> ${o.conductor_telefono}` : ''}
            </td>
          </tr>
          ` : ''}
          <tr>
            <td><strong>Dirección:</strong> ${o.cliente_direccion || '—'}</td>
            <td><strong>Color:</strong> ${o.vehiculo_color || '—'}</td>
          </tr>
          <tr>
            <td><strong>DNI / RUC:</strong> ${o.num_doc || '—'}</td>
            <td><strong>Kilometraje:</strong> ${o.kilometraje ? o.kilometraje.toLocaleString() : '0'} Km</td>
          </tr>
          <tr>
            <td><strong>Teléfono:</strong> ${o.cliente_telefono || '—'}</td>
            <td><strong>Marca / Modelo:</strong> ${o.vehiculo || '—'}</td>
          </tr>
          <tr>
            <td><strong>Fecha/Hora Ingreso:</strong> ${safeFormatDateTime(o.fecha_ingreso)}</td>
            <td><strong>Año / N° Motor:</strong> ${o.anio || '—'} / ${o.vehiculo_motor || '—'}</td>
          </tr>
          <tr>
            <td><strong>Mecánico Asignado:</strong> ${o.mecanico || '—'}</td>
            <td><strong>Placa:</strong> <strong style="font-family: monospace; font-size: 11px;">${o.placa || '—'}</strong></td>
          </tr>
          ${o.estado === 'Entregado' ? `
          <tr>
            <td><strong>F./H. Est. Entrega:</strong> ${estEntregaFormatted}</td>
            <td><strong>F./H. Salida Real:</strong> ${o.fecha_entrega ? safeFormatDateTime(o.fecha_entrega) : ''}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- Inventario de Entrada -->
      <div class="vargas-print-section-title">Inventario de Entrada (Recepcionado)</div>
      <div class="vargas-print-inv-grid">
        ${invItemsHtml}
      </div>

      <!-- Daños, Combustible, Ruta y Síntomas -->
      <div class="vargas-print-section-title">Inspección de Carrocería & Diagnóstico</div>
      <div class="vargas-print-chassis-wrap">
        <div style="font-size: 9px; display: flex; flex-direction: column; gap: 4px;">
          <div>
            <strong>SÍNTOMAS / FALLA REPORTADA:</strong>
            <p style="margin: 2px 0 0 0; font-style: italic; white-space: pre-line; line-height: 1.25;">${o.falla_reportada || 'Ninguno indicado'}</p>
          </div>
          <div style="margin-top: 4px;">
            <strong>SERVICIOS ADICIONALES:</strong>
            <p style="margin: 2px 0 0 0;">${(diag && diag.servicios_adicionales && diag.servicios_adicionales.length > 0) ? diag.servicios_adicionales.join(', ') : 'Ninguno'}</p>
          </div>
          <div style="margin-top: 4px; display: flex; gap: 15px;">
            <div><strong>Prueba de Ruta Autorizada:</strong> ${(diag && diag.prueba_ruta) || 'NO'}</div>
            <div><strong>Combustible:</strong> ${o.nivel_combustible || '—'}</div>
          </div>
        </div>
        <div>
          ${chassisSvg}
          <div style="font-size: 7px; color: #475569; text-align: center; margin-top: 1px; font-weight: bold;">
            Leyenda: Quiñado (Q) | Abollado (A) | Rayado (R) | Faltante (F)
          </div>
          <div style="font-size: 8.5px; margin-top: 3px; line-height: 1.2;">
            <strong>Obs. Carrocería:</strong> ${ (diag && diag.observaciones) || 'Sin observaciones de carrocería.' }
          </div>
        </div>
      </div>

      <!-- Trabajos y Presupuesto -->
      <div class="vargas-print-section-title">Presupuesto Estimado de Trabajos y Repuestos</div>
      <table class="vargas-print-table" style="margin-bottom: 6px;">
        <thead>
          <tr>
            <th style="text-align: left;">Descripción</th>
            <th style="text-align: center; width: 15%;">Tipo</th>
            <th style="text-align: center; width: 10%;">Cant.</th>
            <th style="text-align: right; width: 15%;">P. Unit.</th>
            <th style="text-align: right; width: 15%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${o.items.map(it => `
            <tr>
              <td>${it.descripcion} ${it.repuesto_cod ? `[${it.repuesto_cod}]` : ''}</td>
              <td style="text-align: center;">${it.tipo === 'almacen' ? 'Repuesto' : 'Mano Obra'}</td>
              <td style="text-align: center; font-weight: bold;">${it.cantidad}</td>
              <td style="text-align: right;">S/ ${parseFloat(it.precio_unitario).toFixed(2)}</td>
              <td style="text-align: right; font-weight: bold;">S/ ${(it.cantidad * parseFloat(it.precio_unitario)).toFixed(2)}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align: center;">No se han listado servicios ni repuestos aún.</td></tr>'}
          <tr>
            <td colspan="4" style="text-align: right; font-weight: bold; border-top: 1px double #000; padding: 3px 6px;">TOTAL ESTIMADO:</td>
            <td style="text-align: right; font-weight: bold; font-size: 10px; border-top: 1px double #000; padding: 3px 6px;">S/ ${parseFloat(o.total_estimado || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Cláusulas Legales y Términos -->
      <div class="vargas-print-disclaimer">
        <div>* Autorizo las reparaciones descritas en la orden de servicio.</div>
        <div>* Autorizo las pruebas de ruta necesarias para evaluar el rendimiento y seguridad del vehículo.</div>
        <div>* Acepto que después de 48 horas después de realizarse los trabajos y no retirar la unidad, se pagará la suma de S/ 7.00 (siete con 00/100 soles) al día por el concepto de cochera.</div>
        <div>* Acepto que la empresa no se hace responsable de artículos no declarados.</div>
        <div><strong>* Declaro haber leído y aceptado los términos y condiciones al firmar la orden de servicio.</strong></div>
        <div>* Cualquier trabajo adicional requerirá mi previa aprobación.</div>
      </div>

      <!-- Firmas -->
      <div class="vargas-print-signatures">
        <div class="vargas-print-sig-box">
          <div class="vargas-print-sig-slot">
            ${diag && diag.firma_cliente ? `<img src="${diag.firma_cliente}" class="vargas-print-sig-img" alt="Firma Cliente" />` : ''}
          </div>
          <div class="vargas-print-sig-line">
            Firma de Conformidad ${o.conductor_nombre ? 'Conductor (Físico)' : 'Cliente'}<br>
            <strong>DNI/RUC:</strong> ${o.conductor_nombre ? (o.conductor_doc || '___________________') : (o.num_doc || '___________________')}
          </div>
        </div>
        <div class="vargas-print-sig-box">
          <div class="vargas-print-sig-slot"></div>
          <div class="vargas-print-sig-line">
            Firma Mecánico Responsable<br>
            <strong>Inversiones y Servicios Vargas</strong>
          </div>
        </div>
      </div>
    `;
  }

  // Ejecutar impresión del navegador esperando a que las imágenes se carguen si existen
  const runPrint = () => {
    if (runPrint.executed) return;
    runPrint.executed = true;
    window.print();
    printArea.innerHTML = '';
  };

  const sigImg = printArea.querySelector('.vargas-print-sig-img');
  if (sigImg && !sigImg.complete) {
    sigImg.onload = runPrint;
    sigImg.onerror = runPrint;
    // Timeout de seguridad de 500ms por si el navegador no dispara el evento del data URI
    setTimeout(runPrint, 500);
  } else {
    runPrint();
  }
}

export function destroy() {}
