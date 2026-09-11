import { 
  getMecanicos, 
  getOrdenes, 
  getOrden,
  cambiarEstado, 
  getAlmacenMecanico, 
  crearSolicitudMecanico, 
  guardarDiagnosticoOrden 
} from '../api.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────
// ESTADO LOCAL DEL MÓDULO
// ─────────────────────────────────────────────────────────────
let containerEl = null;
let mecanicosList = [];
let ordenesList = [];
let repuestosAlmacen = [];
let selectedMecanico = null; // { id, nombre }
let viewFilter = 'mis-ordenes'; // 'mis-ordenes' | 'todas'
let selectedOrden = null; // Orden completa bajo edición

// Componentes del Checklist del Auto (8 Zonas)
const COMPONENTES = [
  { key: 'motor', label: 'Motor', x: 150, y: 70 },
  { key: 'transmision', label: 'Transmisión', x: 150, y: 140 },
  { key: 'direccion', label: 'Dirección', x: 110, y: 190 },
  { key: 'electrico', label: 'Sistema Eléctrico', x: 190, y: 190 },
  { key: 'frenos_del', label: 'Frenos Del.', x: 80, y: 120 },
  { key: 'suspension_del', label: 'Suspensión Del.', x: 220, y: 120 },
  { key: 'frenos_tras', label: 'Frenos Tras.', x: 80, y: 290 },
  { key: 'suspension_tras', label: 'Suspensión Tras.', x: 220, y: 290 }
];

const COMPONENTE_METADATA = {
  motor: { label: 'Motor', icon: '⚙️' },
  transmision: { label: 'Transmisión', icon: '🔄' },
  direccion: { label: 'Dirección', icon: '🎡' },
  electrico: { label: 'Sis. Eléctrico', icon: '⚡' },
  frenos_del: { label: 'Frenos Del.', icon: '⭕' },
  suspension_del: { label: 'Susp. Delantera', icon: '〰️' },
  frenos_tras: { label: 'Frenos Tras.', icon: '⭕' },
  suspension_tras: { label: 'Susp. Trasera', icon: '〰️' }
};

const ESTADOS_COMPONENTE = {
  ok:      { label: 'Excelente (OK)', color: '#22c55e', bg: '#14532d', border: '#22c55e', text: '🟢' },
  review:  { label: 'Revisión (Regular)', color: '#eab308', bg: '#713f12', border: '#eab308', text: '🟡' },
  repair:  { label: 'Crítico (Reparar)', color: '#ef4444', bg: '#7f1d1d', border: '#ef4444', text: '🔴' },
  na:      { label: 'No Aplica (N/A)', color: '#94a3b8', bg: '#334155', border: '#94a3b8', text: '⚫' }
};

// Comparador robusto para saber si una orden pertenece al mecánico seleccionado
function esOrdenDeMecanico(o, mec) {
  if (!o || !mec) return false;
  if (o.mecanico_id && mec.id && Number(o.mecanico_id) === Number(mec.id)) {
    return true;
  }
  if (o.mecanico && mec.nombre) {
    const oMec = o.mecanico.trim().toLowerCase();
    const sMec = mec.nombre.trim().toLowerCase();
    return oMec === sMec || oMec.includes(sMec) || sMec.includes(oMec);
  }
  return false;
}

// Sincronización inteligente de sesión con el usuario autenticado
function sincronizarMecanico(mecanicos) {
  const userStr = localStorage.getItem('vargas_user');
  let currentUser = null;
  if (userStr) {
    try { currentUser = JSON.parse(userStr); } catch (_) {}
  }

  // 1. Si el usuario autenticado tiene rol 'operario', forzar SIEMPRE a su perfil propio
  if (currentUser && currentUser.rol === 'operario') {
    const uName = (currentUser.username || '').trim().toLowerCase();
    let match = mecanicos.find(m => (m.nombre || '').trim().toLowerCase() === uName);
    if (!match) {
      match = mecanicos.find(m => {
        const mName = (m.nombre || '').trim().toLowerCase();
        return mName.includes(uName) || uName.includes(mName);
      });
    }

    if (match) {
      selectedMecanico = { id: match.id, nombre: match.nombre };
    } else {
      selectedMecanico = { id: currentUser.id, nombre: currentUser.username };
    }
    localStorage.setItem('taller_mecanico_id', selectedMecanico.id);
    localStorage.setItem('taller_mecanico_nombre', selectedMecanico.nombre);
    return;
  }

  // 2. Si no es operario (admin/recepción), revisar si tenía una selección previa guardada y activa
  const savedId = localStorage.getItem('taller_mecanico_id');
  const savedName = localStorage.getItem('taller_mecanico_nombre');
  if (savedId && savedName) {
    const matchSaved = mecanicos.find(m => m.id === parseInt(savedId) && m.activo);
    if (matchSaved) {
      selectedMecanico = { id: matchSaved.id, nombre: matchSaved.nombre };
      return;
    }
  }

  // 3. Si no hay selección, intentar asociar si coincide el username del usuario
  if (currentUser) {
    const uName = (currentUser.username || '').trim().toLowerCase();
    const match = mecanicos.find(m => (m.nombre || '').trim().toLowerCase() === uName);
    if (match) {
      selectedMecanico = { id: match.id, nombre: match.nombre };
      localStorage.setItem('taller_mecanico_id', match.id);
      localStorage.setItem('taller_mecanico_nombre', match.nombre);
      return;
    }
  }

  selectedMecanico = null;
}

// ─────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────
export async function init(container) {
  containerEl = container;
  
  // Agregar clase CSS especial para forzar el tema industrial oscuro en este portal
  containerEl.classList.add('modo-taller-wrapper');

  // Solo precargar si NO es un usuario operario (los operarios se resuelven de forma estricta en sincronizarMecanico)
  const userStr = localStorage.getItem('vargas_user');
  let isOperario = false;
  try {
    const u = JSON.parse(userStr);
    isOperario = u && u.rol === 'operario';
  } catch (_) {}

  if (!isOperario) {
    const savedId = localStorage.getItem('taller_mecanico_id');
    const savedName = localStorage.getItem('taller_mecanico_nombre');
    if (savedId && savedName) {
      selectedMecanico = { id: parseInt(savedId), nombre: savedName };
    } else {
      selectedMecanico = null;
    }
  } else {
    selectedMecanico = null;
  }

  await cargarDatos();
}

export function destroy() {
  if (containerEl) {
    containerEl.classList.remove('modo-taller-wrapper');
    containerEl = null;
  }
}

// ─────────────────────────────────────────────────────────────
// CARGA DE DATOS
// ─────────────────────────────────────────────────────────────
async function cargarDatos() {
  if (!containerEl) return;
  
  containerEl.innerHTML = `
    <div class="taller-loader">
      <div class="taller-spinner"></div>
      <p>Conectando al Escáner de Taller...</p>
    </div>`;

  try {
    const [mecanicos, ordenes, repuestos] = await Promise.all([
      getMecanicos(),
      getOrdenes(),
      getAlmacenMecanico()
    ]);
    
    mecanicosList = mecanicos.filter(m => m.activo);

    // Sincronización inteligente de sesión con el usuario autenticado
    sincronizarMecanico(mecanicosList);

    // Filtrar órdenes activas (no finalizadas)
    const ESTADOS_ACTIVOS = ['Diagnostico', 'En Proceso', 'Esperando Repuestos'];
    ordenesList = ordenes.filter(o => ESTADOS_ACTIVOS.includes(o.estado));
    repuestosAlmacen = repuestos;

    // Si la orden seleccionada sigue activa, refrescar su información; si no, cerrarla
    if (selectedOrden) {
      const actual = ordenesList.find(o => o.id === selectedOrden.id);
      if (actual) {
        selectedOrden = actual;
      } else {
        selectedOrden = null;
      }
    }

    render();
  } catch (err) {
    containerEl.innerHTML = `
      <div class="taller-error-card">
        <h2>⚠️ Error de Comunicación</h2>
        <p>${err.message}</p>
        <button class="taller-btn-action" id="btn-reintentar-taller">Volver a Intentar</button>
      </div>`;
    document.getElementById('btn-reintentar-taller')?.addEventListener('click', cargarDatos);
  }
}

// ─────────────────────────────────────────────────────────────
// CONTROL DE RENDERIZADO PRINCIPAL
// ─────────────────────────────────────────────────────────────
function render() {
  if (!containerEl) return;

  if (!selectedMecanico) {
    renderSelectorMecanico();
    return;
  }

  if (selectedOrden) {
    renderDetalleOrden();
  } else {
    renderListaTrabajos();
  }
}

// ─────────────────────────────────────────────────────────────
// VISTA: SELECTOR DE MECÁNICO (LOGIN TÁCTIL)
// ─────────────────────────────────────────────────────────────
function renderSelectorMecanico() {
  let cardsHtml = mecanicosList.map(mec => `
    <button class="taller-mecanico-card" data-id="${mec.id}" data-nombre="${mec.nombre}">
      <div class="taller-avatar">🛠️</div>
      <div class="taller-mec-name">${mec.nombre}</div>
      <span class="taller-tag-online">Disponible</span>
    </button>
  `).join('');

  if (mecanicosList.length === 0) {
    cardsHtml = `<p class="taller-empty-msg">No hay mecánicos activos registrados. Agrégalos en el módulo de Operaciones.</p>`;
  }

  containerEl.innerHTML = `
    <div class="taller-login-container">
      <div class="taller-brand-header">
        <h1>SISTEMA DE DIAGNÓSTICO AUTOMOTRIZ</h1>
        <p>TALLER AUTOMOTRIZ VARGAS — MODO TABLET & MÓVIL</p>
      </div>
      
      <div class="taller-login-box">
        <h2>IDENTIFICACIÓN DE MECÁNICO</h2>
        <p class="taller-subtitle">Selecciona tu perfil de taller para comenzar la jornada:</p>
        
        <div class="taller-mecanicos-grid">
          ${cardsHtml}
        </div>

        <div style="margin-top:24px; display:flex; justify-content:center;">
          <button id="btn-login-to-kanban" style="background:transparent; border:1px solid #475569; color:#94a3b8; font-size:12px; font-weight:700; padding:8px 18px; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:6px;">
            📋 Ver Tablero General (Kanban)
          </button>
        </div>
      </div>
    </div>
  `;

  // Event Listeners
  document.getElementById('btn-login-to-kanban')?.addEventListener('click', () => {
    window.navigate('/operaciones');
  });

  containerEl.querySelectorAll('.taller-mecanico-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const nombre = btn.dataset.nombre;
      selectedMecanico = { id: parseInt(id), nombre };
      localStorage.setItem('taller_mecanico_id', id);
      localStorage.setItem('taller_mecanico_nombre', nombre);
      render();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// VISTA: LISTA DE TRABAJOS ACTIVOS
// ─────────────────────────────────────────────────────────────
function renderListaTrabajos() {
  const userStr = localStorage.getItem('vargas_user');
  let isOperario = false;
  try {
    const u = JSON.parse(userStr);
    isOperario = u && u.rol === 'operario';
  } catch (_) {}

  // Filtrar órdenes según pestaña activa
  let filtradas = [];
  if (viewFilter === 'mis-ordenes') {
    filtradas = ordenesList.filter(o => esOrdenDeMecanico(o, selectedMecanico));
  } else {
    filtradas = ordenesList;
  }

  const tabMisActive = viewFilter === 'mis-ordenes' ? 'taller-tab-active' : '';
  const tabTodasActive = viewFilter === 'todas' ? 'taller-tab-active' : '';
  const misOrdenesCount = ordenesList.filter(o => esOrdenDeMecanico(o, selectedMecanico)).length;

  let gridHtml = '';
  if (filtradas.length === 0) {
    gridHtml = `
      <div class="taller-empty-container">
        <div class="taller-empty-icon">🚗💨</div>
        <h3>No hay vehículos asignados</h3>
        <p>${viewFilter === 'mis-ordenes' ? 'No tienes órdenes de servicio asignadas en este momento.' : 'No hay órdenes activas en el taller.'}</p>
      </div>
    `;
  } else {
    gridHtml = `
      <div class="taller-trabajos-grid">
        ${filtradas.map(o => {
          const esMia = esOrdenDeMecanico(o, selectedMecanico);
          const estaEnEspera = o.estado === 'Esperando Repuestos' || Boolean(o.repuestos_esperando);
          let badgeEstado = '';
          if (estaEnEspera) {
            badgeEstado = `<span class="taller-badge badge-espera" title="${escapeHtml(o.repuestos_esperando || '')}">📦 ESPERANDO REPUESTOS</span>`;
          } else if (o.estado === 'Diagnostico') {
            badgeEstado = `<span class="taller-badge badge-diag">🔍 DIAGNÓSTICO</span>`;
          } else if (o.estado === 'En Proceso') {
            badgeEstado = `<span class="taller-badge badge-proceso">⚙️ EN PROCESO</span>`;
          }
          
          return `
            <div class="taller-trabajo-card ${esMia ? 'taller-card-assigned' : ''}" data-id="${o.id}" style="${estaEnEspera ? 'border: 2px solid #f59e0b; box-shadow: 0 4px 14px rgba(245,158,11,0.15);' : ''}">
              <div class="taller-card-header" style="${estaEnEspera ? 'background:#fffbeb;' : ''}">
                <span class="taller-card-placa">${escapeHtml(o.placa || 'SIN PLACA')}</span>
                ${badgeEstado}
              </div>
              
              <div class="taller-card-body">
                <h3>${escapeHtml(o.vehiculo || 'Vehículo')}</h3>
                <div class="taller-card-field">
                  <strong>Cliente:</strong> <span>${escapeHtml(o.cliente || 'No registrado')}</span>
                </div>
                <div class="taller-card-field">
                  <strong>Falla:</strong> <span class="taller-falla-text" title="${escapeHtml(o.falla_reportada || '')}">${escapeHtml(o.falla_reportada || 'Inspección de rutina')}</span>
                </div>
                ${o.repuestos_esperando ? `
                  <div style="font-size:11px; background:#fffbeb; color:#92400e; border:1px solid #fde68a; padding:5px 8px; border-radius:6px; font-weight:700; margin-top:2px;">
                    🛒 ${escapeHtml(o.repuestos_esperando)}
                  </div>
                ` : ''}
                <div class="taller-card-field" style="margin-top:auto;">
                  <strong>Mecánico:</strong> <span class="taller-mec-assigned">${escapeHtml(o.mecanico || '⚠️ Sin Asignar')}</span>
                </div>
              </div>

              <button class="taller-btn-tactile-open" data-id="${o.id}" style="${estaEnEspera ? 'background:#fef3c7; color:#92400e; font-weight:800;' : ''}">
                ${estaEnEspera ? '⏳ VER ESTADO / REANUDAR' : (o.estado === 'Diagnostico' ? '🔧 ATENDER / COMENZAR' : '⚙️ CONTINUAR TRABAJO')}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  containerEl.innerHTML = `
    <div class="taller-portal-layout">
      <!-- Topbar -->
      <div class="taller-topbar">
        <div class="taller-topbar-left">
          <span class="taller-badge-live">ONLINE</span>
          <h2>Panel de Operación Mecánica</h2>
        </div>
        <div class="taller-topbar-right">
          <button class="taller-btn-logout" id="btn-topbar-kanban" style="background:#0284c7; border-color:#0369a1; color:#fff; font-weight:700;">
            📋 Ver Kanban
          </button>
          <div class="taller-user-info">
            <span>Mecánico:</span>
            <strong>${escapeHtml(selectedMecanico ? selectedMecanico.nombre : 'Sin Seleccionar')}</strong>
          </div>
          ${!isOperario ? `<button class="taller-btn-logout" id="btn-logout-taller">Cambiar Mecánico</button>` : ''}
        </div>
      </div>

      <!-- Controles de pestaña -->
      <div class="taller-tabs-container">
        <button class="taller-tab-btn ${tabMisActive}" id="tab-mis-trabajos">
          🛠️ MIS ÓRDENES (${misOrdenesCount})
        </button>
        <button class="taller-tab-btn ${tabTodasActive}" id="tab-todos-trabajos">
          🚗 TODAS LAS ÓRDENES DEL TALLER (${ordenesList.length})
        </button>
        <button class="taller-btn-refrescar" id="btn-refresh-taller">🔄 Refrescar</button>
      </div>

      <!-- Grid de órdenes -->
      <div class="taller-portal-content">
        ${gridHtml}
      </div>
    </div>
  `;

  // Listeners
  document.getElementById('btn-topbar-kanban')?.addEventListener('click', () => {
    window.navigate('/operaciones');
  });

  document.getElementById('btn-logout-taller')?.addEventListener('click', () => {
    localStorage.removeItem('taller_mecanico_id');
    localStorage.removeItem('taller_mecanico_nombre');
    selectedMecanico = null;
    render();
  });

  document.getElementById('tab-mis-trabajos')?.addEventListener('click', () => {
    viewFilter = 'mis-ordenes';
    render();
  });

  document.getElementById('tab-todos-trabajos')?.addEventListener('click', () => {
    viewFilter = 'todas';
    render();
  });

  document.getElementById('btn-refresh-taller')?.addEventListener('click', cargarDatos);

  containerEl.querySelectorAll('.taller-btn-tactile-open, .taller-trabajo-card').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(el.dataset.id);
      const ord = ordenesList.find(o => o.id === id);
      if (ord) {
        selectedOrden = ord;
        render();
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// VISTA: DETALLE DE ORDEN & FLUJO ÁGIL DE TABLET
// ─────────────────────────────────────────────────────────────
function renderDetalleOrden() {
  const o = selectedOrden;
  
  // Parsear diagnóstico JSON
  let diag = {};
  try {
    if (o.diagnostico) {
      diag = typeof o.diagnostico === 'string' ? JSON.parse(o.diagnostico) : o.diagnostico;
    }
  } catch (err) {
    console.error('Error parseando diagnostico JSON:', err);
  }

  // Renderizar la silueta del auto (SVG)
  const svgSilhouette = renderSilhouetteSVG(diag);

  // Armar lista del checklist rápido en texto para el panel
  const checklistTextHtml = COMPONENTES.map(c => {
    const item = diag[c.key] || { estado: 'na', notas: '' };
    const est = ESTADOS_COMPONENTE[item.estado] || ESTADOS_COMPONENTE.na;
    return `
      <div class="taller-chk-row" data-key="${c.key}">
        <div class="taller-chk-left">
          <span style="color: ${est.color}; font-size:18px; margin-right:8px;">${est.text}</span>
          <strong>${c.label}</strong>
        </div>
        <div class="taller-chk-right">
          <span class="taller-chk-desc-label" style="background: ${est.bg}; border: 1px solid ${est.border}; color: ${est.color}">
            ${est.label}
          </span>
        </div>
      </div>
    `;
  }).join('');

  const estaEnEspera = o.estado === 'Esperando Repuestos' || Boolean(o.repuestos_esperando);
  let statusColor = '#3b82f6';
  let statusLabel = 'EN PROCESO';

  if (estaEnEspera) {
    statusColor = '#f59e0b';
    statusLabel = 'ESPERANDO REPUESTOS';
  } else if (o.estado === 'Diagnostico') {
    statusColor = '#eab308';
    statusLabel = 'EN DIAGNÓSTICO';
  } else if (o.estado === 'En Proceso') {
    statusColor = '#3b82f6';
    statusLabel = 'EN PROCESO';
  }

  let contextualFlowHtml = '';
  if (o.estado === 'Diagnostico') {
    contextualFlowHtml = `
      <div style="background:#f0fdf4; border:2px solid #22c55e; border-radius:12px; padding:16px 20px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        <div style="flex:1; min-width:240px;">
          <h3 style="margin:0 0 4px 0; color:#15803d; font-size:16px; font-weight:800; display:flex; align-items:center; gap:6px;">
            <span>🚗 Vehículo en Diagnóstico Inicial</span>
          </h3>
          <p style="margin:0; color:#166534; font-size:13px; line-height:1.4;">
            Revisa la falla reportada, solicita repuestos si son necesarios y pulsa <strong>Comenzar Trabajo</strong> para iniciar las tareas en tu bahía.
          </p>
        </div>
        <button id="btn-taller-comenzar" style="background:#16a34a; color:#fff; border:none; padding:13px 24px; border-radius:8px; font-size:14px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(22,163,74,0.3); transition:all 0.15s;">
          ⚙️ Comenzar Trabajo (Pasar a En Proceso)
        </button>
      </div>
    `;
  } else if (estaEnEspera) {
    contextualFlowHtml = `
      <div style="background:#fffbeb; border:2px solid #f59e0b; border-radius:12px; padding:16px 20px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        <div style="flex:1; min-width:240px;">
          <h3 style="margin:0 0 4px 0; color:#b45309; font-size:16px; font-weight:800; display:flex; align-items:center; gap:6px;">
            <span>⏳ Trabajo en Pausa por Repuestos</span>
          </h3>
          <p style="margin:0; color:#92400e; font-size:13px; line-height:1.4;">
            <strong>Repuesto requerido:</strong> ${escapeHtml(o.repuestos_esperando || 'Esperando confirmación o llegada de repuestos.')}
          </p>
        </div>
        <button id="btn-taller-reanudar" style="background:#0284c7; color:#fff; border:none; padding:13px 24px; border-radius:8px; font-size:14px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(2,132,199,0.3); transition:all 0.15s;">
          ▶️ Repuestos Recibidos (Reanudar Trabajo)
        </button>
      </div>
    `;
  } else {
    // En Proceso
    contextualFlowHtml = `
      <div style="background:#eff6ff; border:2px solid #3b82f6; border-radius:12px; padding:16px 20px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        <div style="flex:1; min-width:240px;">
          <h3 style="margin:0 0 4px 0; color:#1d4ed8; font-size:16px; font-weight:800; display:flex; align-items:center; gap:6px;">
            <span>🛠️ Vehículo Activo en Bahía</span>
          </h3>
          <p style="margin:0; color:#1e40af; font-size:13px; line-height:1.4;">
            Reparación en ejecución. Una vez finalizados todos los trabajos mecánicos, pulsa <strong>Finalizar Servicio</strong> para liberarte de la orden y enviarla a Caja.
          </p>
        </div>
        <button id="btn-taller-finalizar" style="background:#10b981; color:#fff; border:none; padding:13px 26px; border-radius:8px; font-size:14px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(16,185,129,0.3); transition:all 0.15s;">
          ✅ Finalizar Servicio (Listo para Cobro y Entrega)
        </button>
      </div>
    `;
  }

  containerEl.innerHTML = `
    <div class="taller-portal-layout" style="max-width:1100px; margin:0 auto; padding-bottom:60px;">
      <!-- Topbar detalle -->
      <div class="taller-topbar-detail" style="margin-bottom:16px;">
        <button class="taller-btn-back" id="btn-back-to-list">⬅️ Volver a mis trabajos</button>
        <div class="taller-detail-title">
          <h2>Orden #${o.id} — <span class="txt-highlight">${escapeHtml(o.placa || 'SIN PLACA')}</span></h2>
          <p>${escapeHtml(o.vehiculo || 'Vehículo')} • ${escapeHtml(o.cliente || 'Cliente')}</p>
        </div>
        <div class="taller-order-status-badge">
          <span>Estado Bahía:</span>
          <strong style="color:${statusColor}">${statusLabel}</strong>
        </div>
      </div>

      <!-- Hero Card del Auto y Falla Reportada -->
      <div class="taller-hero-card" style="background:var(--white); border:1px solid var(--slate-8); border-radius:14px; padding:20px; margin-bottom:18px; box-shadow:var(--shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
          <div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:6px;">
              <span style="font-family:monospace; font-weight:900; font-size:22px; background:var(--dark); color:var(--brand); padding:4px 12px; border-radius:6px; letter-spacing:1px; box-shadow:var(--shadow-sm);">
                ${escapeHtml(o.placa || 'SIN PLACA')}
              </span>
              <span style="font-size:18px; font-weight:800; color:var(--dark);">
                ${escapeHtml(o.vehiculo || 'Vehículo')}
              </span>
            </div>
            <div style="font-size:13px; color:var(--slate-4); display:flex; gap:14px; flex-wrap:wrap;">
              <span>👤 <strong>Cliente:</strong> ${escapeHtml(o.cliente || 'No registrado')}</span>
              ${o.telefono ? `<span>📞 <strong>Tel:</strong> <a href="tel:${escapeHtml(o.telefono)}" style="color:var(--brand); text-decoration:none; font-weight:700;">${escapeHtml(o.telefono)}</a></span>` : ''}
              <span>👨‍🔧 <strong>Mecánico:</strong> <span style="color:#10b981; font-weight:700;">${escapeHtml(o.mecanico || selectedMecanico.nombre)}</span></span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button id="btn-taller-refresh-detail" class="btn-ghost" style="padding:6px 12px; font-size:12px; border:1px solid var(--slate-8); border-radius:6px; cursor:pointer; background:var(--slate-9);">
              🔄 Actualizar Ficha
            </button>
          </div>
        </div>

        <!-- Falla reportada resaltada -->
        <div style="background:#fffbeb; border:1.5px solid #fde68a; border-radius:10px; padding:14px 18px;">
          <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#b45309; letter-spacing:0.5px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <span>🚨 Falla Reportada por el Cliente / Síntoma:</span>
          </div>
          <div style="font-size:15px; font-weight:700; color:#78350f; line-height:1.4;">
            ${escapeHtml(o.falla_reportada || 'Inspección y mantenimiento preventivo general.')}
          </div>
        </div>
      </div>

      <!-- Flujo Inmediato Contextual de 1 Toque -->
      ${contextualFlowHtml}

      <!-- Gestión Táctica de Repuestos -->
      <div style="background:var(--white); border:1px solid var(--slate-8); border-radius:14px; padding:20px; margin-bottom:18px; box-shadow:var(--shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="margin:0 0 3px 0; font-size:15px; font-weight:800; color:var(--dark); display:flex; align-items:center; gap:8px;">
              <span>📦 Repuestos y Piezas Requeridas</span>
            </h3>
            <p style="margin:0; font-size:12px; color:var(--slate-4);">Pide piezas de almacén o reporta compras externas si el taller o el cliente deben conseguirlas fuera.</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="btn-pedir-repuesto" style="padding:10px 16px; font-size:12px; font-weight:800; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; background:#f1f5f9; border:1.5px solid #cbd5e1; color:#0f172a;">
              📦 Pedir de Almacén (Stock)
            </button>
            <button id="btn-pedir-externo-modal" style="padding:10px 16px; font-size:12px; font-weight:800; border-radius:8px; display:flex; align-items:center; gap:6px; cursor:pointer; background:#fef3c7; border:1.5px solid #f59e0b; color:#92400e;">
              🛒 Pedir Pieza Externa / Comprar
            </button>
          </div>
        </div>

        <!-- Indicador de repuesto externo esperando si existe -->
        ${o.repuestos_esperando ? `
          <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:12px 14px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">🛒</span>
              <div>
                <div style="font-size:12px; font-weight:800; color:#92400e;">Repuesto Externo Pendiente:</div>
                <div style="font-size:13px; font-weight:700; color:#78350f;">${escapeHtml(o.repuestos_esperando)}</div>
              </div>
            </div>
            <button id="btn-quitar-espera-repuesto" style="background:#ffffff; border:1px solid #d97706; color:#92400e; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer;">
              ✓ Marcar como Recibido
            </button>
          </div>
        ` : ''}

        <div id="taller-lista-repuestos-container" style="font-size:12px; color:var(--slate-5); padding-top:4px;">
          <em>Cargando lista de repuestos asignados...</em>
        </div>
      </div>

      <!-- Acordeón Desplegable: Peritaje de Carrocería & 8 Zonas -->
      <details class="taller-checklist-accordion" style="background:var(--white); border:1px solid var(--slate-8); border-radius:14px; overflow:hidden; box-shadow:var(--shadow-sm); margin-bottom:24px;">
        <summary style="padding:16px 20px; font-weight:800; font-size:14px; color:var(--dark); cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; background:var(--slate-9); border-bottom:1px solid var(--slate-8);">
          <span style="display:flex; align-items:center; gap:8px;">
            <span>📋 Peritaje de Carrocería & Checklist de Zonas</span>
            <span style="font-size:11px; font-weight:600; color:var(--slate-4); background:var(--slate-8); padding:2px 8px; border-radius:99px;">Opcional</span>
          </span>
          <span style="font-size:12px; font-weight:700; color:var(--slate-4);">Tocar para desplegar silueta ▾</span>
        </summary>
        <div style="padding:20px;">
          <p style="font-size:12px; color:var(--slate-4); margin-top:0; margin-bottom:16px;">
            Utiliza esta silueta táctil para inspeccionar o reportar el estado físico de los componentes del vehículo si realizas un peritaje completo:
          </p>
          <div class="taller-detail-grid">
            <!-- Columna Izquierda: Silueta -->
            <div class="taller-col-silueta">
              <div class="taller-svg-wrapper">
                ${svgSilhouette}
              </div>
              <div class="taller-silueta-legend">
                <span>🟢 Excelente</span>
                <span>🟡 Regular</span>
                <span>🔴 Crítico</span>
                <span>⚫ N/A</span>
              </div>
            </div>
            <!-- Columna Derecha: Resumen y guardar -->
            <div class="taller-col-acciones">
              <div class="taller-checklist-list">
                ${checklistTextHtml}
              </div>
              <button class="taller-btn-save-diagnostico" id="btn-guardar-diagnostico-principal" style="margin-top:14px;">
                💾 GUARDAR Y SINCRONIZAR CHECKLIST
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>

    <!-- Cajón Táctil Inferior (Bottom Drawer) para Diagnóstico de Componente -->
    <div class="taller-drawer-backdrop hidden" id="drawer-backdrop">
      <div class="taller-bottom-drawer" id="component-drawer">
        <div class="taller-drawer-header">
          <div class="taller-drawer-title">
            <span class="taller-drawer-icon" id="drawer-comp-icon">⚙️</span>
            <h3 id="drawer-comp-label">Inspección de Motor</h3>
          </div>
          <button class="taller-drawer-close" id="btn-close-drawer">✕</button>
        </div>
        
        <div class="taller-drawer-body">
          <input type="hidden" id="drawer-comp-key" value="">
          
          <label class="taller-drawer-label">ESTADO DE SALUD:</label>
          <div class="taller-drawer-status-grid">
            <button class="taller-drawer-status-btn btn-state-ok" data-state="ok">
              <span class="bullet">🟢</span>
              <strong>EXCELENTE</strong>
              <small>Sin fallas / Ok</small>
            </button>
            <button class="taller-drawer-status-btn btn-state-review" data-state="review">
              <span class="bullet">🟡</span>
              <strong>REVISIÓN</strong>
              <small>Desgaste / Regular</small>
            </button>
            <button class="taller-drawer-status-btn btn-state-repair" data-state="repair">
              <span class="bullet">🔴</span>
              <strong>CRÍTICO</strong>
              <small>Requiere reparación</small>
            </button>
            <button class="taller-drawer-status-btn btn-state-na" data-state="na">
              <span class="bullet">⚫</span>
              <strong>NO APLICA</strong>
              <small>No inspeccionado</small>
            </button>
          </div>

          <label class="taller-drawer-label mt-4">NOTAS DEL MECÁNICO / DESCRIPCIÓN:</label>
          <textarea class="taller-drawer-textarea" id="drawer-comp-notas" placeholder="Escribe detalles del estado del componente, repuestos sugeridos o fallas encontradas..."></textarea>
          
          <button class="taller-drawer-btn-save" id="btn-save-drawer-component">
            APLICAR DIAGNÓSTICO
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Pedir Repuesto de Almacén -->
    <div class="taller-modal-backdrop hidden" id="modal-repuestos-backdrop">
      <div class="taller-modal">
        <div class="taller-modal-header">
          <h3>📦 Solicitar Repuestos al Almacén</h3>
          <button class="taller-modal-close" id="btn-close-repuestos-modal">✕</button>
        </div>
        <div class="taller-modal-body">
          <div class="taller-search-box">
            <input type="text" id="modal-search-repuesto" placeholder="Buscar repuesto por código o descripción...">
          </div>
          
          <div class="taller-modal-table-wrapper">
            <table class="taller-modal-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Stock</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody id="modal-repuestos-tbody">
                <!-- Se llena con JS -->
              </tbody>
            </table>
          </div>

          <!-- Formulario de Pedido Interno (se activa al seleccionar un item) -->
          <div class="taller-pedir-form hidden" id="pedido-form-box">
            <hr class="taller-divider">
            <h4 id="pedido-repuesto-title">Repuesto: Amortiguador</h4>
            <input type="hidden" id="pedido-repuesto-id" value="">
            
            <div class="taller-pedir-row">
              <label>Cantidad:</label>
              <div class="taller-counter-wrapper">
                <button type="button" class="taller-btn-counter" id="btn-count-minus">-</button>
                <input type="number" id="pedido-cantidad" value="1" min="1" readonly>
                <button type="button" class="taller-btn-counter" id="btn-count-plus">+</button>
              </div>
            </div>
            
            <button class="taller-btn-submit-pedido" id="btn-submit-pedido-almacen">
              ENVIAR SOLICITUD DE REPUESTO
            </button>
          </div>

        </div>
      </div>
    </div>

    <!-- Modal Rápido: Reportar Pieza Externa / Comprar Fuera -->
    <div class="taller-modal-backdrop hidden" id="modal-externo-backdrop">
      <div class="taller-modal" style="max-width:480px;">
        <div class="taller-modal-header" style="background:#fffbeb; border-bottom:1px solid #fef3c7;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">🛒</span>
            <h3 style="margin:0; font-size:16px; font-weight:800; color:#92400e;">Reportar Repuesto Externo</h3>
          </div>
          <button class="taller-modal-close" id="btn-close-externo-modal">✕</button>
        </div>
        <form id="form-pieza-externa">
          <div class="taller-modal-body" style="padding:20px; display:flex; flex-direction:column; gap:16px;">
            <p style="margin:0; font-size:12px; color:#78350f; line-height:1.4; background:#fef3c7; padding:10px 12px; border-radius:6px; border:1px solid #fde68a;">
              💡 Registra las piezas que no están en stock en almacén. La orden se pausará en <strong>"Esperando Repuestos"</strong> con un borde visual en el Kanban hasta que llegue la pieza.
            </p>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:var(--dark); margin-bottom:6px;">
                ¿Qué repuesto o pieza se necesita? *
              </label>
              <input type="text" id="input-pieza-externa" required placeholder="Ej: Bomba de agua, Kit de embrague, etc." class="form-input" style="width:100%; font-size:13px; padding:10px 12px; border:1px solid var(--slate-7); border-radius:8px;" />
            </div>

            <div>
              <label style="display:block; font-size:12px; font-weight:700; color:var(--dark); margin-bottom:6px;">
                ¿Quién gestionará la compra / entrega?
              </label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <label id="lbl-origen-taller" style="display:flex; align-items:center; gap:8px; padding:10px; border:1.5px solid #0284c7; background:#f0f9ff; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; color:#0369a1;">
                  <input type="radio" name="origen-externo" value="[Taller compra]" checked style="accent-color:#0284c7;" />
                  🏢 Taller compra fuera
                </label>
                <label id="lbl-origen-cliente" style="display:flex; align-items:center; gap:8px; padding:10px; border:1.5px solid var(--slate-7); background:var(--white); border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; color:var(--slate-4);">
                  <input type="radio" name="origen-externo" value="[Cliente traerá]" style="accent-color:#0284c7;" />
                  👤 Cliente lo traerá
                </label>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
              <button type="button" class="btn-ghost" id="btn-cancel-externo" style="padding:10px 16px; border:1px solid var(--slate-8); border-radius:8px; cursor:pointer;">
                Cancelar
              </button>
              <button type="submit" id="btn-submit-externo" style="background:#f59e0b; border:none; color:#ffffff; padding:10px 20px; border-radius:8px; font-size:13px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(245,158,11,0.3);">
                ⏸️ Pausar y Guardar Nota
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  // Cargar repuestos asíncronamente
  cargarRepuestosDeOrden(o.id);

  // Event Listeners principales
  document.getElementById('btn-back-to-list')?.addEventListener('click', () => {
    selectedOrden = null;
    render();
  });

  document.getElementById('btn-taller-refresh-detail')?.addEventListener('click', async () => {
    await cargarDatos();
    const fresh = ordenesList.find(x => x.id === o.id);
    if (fresh) {
      selectedOrden = fresh;
      render();
    }
  });

  // Acciones 1-Toque
  document.getElementById('btn-taller-comenzar')?.addEventListener('click', () => actualizarEstadoOrden('En Proceso'));

  document.getElementById('btn-taller-reanudar')?.addEventListener('click', async () => {
    await reanudarTrabajo();
  });

  document.getElementById('btn-quitar-espera-repuesto')?.addEventListener('click', async () => {
    await reanudarTrabajo();
  });

  document.getElementById('btn-taller-finalizar')?.addEventListener('click', () => finalizarServicioCompleto());

  // Modal Repuesto Externo
  const modalExterno = document.getElementById('modal-externo-backdrop');
  const btnPedirExterno = document.getElementById('btn-pedir-externo-modal');
  const btnCloseExterno = document.getElementById('btn-close-externo-modal');
  const btnCancelExterno = document.getElementById('btn-cancel-externo');
  const formExterno = document.getElementById('form-pieza-externa');
  const radTaller = document.querySelector('input[name="origen-externo"][value="[Taller compra]"]');
  const radCliente = document.querySelector('input[name="origen-externo"][value="[Cliente traerá]"]');
  const lblTaller = document.getElementById('lbl-origen-taller');
  const lblCliente = document.getElementById('lbl-origen-cliente');

  const updateRadioStyles = () => {
    if (radTaller && radTaller.checked) {
      if (lblTaller) {
        lblTaller.style.borderColor = '#0284c7';
        lblTaller.style.background = '#f0f9ff';
        lblTaller.style.color = '#0369a1';
      }
      if (lblCliente) {
        lblCliente.style.borderColor = 'var(--slate-7)';
        lblCliente.style.background = 'var(--white)';
        lblCliente.style.color = 'var(--slate-4)';
      }
    } else if (lblCliente) {
      lblCliente.style.borderColor = '#0284c7';
      lblCliente.style.background = '#f0f9ff';
      lblCliente.style.color = '#0369a1';
      if (lblTaller) {
        lblTaller.style.borderColor = 'var(--slate-7)';
        lblTaller.style.background = 'var(--white)';
        lblTaller.style.color = 'var(--slate-4)';
      }
    }
  };

  radTaller?.addEventListener('change', updateRadioStyles);
  radCliente?.addEventListener('change', updateRadioStyles);

  btnPedirExterno?.addEventListener('click', () => {
    modalExterno.classList.remove('hidden');
    const inp = document.getElementById('input-pieza-externa');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
  });

  const closeExterno = () => modalExterno.classList.add('hidden');
  btnCloseExterno?.addEventListener('click', closeExterno);
  btnCancelExterno?.addEventListener('click', closeExterno);

  formExterno?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-pieza-externa');
    const pieza = input ? input.value.trim() : '';
    if (!pieza) {
      alert('Por favor indica qué pieza o repuesto se requiere.');
      return;
    }
    const origenChecked = document.querySelector('input[name="origen-externo"]:checked');
    const origen = origenChecked ? origenChecked.value : '[Taller compra]';
    const notaCompleta = `${origen} ${pieza}`;

    try {
      const res = await cambiarEstado(selectedOrden.id, {
        estado: 'Esperando Repuestos',
        repuestos_esperando: notaCompleta
      });
      selectedOrden.estado = res.estado;
      selectedOrden.repuestos_esperando = res.repuestos_esperando || notaCompleta;
      closeExterno();
      alert(`⏳ Orden pausada en "Esperando Repuestos":\n${notaCompleta}`);
      render();
    } catch (err) {
      alert(`⚠️ Error al reportar repuesto externo: ${err.message}`);
    }
  });

  // Modal Repuestos de Almacén
  const modalRepuestos = document.getElementById('modal-repuestos-backdrop');
  const btnPedirRepuesto = document.getElementById('btn-pedir-repuesto');
  const btnCloseRepuestos = document.getElementById('btn-close-repuestos-modal');
  const searchRepuestoInput = document.getElementById('modal-search-repuesto');

  btnPedirRepuesto?.addEventListener('click', () => {
    modalRepuestos.classList.remove('hidden');
    renderRepuestosTable('');
  });

  btnCloseRepuestos?.addEventListener('click', () => {
    modalRepuestos.classList.add('hidden');
    document.getElementById('pedido-form-box').classList.add('hidden');
  });

  searchRepuestoInput?.addEventListener('input', (e) => {
    renderRepuestosTable(e.target.value);
  });

  const countMinus = document.getElementById('btn-count-minus');
  const countPlus = document.getElementById('btn-count-plus');
  const cantInput = document.getElementById('pedido-cantidad');

  countMinus?.addEventListener('click', () => {
    let val = parseInt(cantInput.value) || 1;
    if (val > 1) cantInput.value = val - 1;
  });

  countPlus?.addEventListener('click', () => {
    let val = parseInt(cantInput.value) || 1;
    const maxStock = parseInt(document.getElementById('pedido-repuesto-id').dataset.stock) || 999;
    if (val < maxStock) cantInput.value = val + 1;
  });

  document.getElementById('btn-submit-pedido-almacen')?.addEventListener('click', async () => {
    const repuestoId = parseInt(document.getElementById('pedido-repuesto-id').value);
    const cantidad = parseInt(cantInput.value) || 1;

    try {
      const data = {
        mecanico_id: selectedMecanico.id,
        orden_id: o.id,
        repuesto_id: repuestoId,
        cantidad: cantidad,
        fecha_entrega: new Date().toISOString().split('T')[0],
        confirmado: false
      };

      await crearSolicitudMecanico(data);
      alert('✅ Solicitud enviada a Almacén. El jefe de almacén confirmará la entrega de las piezas.');
      modalRepuestos.classList.add('hidden');
      document.getElementById('pedido-form-box').classList.add('hidden');
      cargarRepuestosDeOrden(o.id);
    } catch (err) {
      alert(`⚠️ Error al enviar solicitud: ${err.message}`);
    }
  });

  // Event Listeners de Inspección / Silueta (Acordeón)
  containerEl.querySelectorAll('.taller-chk-row').forEach(row => {
    row.addEventListener('click', () => {
      const key = row.dataset.key;
      openComponentDrawer(key, diag);
    });
  });

  containerEl.querySelectorAll('.taller-svg-hotzone').forEach(zone => {
    zone.addEventListener('click', () => {
      const key = zone.dataset.key;
      openComponentDrawer(key, diag);
    });
  });

  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const btnSaveDrawer = document.getElementById('btn-save-drawer-component');
  const drawerStatusBtns = containerEl.querySelectorAll('.taller-drawer-status-btn');
  let activeStateSelection = 'na';

  drawerStatusBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      drawerStatusBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStateSelection = btn.dataset.state;
    });
  });

  btnCloseDrawer?.addEventListener('click', () => {
    drawerBackdrop.classList.add('hidden');
  });

  btnSaveDrawer?.addEventListener('click', async () => {
    const key = document.getElementById('drawer-comp-key').value;
    const notas = document.getElementById('drawer-comp-notas').value;

    diag[key] = {
      estado: activeStateSelection,
      notas: notas
    };

    drawerBackdrop.classList.add('hidden');
    await realizarSincronizacionChecklist(diag);
  });

  document.getElementById('btn-guardar-diagnostico-principal')?.addEventListener('click', async () => {
    await realizarSincronizacionChecklist(diag, true);
  });
}

// ─────────────────────────────────────────────────────────────
// ACCIONES INTERNAS Y SINCRONIZACIÓN
// ─────────────────────────────────────────────────────────────

async function reanudarTrabajo() {
  try {
    const res = await cambiarEstado(selectedOrden.id, { estado: 'En Proceso', repuestos_esperando: '' });
    selectedOrden.estado = res.estado;
    selectedOrden.repuestos_esperando = '';
    alert('▶️ Repuestos recibidos. Orden reanudada a "En Proceso".');
    render();
  } catch (err) {
    alert(`⚠️ Error al reanudar orden: ${err.message}`);
  }
}

async function cargarRepuestosDeOrden(ordenId) {
  const container = document.getElementById('taller-lista-repuestos-container');
  if (!container) return;
  try {
    const freshOrd = await getOrden(ordenId);
    const items = freshOrd.items || [];
    const repuestos = items.filter(it => it.tipo === 'almacen' || it.repuesto_cod);
    if (repuestos.length === 0 && !freshOrd.repuestos_esperando) {
      container.innerHTML = `<span style="color:var(--slate-4); font-size:12px;">No hay repuestos registrados aún en esta orden. Usa los botones superiores para solicitarlos.</span>`;
      return;
    }
    let html = '<div style="display:flex; flex-wrap:wrap; gap:8px;">';
    repuestos.forEach(r => {
      html += `
        <span style="background:var(--slate-9); border:1px solid var(--slate-8); border-radius:6px; padding:6px 12px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
          <span style="color:#10b981; font-weight:800;">${escapeHtml(r.repuesto_cod || 'REP')}</span>
          <span style="color:var(--dark); font-weight:700;">${escapeHtml(r.descripcion)}</span>
          <span style="color:var(--slate-4); font-size:11px;">(Cant: ${r.cantidad})</span>
        </span>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (_) {
    container.innerHTML = `<span style="color:var(--slate-5); font-size:12px;">Usa los botones superiores para pedir piezas de almacén o registrar compras externas.</span>`;
  }
}

async function realizarSincronizacionChecklist(diag, mostrarAlerta = false) {
  try {
    const updated = await guardarDiagnosticoOrden(selectedOrden.id, diag);
    selectedOrden.diagnostico = updated.diagnostico;
    render();
    if (mostrarAlerta) {
      alert('💾 ¡Inspección guardada y sincronizada correctamente en la orden!');
    }
  } catch (err) {
    alert(`⚠️ Error guardando el checklist: ${err.message}`);
  }
}

async function actualizarEstadoOrden(nuevoEstado) {
  try {
    const res = await cambiarEstado(selectedOrden.id, { estado: nuevoEstado });
    selectedOrden.estado = res.estado;
    alert(`🔄 Orden cambiada al estado: ${nuevoEstado}`);
    render();
  } catch (err) {
    alert(`⚠️ Error al cambiar estado: ${err.message}`);
  }
}

async function finalizarServicioCompleto() {
  const confirmar = confirm('¿Confirmas que has FINALIZADO todos los trabajos en este vehículo?\n\nLa orden pasará a "Listo para Entrega" y la cuenta se enviará a Caja para el cobro.');
  if (!confirmar) return;

  try {
    await cambiarEstado(selectedOrden.id, { 
      estado: 'Finalizado',
      pasar_facturacion: true,
      total: selectedOrden.total_estimado 
    });
    alert('🎉 ¡Servicio finalizado con éxito!\nEl vehículo quedó listo para cobro en Caja y entrega.');
    selectedOrden = null;
    await cargarDatos();
  } catch (err) {
    alert(`⚠️ Error al finalizar servicio: ${err.message}`);
  }
}

function openComponentDrawer(key, diag) {
  const comp = COMPONENTE_METADATA[key] || { label: key, icon: '🔧' };
  const item = diag[key] || { estado: 'na', notas: '' };

  document.getElementById('drawer-comp-key').value = key;
  document.getElementById('drawer-comp-label').textContent = `Inspección de ${comp.label}`;
  document.getElementById('drawer-comp-icon').textContent = comp.icon;
  document.getElementById('drawer-comp-notas').value = item.notes || item.notas || '';

  const drawerStatusBtns = containerEl.querySelectorAll('.taller-drawer-status-btn');
  drawerStatusBtns.forEach(btn => {
    if (btn.dataset.state === item.estado) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const drawerBackdrop = document.getElementById('drawer-backdrop');
  drawerBackdrop.classList.remove('hidden');
}

function renderRepuestosTable(searchStr) {
  const searchLower = searchStr.toLowerCase();
  const filtrados = repuestosAlmacen.filter(r => 
    r.codigo.toLowerCase().includes(searchLower) || 
    r.descripcion.toLowerCase().includes(searchLower)
  );

  const tbody = document.getElementById('modal-repuestos-tbody');
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-400">No se encontraron repuestos con stock disponible.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(r => `
    <tr>
      <td class="font-bold text-emerald-400">${r.codigo}</td>
      <td>${r.descripcion}</td>
      <td class="text-center font-bold">${r.stock}</td>
      <td>
        <button class="taller-btn-seleccionar-repuesto" data-id="${r.id}" data-desc="${r.descripcion}" data-stock="${r.stock}">
          Seleccionar
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.taller-btn-seleccionar-repuesto').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const desc = btn.dataset.desc;
      const stock = btn.dataset.stock;

      const formBox = document.getElementById('pedido-form-box');
      formBox.classList.remove('hidden');

      document.getElementById('pedido-repuesto-title').textContent = `Repuesto: ${desc}`;
      const inputId = document.getElementById('pedido-repuesto-id');
      inputId.value = id;
      inputId.dataset.stock = stock;
      document.getElementById('pedido-cantidad').value = "1";
    });
  });
}

function renderSilhouetteSVG(diag) {
  const getFill = (key) => {
    const item = diag[key] || { estado: 'na' };
    const est = ESTADOS_COMPONENTE[item.estado] || ESTADOS_COMPONENTE.na;
    return est.color;
  };

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" class="taller-car-svg">
      <rect width="300" height="400" fill="none" />
      <path d="M 90,80 C 90,50 110,30 150,30 C 190,30 210,50 210,80 L 210,320 C 210,360 190,380 150,380 C 110,380 90,360 90,320 Z" fill="#1e293b" stroke="#475569" stroke-width="3" />
      <path d="M 100,120 Q 150,90 200,120 L 195,140 Q 150,125 105,140 Z" fill="#334155" stroke="#475569" stroke-width="1.5" />
      <path d="M 105,290 Q 150,305 195,290 L 190,305 Q 150,315 110,305 Z" fill="#334155" stroke="#475569" stroke-width="1.5" />
      <rect x="62" y="95" width="25" height="45" rx="5" fill="#0f172a" stroke="#475569" stroke-width="2" />
      <rect x="213" y="95" width="25" height="45" rx="5" fill="#0f172a" stroke="#475569" stroke-width="2" />
      <rect x="62" y="265" width="25" height="45" rx="5" fill="#0f172a" stroke="#475569" stroke-width="2" />
      <rect x="213" y="265" width="25" height="45" rx="5" fill="#0f172a" stroke="#475569" stroke-width="2" />
      <g class="taller-svg-hotzone" data-key="motor">
        <circle cx="150" cy="70" r="28" fill="${getFill('motor')}" fill-opacity="0.35" stroke="${getFill('motor')}" stroke-width="2.5" />
        <circle cx="150" cy="70" r="14" fill="${getFill('motor')}" stroke="#ffffff" stroke-width="1" />
        <text x="150" y="74" font-size="10" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">MTR</text>
      </g>
      <g class="taller-svg-hotzone" data-key="transmision">
        <circle cx="150" cy="150" r="24" fill="${getFill('transmision')}" fill-opacity="0.35" stroke="${getFill('transmision')}" stroke-width="2.5" />
        <circle cx="150" cy="150" r="12" fill="${getFill('transmision')}" stroke="#ffffff" stroke-width="1" />
        <text x="150" y="153" font-size="9" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">TX</text>
      </g>
      <g class="taller-svg-hotzone" data-key="direccion">
        <circle cx="120" cy="205" r="22" fill="${getFill('direccion')}" fill-opacity="0.35" stroke="${getFill('direccion')}" stroke-width="2.5" />
        <circle cx="120" cy="205" r="10" fill="${getFill('direccion')}" stroke="#ffffff" stroke-width="1" />
        <text x="120" y="208" font-size="8" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">DIR</text>
      </g>
      <g class="taller-svg-hotzone" data-key="electrico">
        <circle cx="180" cy="205" r="22" fill="${getFill('electrico')}" fill-opacity="0.35" stroke="${getFill('electrico')}" stroke-width="2.5" />
        <circle cx="180" cy="205" r="10" fill="${getFill('electrico')}" stroke="#ffffff" stroke-width="1" />
        <text x="180" y="208" font-size="8" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">SYS</text>
      </g>
      <g class="taller-svg-hotzone" data-key="frenos_del">
        <circle cx="95" cy="115" r="20" fill="${getFill('frenos_del')}" fill-opacity="0.35" stroke="${getFill('frenos_del')}" stroke-width="2.5" />
        <circle cx="95" cy="115" r="9" fill="${getFill('frenos_del')}" stroke="#ffffff" stroke-width="1" />
        <text x="95" y="118" font-size="7" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">FRD</text>
      </g>
      <g class="taller-svg-hotzone" data-key="suspension_del">
        <circle cx="205" cy="115" r="20" fill="${getFill('suspension_del')}" fill-opacity="0.35" stroke="${getFill('suspension_del')}" stroke-width="2.5" />
        <circle cx="205" cy="115" r="9" fill="${getFill('suspension_del')}" stroke="#ffffff" stroke-width="1" />
        <text x="205" y="118" font-size="7" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">SPD</text>
      </g>
      <g class="taller-svg-hotzone" data-key="frenos_tras">
        <circle cx="95" cy="285" r="20" fill="${getFill('frenos_tras')}" fill-opacity="0.35" stroke="${getFill('frenos_tras')}" stroke-width="2.5" />
        <circle cx="95" cy="285" r="9" fill="${getFill('frenos_tras')}" stroke="#ffffff" stroke-width="1" />
        <text x="95" y="288" font-size="7" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">FRT</text>
      </g>
      <g class="taller-svg-hotzone" data-key="suspension_tras">
        <circle cx="205" cy="285" r="20" fill="${getFill('suspension_tras')}" fill-opacity="0.35" stroke="${getFill('suspension_tras')}" stroke-width="2.5" />
        <circle cx="205" cy="285" r="9" fill="${getFill('suspension_tras')}" stroke="#ffffff" stroke-width="1" />
        <text x="205" y="288" font-size="7" font-family="monospace" font-weight="bold" fill="#ffffff" text-anchor="middle">SPT</text>
      </g>
    </svg>
  `;
}
