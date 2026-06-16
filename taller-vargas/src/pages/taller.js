import { 
  getMecanicos, 
  getOrdenes, 
  cambiarEstado, 
  getAlmacenMecanico, 
  crearSolicitudMecanico, 
  guardarDiagnosticoOrden 
} from '../api.js';

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

// ─────────────────────────────────────────────────────────────
// INIT / DESTROY
// ─────────────────────────────────────────────────────────────
export async function init(container) {
  containerEl = container;
  
  // Agregar clase CSS especial para forzar el tema industrial oscuro en este portal
  containerEl.classList.add('modo-taller-wrapper');

  // Recuperar sesión de mecánico si existe
  const savedId = localStorage.getItem('taller_mecanico_id');
  const savedName = localStorage.getItem('taller_mecanico_nombre');
  if (savedId && savedName) {
    selectedMecanico = { id: parseInt(savedId), nombre: savedName };
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
    // Filtrar órdenes activas (no finalizadas)
    ordenesList = ordenes.filter(o => o.estado !== 'Finalizado' && o.estado !== 'No realizo servicio');
    repuestosAlmacen = repuestos;

    // Si la orden seleccionada sigue activa, refrescar su información
    if (selectedOrden) {
      const actual = ordenes.find(o => o.id === selectedOrden.id);
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
      </div>
    </div>
  `;

  // Event Listeners
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
  // Filtrar órdenes según pestaña activa
  let filtradas = [];
  if (viewFilter === 'mis-ordenes') {
    filtradas = ordenesList.filter(o => o.mecanico === selectedMecanico.nombre);
  } else {
    filtradas = ordenesList;
  }

  const tabMisActive = viewFilter === 'mis-ordenes' ? 'taller-tab-active' : '';
  const tabTodasActive = viewFilter === 'todas' ? 'taller-tab-active' : '';

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
          const esMia = o.mecanico === selectedMecanico.nombre;
          let badgeEstado = '';
          if (o.estado === 'Diagnostico') badgeEstado = `<span class="taller-badge badge-diag">🔍 DIAGNÓSTICO</span>`;
          else if (o.estado === 'En Proceso') badgeEstado = `<span class="taller-badge badge-proceso">⚙️ EN PROCESO</span>`;
          else if (o.estado === 'Esperando Repuestos') badgeEstado = `<span class="taller-badge badge-espera">📦 EN ESPERA</span>`;
          
          return `
            <div class="taller-trabajo-card ${esMia ? 'taller-card-assigned' : ''}" data-id="${o.id}">
              <div class="taller-card-header">
                <span class="taller-card-placa">${o.placa || 'SIN PLACA'}</span>
                ${badgeEstado}
              </div>
              
              <div class="taller-card-body">
                <h3>${o.vehiculo || 'Vehículo Genérico'}</h3>
                <div class="taller-card-field">
                  <strong>Cliente:</strong> <span>${o.cliente || 'No registrado'}</span>
                </div>
                <div class="taller-card-field">
                  <strong>Falla:</strong> <span class="taller-falla-text">${o.falla_reportada || 'Inspección de rutina'}</span>
                </div>
                <div class="taller-card-field">
                  <strong>Mecánico:</strong> <span class="taller-mec-assigned">${o.mecanico || '⚠️ Sin Asignar'}</span>
                </div>
              </div>

              <button class="taller-btn-tactile-open" data-id="${o.id}">
                🔧 DIAGNOSTICAR Y REGISTRAR
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
          <div class="taller-user-info">
            <span>Mecánico:</span>
            <strong>${selectedMecanico.nombre}</strong>
          </div>
          <button class="taller-btn-logout" id="btn-logout-taller">Cambiar Mecánico</button>
        </div>
      </div>

      <!-- Controles de pestaña -->
      <div class="taller-tabs-container">
        <button class="taller-tab-btn ${tabMisActive}" id="tab-mis-trabajos">
          🛠️ MIS ÓRDENES (${ordenesList.filter(o => o.mecanico === selectedMecanico.nombre).length})
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
// VISTA: DETALLE DE ORDEN & SILUETA INTERACTIVA
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

  // Armar lista del checklist rápido en texto para el panel lateral
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

  containerEl.innerHTML = `
    <div class="taller-portal-layout">
      <!-- Topbar detalle -->
      <div class="taller-topbar-detail">
        <button class="taller-btn-back" id="btn-back-to-list">⬅️ Volver al Panel</button>
        <div class="taller-detail-title">
          <h2>Ficha de Inspección: <span class="txt-highlight">${o.placa || 'SIN PLACA'}</span></h2>
          <p>${o.vehiculo || 'Marca y Modelo no detallados'}</p>
        </div>
        <div class="taller-order-status-badge">
          <span>Estado OS:</span>
          <strong>${o.estado.toUpperCase()}</strong>
        </div>
      </div>

      <!-- Panel principal dividido -->
      <div class="taller-detail-grid">
        
        <!-- Columna Izquierda: Silueta e instrucciones -->
        <div class="taller-col-silueta">
          <div class="taller-panel-header">
            <h3>PLANILLA INTERACTIVA DIGITAL</h3>
            <p>Toca cualquiera de las zonas del vehículo para reportar su estado físico:</p>
          </div>
          
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

        <!-- Columna Derecha: Acciones, Repuestos y Checklist -->
        <div class="taller-col-acciones">
          
          <!-- Falla reportada y cliente -->
          <div class="taller-detail-box info-cliente-box">
            <h4>DATOS DEL VEHÍCULO</h4>
            <p><strong>Cliente:</strong> ${o.cliente || 'No registrado'} - ${o.telefono || ''}</p>
            <p><strong>Falla Reportada:</strong> <span class="txt-falla-alert">${o.falla_reportada || 'Inspección preventiva.'}</span></p>
          </div>

          <!-- Acciones de Almacén y Control -->
          <div class="taller-detail-box control-taller-box">
            <h4>FLUJO DE TRABAJO</h4>
            <div class="taller-actions-buttons">
              <button class="taller-btn-ctrl btn-repuestos" id="btn-pedir-repuesto">
                📦 PEDIR REPUESTO AL ALMACÉN
              </button>
              <button class="taller-btn-ctrl btn-proceso-taller" id="btn-poner-proceso">
                ⚙️ MARCAR EN PROCESO
              </button>
              <button class="taller-btn-ctrl btn-espera-taller" id="btn-poner-espera">
                ⏳ ESPERANDO REPUESTOS
              </button>
              <button class="taller-btn-ctrl btn-finalizar-taller" id="btn-poner-finalizado">
                ✅ FINALIZAR SERVICIO
              </button>
            </div>
          </div>

          <!-- Estado del diagnóstico en lista -->
          <div class="taller-detail-box checklist-resumen-box">
            <h4>RESUMEN DEL DIAGNÓSTICO</h4>
            <div class="taller-checklist-list">
              ${checklistTextHtml}
            </div>
            <button class="taller-btn-save-diagnostico" id="btn-guardar-diagnostico-principal">
              💾 GUARDAR Y SINCRONIZAR CHECKLIST
            </button>
          </div>

        </div>
      </div>
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

    <!-- Modal Pedir Repuesto -->
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
  `;

  // Event Listeners para la orden
  document.getElementById('btn-back-to-list')?.addEventListener('click', () => {
    selectedOrden = null;
    render();
  });

  // Escuchar clics en los elementos interactivos del checklist de texto
  containerEl.querySelectorAll('.taller-chk-row').forEach(row => {
    row.addEventListener('click', () => {
      const key = row.dataset.key;
      openComponentDrawer(key, diag);
    });
  });

  // Escuchar clics en los botones interactivos del SVG
  containerEl.querySelectorAll('.taller-svg-hotzone').forEach(zone => {
    zone.addEventListener('click', () => {
      const key = zone.dataset.key;
      openComponentDrawer(key, diag);
    });
  });

  // Controladores del Cajón (Drawer)
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

    // Cerrar cajón
    drawerBackdrop.classList.add('hidden');

    // Sincronizar en el servidor automáticamente
    await realizarSincronizacionChecklist(diag);
  });

  // Acciones de Cambio de Estado de Orden
  document.getElementById('btn-poner-proceso')?.addEventListener('click', () => actualizarEstadoOrden('En Proceso'));
  document.getElementById('btn-poner-espera')?.addEventListener('click', () => actualizarEstadoOrden('Esperando Repuestos'));
  document.getElementById('btn-poner-finalizado')?.addEventListener('click', () => finalizarServicioCompleto());

  // Acción guardar checklist manual
  document.getElementById('btn-guardar-diagnostico-principal')?.addEventListener('click', async () => {
    await realizarSincronizacionChecklist(diag, true);
  });

  // Modal Repuestos
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

  // Cantidades del modal de pedidos
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
      alert('✅ Solicitud enviada a Almacén. Por favor espere que el jefe de almacén entregue el repuesto.');
      modalRepuestos.classList.add('hidden');
      document.getElementById('pedido-form-box').classList.add('hidden');
    } catch (err) {
      alert(`⚠️ Error al enviar solicitud: ${err.message}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// ACCIONES INTERNAS
// ─────────────────────────────────────────────────────────────

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
  const confirmar = confirm('¿Está seguro de marcar este servicio como FINALIZADO? Esto colocará la orden en espera de cobro y notificará al administrador.');
  if (!confirmar) return;

  try {
    const res = await cambiarEstado(selectedOrden.id, { 
      estado: 'Finalizado',
      pasar_facturacion: true,
      total: selectedOrden.total_estimado 
    });
    selectedOrden = null;
    alert('✅ Servicio Finalizado. El vehículo está listo para entrega.');
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
