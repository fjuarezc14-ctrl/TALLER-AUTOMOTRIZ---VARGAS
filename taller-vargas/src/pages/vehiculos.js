import { getVehiculos, getClientes, createVehiculo, updateVehiculo, getHistorial } from '../api.js';

// ── Estado del módulo ─────────────────────────────────────
let containerElement = null;
let vehiculosList    = [];
let clientesList     = [];
let viewMode         = 'cards';  // 'cards' | 'list'

// ── Constantes ────────────────────────────────────────────
const TIPO_ICONS = {
  'Sedán':    '🚗',
  'SUV':      '🚙',
  'Pickup':   '🛻',
  'Camión':   '🚛',
  'Van':      '🚐',
  'Moto':     '🏍️',
  'Otro':     '🚘',
};

const TIPO_ACENT_CLASS = {
  'Sedán':    'tipo-sedan',
  'SUV':      'tipo-suv',
  'Pickup':   'tipo-pickup',
  'Camión':   'tipo-camion',
  'Van':      'tipo-van',
  'Moto':     'tipo-moto',
  'Otro':     '',
};

// ── Inicialización ────────────────────────────────────────
export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="vehiculos-root"></div>`;
  const root = document.getElementById('vehiculos-root');
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
  clientesList  = c;
  renderVehiculos(vehiculosList);
}

// ── Skeleton / Error ──────────────────────────────────────
function renderSkeleton() {
  return `
    <div class="mb-6 flex justify-between items-center">
      <div style="height:24px;width:220px;background:var(--slate-8);border-radius:8px"></div>
      <div style="height:38px;width:280px;background:var(--slate-8);border-radius:8px"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px">
      ${[1,2,3,4,5,6].map(() => `<div style="height:220px;background:var(--white);border-radius:var(--radius-xl);border:1px solid var(--slate-8)"></div>`).join('')}
    </div>
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

// ── Render principal ──────────────────────────────────────
function renderVehiculos(vehiculos) {
  const root = document.getElementById('vehiculos-root');

  root.innerHTML = `
    <!-- Header & Controls -->
    <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Directorio de Vehículos</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">${vehiculos.length} unidades registradas · Base de datos histórica del taller.</p>
      </div>
      <div class="flex items-center gap-3" style="flex-wrap:wrap;">
        <input type="text" id="search-vehiculos" placeholder="Buscar placa, modelo, cliente..." class="form-input" style="width:250px;" />

        <!-- Toggle Vista -->
        <div class="view-toggle">
          <button class="view-toggle-btn ${viewMode==='cards'?'active':''}" id="btn-view-cards" title="Vista Tarjetas">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Tarjetas
          </button>
          <button class="view-toggle-btn ${viewMode==='list'?'active':''}" id="btn-view-list" title="Vista Lista">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
            Lista
          </button>
        </div>

        <button class="btn-primary" id="btn-nuevo-vehiculo-header" style="white-space:nowrap;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
          Nuevo Vehículo
        </button>
      </div>
    </div>

    <!-- Contenedor de vehículos (tarjetas o lista) -->
    <div id="vehiculos-contenedor">
      ${viewMode === 'cards' ? renderGrid(vehiculos) : renderListaTable(vehiculos)}
    </div>

    <!-- Modal Nuevo / Editar Vehículo -->
    ${renderModalVehiculo()}

    <!-- Modal Historial Clínico con Plano -->
    ${renderModalHistorial()}
  `;

  // Registrar Eventos
  document.getElementById('search-vehiculos').addEventListener('input', filtrarVehiculos);
  document.getElementById('btn-nuevo-vehiculo-header').addEventListener('click', () => abrirModalVehiculo());
  document.getElementById('btn-view-cards').addEventListener('click', () => { viewMode='cards'; renderVehiculos(vehiculosList); });
  document.getElementById('btn-view-list').addEventListener('click', () => { viewMode='list'; renderVehiculos(vehiculosList); });

  // Formulario
  document.getElementById('btn-close-veh-modal-x').addEventListener('click', cerrarModalVehiculo);
  document.getElementById('btn-close-veh-modal-cancel').addEventListener('click', cerrarModalVehiculo);
  document.getElementById('form-vehiculo').addEventListener('submit', guardarVehiculo);

  // VIN Decoder
  document.getElementById('veh-vin').addEventListener('input', decodeVIN);

  // Historial
  document.getElementById('btn-close-historial-x').addEventListener('click', cerrarModalHistorial);

  // Delegación de clicks en tarjetas y tabla
  document.getElementById('vehiculos-contenedor').addEventListener('click', (e) => {
    const editBtn  = e.target.closest('.btn-edit-vehiculo');
    const histBtn  = e.target.closest('.btn-history-vehiculo');
    const cardWrap = e.target.closest('.vehiculo-card-hist');

    if (editBtn)  abrirModalVehiculo(editBtn.dataset.id);
    else if (histBtn || cardWrap) {
      const id = (histBtn || cardWrap).dataset.id;
      verHistorial(id);
    }
  });

  const retryBtn = document.getElementById('btn-retry-vehiculos');
  if (retryBtn) retryBtn.addEventListener('click', () => init(containerElement));
}

// ── Vista Tarjetas ────────────────────────────────────────
function renderGrid(vehiculos) {
  if (!vehiculos.length) {
    return `<div style="text-align:center;padding:60px;color:var(--slate-5);font-style:italic;">No se encontraron vehículos</div>`;
  }
  return `<div class="vehiculos-grid">${vehiculos.map(v => renderCard(v)).join('')}</div>`;
}

function renderCard(v) {
  const tipo       = v.tipo_vehiculo || 'Sedán';
  const icon       = TIPO_ICONS[tipo] || '🚘';
  const accentCls  = TIPO_ACENT_CLASS[tipo] || '';
  const lastVisit  = v.ultima_visita
    ? new Date(v.ultima_visita).toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' })
    : '—';

  // Semáforo de mantenimiento (basado en km por componente)
  const semaforo = calcSemaforo(v);

  return `
    <div class="vehiculo-card">
      <div class="vehiculo-card-accent ${accentCls}"></div>
      <div class="vehiculo-card-body">
        <div class="vehiculo-card-header">
          <div>
            <span class="placa-badge" style="font-size:13px;padding:4px 10px;">${v.placa}</span>
            <div class="vehiculo-card-marca" style="margin-top:8px;">${v.marca_modelo}</div>
            <div class="vehiculo-card-sub">${v.anio ? v.anio : '—'} · ${tipo}</div>
          </div>
          <div class="vehiculo-tipo-icon">${icon}</div>
        </div>

        <!-- Specs -->
        <div class="vehiculo-card-specs">
          <div class="spec-item">
            <span class="spec-label">Propietario</span>
            <span class="spec-value" style="font-size:11px;">${v.cliente_nombre || '—'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Última Visita</span>
            <span class="spec-value" style="font-size:11px;">${lastVisit}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Km Actual</span>
            <span class="spec-value">${v.km_actual ? v.km_actual.toLocaleString()+' km' : '—'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Transmisión</span>
            <span class="spec-value">${v.transmision || '—'}</span>
          </div>
        </div>

        <!-- Semáforo Preventivo -->
        <div style="margin-top:10px; border-top:1px dashed var(--slate-8); padding-top:8px;">
          <div style="font-size:9px;font-weight:800;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Salud por Componentes</div>
          <div class="mant-semaforo-grid">
            ${renderMantItem(semaforo.aceite,       '🛢️ Aceite')}
            ${renderMantItem(semaforo.frenos,       '🔩 Frenos')}
            ${renderMantItem(semaforo.bujias,       '⚡ Bujías')}
            ${renderMantItem(semaforo.filtros,      '💨 Filtros')}
            ${renderMantItem(semaforo.liquido,      '💧 Líq. Frenos')}
            ${renderMantItem(semaforo.refrigerante, '❄️ Coolant')}
            ${renderMantItem(semaforo.distribucion, '⛓️ Distrib.')}
          </div>
        </div>
      </div>

      <!-- Acciones -->
      <div class="vehiculo-card-footer">
        <button class="btn-ghost btn-history-vehiculo vehiculo-card-hist" data-id="${v.id}" style="font-size:12px;gap:4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Historial
        </button>
        <button class="btn-primary btn-edit-vehiculo" data-id="${v.id}" style="font-size:12px;gap:4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          Editar
        </button>
      </div>
    </div>
  `;
}

function renderMantItem(status, label) {
  return `
    <div class="mant-item ${status}">
      <div class="mant-dot"></div>
      <span class="mant-label">${label}</span>
    </div>
  `;
}

/**
 * Calcula el semáforo de mantenimiento preventivo basado en la diferencia
 * de km entre el servicio registrado y el km actual.
 * Aceite:    cada 5,000 km | Pastillas: 20,000 km | Bujías: 30,000 km
 */
function calcSemaforo(v) {
  const kmAct = v.km_actual || 0;
  const kmFallback = v.km_ultimo_servicio || 0;

  const getStatus = (kmComponente, limite) => {
    const kmUltimo = (kmComponente !== null && kmComponente !== undefined) ? kmComponente : kmFallback;
    if (!kmAct) return 'unknown';
    const diff = kmAct - kmUltimo;
    if (diff <= 0) return 'ok';
    const pct = diff / limite;
    if (pct < 0.7) return 'ok';
    if (pct < 1.0) return 'warn';
    return 'alert';
  };

  return {
    aceite:       getStatus(v.km_ultimo_aceite, 8000),
    frenos:       getStatus(v.km_ultimo_frenos, 30000),
    bujias:       getStatus(v.km_ultimo_bujias, 40000),
    filtros:      getStatus(v.km_ultimo_filtros, 15000),
    liquido:      getStatus(v.km_ultimo_liquido_frenos, 40000),
    refrigerante: getStatus(v.km_ultimo_refrigerante, 40000),
    distribucion: getStatus(v.km_ultimo_distribucion, 80000)
  };
}

// ── Vista Lista (tabla compacta) ──────────────────────────
function renderListaTable(vehiculos) {
  if (!vehiculos.length) {
    return `<div class="card"><div class="td-empty">No se encontraron vehículos</div></div>`;
  }
  return `
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Marca / Modelo</th>
              <th>Año</th>
              <th>Tipo</th>
              <th>KM Actual</th>
              <th>Propietario</th>
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
  `;
}

function renderTableRows(vehiculos) {
  if (!vehiculos.length) {
    return `<tr><td colspan="8" class="td-empty">No se encontraron vehículos</td></tr>`;
  }
  return vehiculos.map(v => {
    const tipo     = v.tipo_vehiculo || 'Sedán';
    const icon     = TIPO_ICONS[tipo] || '🚘';
    const lastDate = v.ultima_visita ? new Date(v.ultima_visita).toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' }) : '—';
    return `
      <tr>
        <td><span class="placa-badge">${v.placa}</span></td>
        <td><strong style="color:var(--dark);">${v.marca_modelo}</strong></td>
        <td>${v.anio || '—'}</td>
        <td><span title="${tipo}">${icon} ${tipo}</span></td>
        <td>${v.km_actual ? v.km_actual.toLocaleString()+' km' : '—'}</td>
        <td>
          <span style="font-weight:600;color:var(--dark);">${v.cliente_nombre || '—'}</span>
          ${v.cliente_telefono ? `<div style="font-size:11px;color:var(--slate-5);">${v.cliente_telefono}</div>` : ''}
        </td>
        <td>${lastDate}</td>
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

// ── Filtrar ───────────────────────────────────────────────
function filtrarVehiculos() {
  const q = document.getElementById('search-vehiculos').value.toLowerCase().trim();
  const filtrados = vehiculosList.filter(v =>
    v.placa.toLowerCase().includes(q) ||
    v.marca_modelo.toLowerCase().includes(q) ||
    (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(q)) ||
    (v.vin && v.vin.toLowerCase().includes(q))
  );
  const cont = document.getElementById('vehiculos-contenedor');
  cont.innerHTML = viewMode === 'cards' ? renderGrid(filtrados) : renderListaTable(filtrados);
}

// ── Modal Vehiculo ────────────────────────────────────────
function renderModalVehiculo() {
  return `
    <div id="modal-vehiculo" class="modal-overlay">
      <div class="modal modal-lg">
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
        <form id="form-vehiculo" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:18px;">
            <input type="hidden" id="vehiculo-id" />

            <!-- Sección 1: Identificación -->
            <div>
              <div class="form-section-title">🚗 Identificación del Vehículo</div>
              <div class="grid grid-cols-3 gap-3">
                <div class="form-group">
                  <label class="form-label">Placa *</label>
                  <input type="text" id="veh-placa" class="form-input font-mono uppercase font-bold" required placeholder="Ej: ABC-123" />
                </div>
                <div class="form-group">
                  <label class="form-label">Marca / Modelo *</label>
                  <input type="text" id="veh-marca" class="form-input" required placeholder="Ej: Toyota Corolla" />
                </div>
                <div class="form-group">
                  <label class="form-label">Año</label>
                  <input type="number" id="veh-anio" class="form-input" placeholder="Ej: 2020" min="1950" max="2035" />
                </div>
              </div>
            </div>

            <!-- Sección 2: Tipo y Color -->
            <div>
              <div class="form-section-title">🎨 Clasificación</div>
              <div class="grid grid-cols-3 gap-3">
                <div class="form-group">
                  <label class="form-label">Tipo de Vehículo</label>
                  <select id="veh-tipo" class="form-select">
                    <option value="Sedán">Sedán</option>
                    <option value="SUV">SUV</option>
                    <option value="Pickup">Pickup / 4x4</option>
                    <option value="Van">Van / Minivan</option>
                    <option value="Camión">Camión</option>
                    <option value="Moto">Moto</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Color</label>
                  <input type="text" id="veh-color" class="form-input" placeholder="Ej: Blanco Perla" />
                </div>
                <div class="form-group">
                  <label class="form-label">Transmisión</label>
                  <select id="veh-transmision" class="form-select">
                    <option value="">— Seleccionar —</option>
                    <option value="Manual">Manual</option>
                    <option value="Automático">Automático</option>
                    <option value="CVT">CVT</option>
                    <option value="Secuencial">Secuencial</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Sección 3: Motor y VIN -->
            <div>
              <div class="form-section-title">⚙️ Datos Técnicos</div>
              <div class="grid grid-cols-3 gap-3">
                <div class="form-group">
                  <label class="form-label">Tipo de Motor</label>
                  <input type="text" id="veh-tipo-motor" class="form-input" placeholder="Ej: 2.0L Turbo Diesel" />
                </div>
                <div class="form-group">
                  <label class="form-label">N° de Motor</label>
                  <input type="text" id="veh-n-motor" class="form-input font-mono" placeholder="Ej: 4D56U-..." />
                </div>
                <div class="form-group">
                  <label class="form-label">VIN (Nro. Serie) — 17 dígitos</label>
                  <input type="text" id="veh-vin" class="form-input font-mono uppercase" placeholder="Ej: 1HGBH41JXMN109186" maxlength="17" />
                  <div id="vin-decode-result" class="vin-decode-result"></div>
                </div>
              </div>
            </div>

            <!-- Sección 4: Kilometraje e Indicadores -->
            <div>
              <div class="form-section-title">📍 Historial de Kilometrajes por Componente</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">KM Actual (Odómetro) *</label>
                  <input type="number" id="veh-km-actual" class="form-input font-bold" required placeholder="Ej: 45000" min="0" />
                </div>
                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">KM Último Servicio Gral.</label>
                  <input type="number" id="veh-km-ult-serv" class="form-input" placeholder="Ej: 40000" min="0" />
                </div>
                
                <div class="form-group">
                  <label class="form-label">Últ. Aceite (KM)</label>
                  <input type="number" id="veh-km-aceite" class="form-input" placeholder="Ej: 42000" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Últ. Frenos (KM)</label>
                  <input type="number" id="veh-km-frenos" class="form-input" placeholder="Ej: 35000" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Últ. Bujías (KM)</label>
                  <input type="number" id="veh-km-bujias" class="form-input" placeholder="Ej: 30000" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Últ. Filtros (KM)</label>
                  <input type="number" id="veh-km-filtros" class="form-input" placeholder="Ej: 40000" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Últ. Líq. Frenos (KM)</label>
                  <input type="number" id="veh-km-liq-frenos" class="form-input" placeholder="Ej: 30000" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Últ. Refrigerante (KM)</label>
                  <input type="number" id="veh-km-refrigerante" class="form-input" placeholder="Ej: 30000" min="0" />
                </div>
                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">Últ. Distribución (KM)</label>
                  <input type="number" id="veh-km-distribucion" class="form-input" placeholder="Ej: 10000" min="0" />
                </div>
              </div>
            </div>

            <!-- Sección 5: Consumibles Sugeridos -->
            <div>
              <div class="form-section-title">🧼 Ficha Técnica de Consumibles (Sugeridos)</div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
                <div class="form-group">
                  <label class="form-label">Aceite Sugerido</label>
                  <input type="text" id="veh-sug-aceite" class="form-input" placeholder="Ej: 5W-30 Sintético" />
                </div>
                <div class="form-group">
                  <label class="form-label">Refrigerante Sugerido</label>
                  <input type="text" id="veh-sug-refrigerante" class="form-input" placeholder="Ej: Coolant Rojo 50/50" />
                </div>
                <div class="form-group">
                  <label class="form-label">Bujías Sugeridas</label>
                  <input type="text" id="veh-sug-bujias" class="form-input" placeholder="Ej: Iridio NGK" />
                </div>
                <div class="form-group">
                  <label class="form-label">Filtros Sugeridos</label>
                  <input type="text" id="veh-sug-filtros" class="form-input" placeholder="Ej: Filtro Aceite Toyota 90915-YZZD4" />
                </div>
              </div>
            </div>

            <!-- Sección 6: Cliente -->
            <div>
              <div class="form-section-title">👤 Vinculación a Cliente</div>
              <div class="form-group">
                <label class="form-label">Cliente Propietario *</label>
                <select id="veh-cliente-id" class="form-select" required>
                  <option value="">— Seleccionar Cliente —</option>
                  ${clientesList.map(c => `<option value="${c.id}">${c.nombre} (${c.num_doc})</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-veh-modal-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-vehiculo">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Guardar Vehículo
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// ── VIN Decoder ───────────────────────────────────────────
const VIN_WMI = {
  '1HG': 'Honda (USA)',  '1FT': 'Ford Truck (USA)', '1GC': 'GMC (USA)', '1N4': 'Nissan (USA)',
  'JHM': 'Honda (Japón)', 'JT2': 'Toyota (Japón)', 'JN1': 'Nissan (Japón)',
  'WBA': 'BMW (Alemania)', 'WVW': 'Volkswagen (Alemania)', 'WAU': 'Audi (Alemania)',
  'ZFF': 'Ferrari (Italia)', '3VW': 'VW (México)', '8AD': 'VW (Argentina)',
  'KMH': 'Hyundai (Corea)', 'KNA': 'Kia (Corea)',
  'MNT': 'Mitsubishi (Tailandia)', 'MR0': 'Toyota (India)',
  'LFV': 'VW (China)', 'LSG': 'GM (China)',
};

// El estándar VIN usa la posición 10 con un ciclo de 30 años.
// Para uso práctico en talleres (vehículos modernos) priorizamos 1980+:
const VIN_YEARS_MAP = {
  'A':2010,'B':2011,'C':2012,'D':2013,'E':2014,'F':2015,
  'G':2016,'H':2017,'J':2018,'K':2019,'L':2020,'M':2021,
  'N':2022,'P':2023,'R':2024,'S':2025,'T':2026,
  'V':1997,'W':1998,'X':1999,'Y':2000,
  '1':2001,'2':2002,'3':2003,'4':2004,'5':2005,'6':2006,
  '7':2007,'8':2008,'9':2009,
};
function getVINYear(ch) { return VIN_YEARS_MAP[ch] || null; }


async function decodeVIN() {
  const vin = document.getElementById('veh-vin').value.toUpperCase().trim();
  const res  = document.getElementById('vin-decode-result');

  if (vin.length < 3) { res.className = 'vin-decode-result'; return; }

  const wmi    = vin.substring(0,3);
  const localYear = vin.length >= 10 ? getVINYear(vin[9]) : null;
  const localOrigen = VIN_WMI[wmi] || `Fabricante: ${wmi}`;

  // Si no tiene los 17 dígitos, usamos fallback local preliminar
  if (vin.length < 17) {
    const msgs = [];
    if (localOrigen) msgs.push(`🏭 ${localOrigen}`);
    if (localYear)   msgs.push(`📅 Año aprox.: ${localYear}`);
    msgs.push(`⚠️ VIN incompleto (${vin.length}/17 dígitos)`);
    res.textContent = msgs.join('  ·  ');
    res.className = 'vin-decode-result visible';
    
    if (localYear && !document.getElementById('veh-anio').value) {
      document.getElementById('veh-anio').value = localYear;
    }
    return;
  }

  // Con 17 dígitos, intentamos la decodificación por API de la NHTSA
  res.innerHTML = `🔍 Decodificando VIN a través de base de datos internacional... <span class="spinner-small"></span>`;
  res.className = 'vin-decode-result visible info';

  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`);
    if (!response.ok) throw new Error('API offline');

    const data = await response.json();
    const result = data.Results && data.Results[0];

    if (result && result.Make && result.Make.trim() !== "") {
      const make = result.Make.trim();
      const model = result.Model ? result.Model.trim() : '';
      const year = result.ModelYear ? parseInt(result.ModelYear) : null;
      const bodyClass = result.BodyClass ? result.BodyClass.toLowerCase() : '';
      const displacement = result.DisplacementL ? parseFloat(result.DisplacementL).toFixed(1) + 'L' : '';
      const cylinders = result.EngineCylinders ? result.EngineCylinders + 'cil' : '';
      const transmissionStyle = result.TransmissionStyle ? result.TransmissionStyle.toLowerCase() : '';

      // Completar formulario con animación visual
      const triggerFlash = (el) => {
        el.classList.add('flash-success');
        setTimeout(() => el.classList.remove('flash-success'), 1200);
      };

      const modelInput = document.getElementById('veh-marca');
      const yearInput = document.getElementById('veh-anio');
      const motorInput = document.getElementById('veh-tipo-motor');
      const typeSelect = document.getElementById('veh-tipo');
      const transmissionSelect = document.getElementById('veh-transmision');

      if (modelInput && (!modelInput.value || modelInput.value.toLowerCase().includes('corolla') || modelInput.value.toLowerCase().includes('hilux') || modelInput.value === '')) {
        modelInput.value = `${make} ${model}`.trim();
        triggerFlash(modelInput);
      }

      if (year && yearInput && !yearInput.value) {
        yearInput.value = year;
        triggerFlash(yearInput);
      }

      if ((displacement || cylinders) && motorInput && !motorInput.value) {
        motorInput.value = `${displacement} ${cylinders}`.trim();
        triggerFlash(motorInput);
      }

      if (bodyClass && typeSelect) {
        let typeVal = 'Sedán';
        if (bodyClass.includes('suv') || bodyClass.includes('utility')) typeVal = 'SUV';
        else if (bodyClass.includes('pickup') || bodyClass.includes('truck')) typeVal = 'Pickup';
        else if (bodyClass.includes('van') || bodyClass.includes('minivan')) typeVal = 'Van';
        else if (bodyClass.includes('motorcycle')) typeVal = 'Moto';
        else if (bodyClass.includes('sedan') || bodyClass.includes('coupe') || bodyClass.includes('hatchback')) typeVal = 'Sedán';
        else typeVal = 'Otro';

        typeSelect.value = typeVal;
        triggerFlash(typeSelect);
      }

      if (transmissionStyle && transmissionSelect && !transmissionSelect.value) {
        if (transmissionStyle.includes('manual')) transmissionSelect.value = 'Manual';
        else if (transmissionStyle.includes('auto') || transmissionStyle.includes('cvt')) transmissionSelect.value = 'Automático';
        triggerFlash(transmissionSelect);
      }

      // Consumibles sugeridos automáticos según la marca
      let sugAceiteVal = '';
      let sugRefrigVal = '';
      let sugBujiasVal = '';
      let sugFiltrosVal = '';
      
      const makeLower = make.toLowerCase();
      if (makeLower.includes('toyota')) {
        sugAceiteVal = "5W-30 Sintético (SAE GF-6A)";
        sugRefrigVal = "Coolant Rojo Orgánico Toyota SLLC 50/50";
        sugBujiasVal = "Iridio Premium (NGK / Denso)";
        sugFiltrosVal = "Filtro Toyota 90915-YZZD4 / Aire OEM";
      } else if (makeLower.includes('nissan')) {
        sugAceiteVal = "5W-30 Sintético API SP";
        sugRefrigVal = "Coolant Azul Nissan L255";
        sugBujiasVal = "Iridio NGK PLZKAR6A-11";
        sugFiltrosVal = "Filtro de Aceite Nissan 15208-65F0A";
      } else if (makeLower.includes('hyundai') || makeLower.includes('kia')) {
        sugAceiteVal = "5W-30 o 5W-40 Sintético Acea A5/B5";
        sugRefrigVal = "Coolant Verde Orgánico LLC";
        sugBujiasVal = "Bujías Iridio NGK SILZKR7B11";
        sugFiltrosVal = "Filtro Hyundai 26300-35505";
      } else {
        sugAceiteVal = "5W-30 Sintético Multigrado API SP";
        sugRefrigVal = "Coolant Orgánico de Larga Duración 50/50";
        sugBujiasVal = "Bujías Iridio Estándar";
        sugFiltrosVal = "Filtro Aceite / Filtro Aire homologados";
      }
      
      const sugAceiteInput = document.getElementById('veh-sug-aceite');
      const sugRefrigInput = document.getElementById('veh-sug-refrigerante');
      const sugBujiasInput = document.getElementById('veh-sug-bujias');
      const sugFiltrosInput = document.getElementById('veh-sug-filtros');
      
      if (sugAceiteInput && !sugAceiteInput.value) { sugAceiteInput.value = sugAceiteVal; triggerFlash(sugAceiteInput); }
      if (sugRefrigInput && !sugRefrigInput.value) { sugRefrigInput.value = sugRefrigVal; triggerFlash(sugRefrigInput); }
      if (sugBujiasInput && !sugBujiasInput.value) { sugBujiasInput.value = sugBujiasVal; triggerFlash(sugBujiasInput); }
      if (sugFiltrosInput && !sugFiltrosInput.value) { sugFiltrosInput.value = sugFiltrosVal; triggerFlash(sugFiltrosInput); }

      let specsText = `✅ VIN decodificado: ${make} ${model} (${year || '—'}) · Origen: ${localOrigen}`;
      
      res.innerHTML = `
        <div style="margin-bottom:6px; font-weight:800; color:#047857;">${specsText}</div>
        <div class="vin-specs-badge-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: rgba(16,185,129,0.08); padding: 8px; border-radius: 6px; margin-top:6px; font-family:var(--font-sans); border:1px solid rgba(16,185,129,0.2);">
          <div style="font-size:10px;"><span style="color:#64748b;">Motor:</span> <strong style="color:#0f172a;">${displacement || '—'} ${cylinders || ''}</strong></div>
          <div style="font-size:10px;"><span style="color:#64748b;">Transmisión:</span> <strong style="color:#0f172a;">${transmissionStyle ? (transmissionStyle.includes('manual') ? 'Manual' : 'Automático') : '—'}</strong></div>
          <div style="font-size:10px;"><span style="color:#64748b;">Carrocería:</span> <strong style="color:#0f172a; text-transform:capitalize;">${bodyClass || '—'}</strong></div>
          <div style="font-size:10px; grid-column: span 3; border-top: 1px dashed rgba(16,185,129,0.2); padding-top:4px; margin-top:4px;">
            <span style="color:#64748b;">Consumibles Sugeridos:</span><br/>
            <span style="color:#0f172a; font-weight:700;">🛢️ Aceite:</span> ${sugAceiteVal} <br/>
            <span style="color:#0f172a; font-weight:700;">❄️ Coolant:</span> ${sugRefrigVal}
          </div>
        </div>
      `;
      res.className = 'vin-decode-result visible success';
    } else {
      throw new Error('Sin datos en API');
    }
  } catch (err) {
    // Fallback a decodificador estático
    res.textContent = `✅ Origen: ${localOrigen} ${localYear ? ' · Año: '+localYear : ''} (Local Fallback)`;
    res.className = 'vin-decode-result visible success';
    if (localYear && !document.getElementById('veh-anio').value) {
      document.getElementById('veh-anio').value = localYear;
    }
  }
}


// ── Abrir / Cerrar Modal Vehículo ─────────────────────────
function abrirModalVehiculo(id = null) {
  const modal = document.getElementById('modal-vehiculo');
  document.getElementById('form-vehiculo').reset();
  document.getElementById('vin-decode-result').className = 'vin-decode-result';

  const titulo    = document.getElementById('modal-veh-titulo');
  const btnSubmit = document.getElementById('btn-save-vehiculo');

  if (id) {
    const v = vehiculosList.find(item => item.id == id);
    if (!v) return;

    document.getElementById('vehiculo-id').value       = v.id;
    document.getElementById('veh-placa').value         = v.placa;
    document.getElementById('veh-marca').value         = v.marca_modelo;
    document.getElementById('veh-anio').value          = v.anio || '';
    document.getElementById('veh-cliente-id').value   = v.cliente_id || '';
    document.getElementById('veh-tipo').value          = v.tipo_vehiculo || 'Sedán';
    document.getElementById('veh-color').value         = v.color || '';
    document.getElementById('veh-transmision').value   = v.transmision || '';
    document.getElementById('veh-tipo-motor').value    = v.tipo_motor || '';
    document.getElementById('veh-n-motor').value       = v.n_motor || '';
    document.getElementById('veh-vin').value           = v.vin || '';
    document.getElementById('veh-km-actual').value     = v.km_actual || '';
    document.getElementById('veh-km-ult-serv').value   = v.km_ultimo_servicio || '';
    document.getElementById('veh-km-aceite').value      = v.km_ultimo_aceite !== null && v.km_ultimo_aceite !== undefined ? v.km_ultimo_aceite : '';
    document.getElementById('veh-km-frenos').value      = v.km_ultimo_frenos !== null && v.km_ultimo_frenos !== undefined ? v.km_ultimo_frenos : '';
    document.getElementById('veh-km-bujias').value      = v.km_ultimo_bujias !== null && v.km_ultimo_bujias !== undefined ? v.km_ultimo_bujias : '';
    document.getElementById('veh-km-filtros').value     = v.km_ultimo_filtros !== null && v.km_ultimo_filtros !== undefined ? v.km_ultimo_filtros : '';
    document.getElementById('veh-km-liq-frenos').value  = v.km_ultimo_liquido_frenos !== null && v.km_ultimo_liquido_frenos !== undefined ? v.km_ultimo_liquido_frenos : '';
    document.getElementById('veh-km-refrigerante').value= v.km_ultimo_refrigerante !== null && v.km_ultimo_refrigerante !== undefined ? v.km_ultimo_refrigerante : '';
    document.getElementById('veh-km-distribucion').value= v.km_ultimo_distribucion !== null && v.km_ultimo_distribucion !== undefined ? v.km_ultimo_distribucion : '';

    // Sugerencias de consumibles
    document.getElementById('veh-sug-aceite').value     = v.sug_aceite || '';
    document.getElementById('veh-sug-refrigerante').value= v.sug_refrigerante || '';
    document.getElementById('veh-sug-bujias').value     = v.sug_bujias || '';
    document.getElementById('veh-sug-filtros').value    = v.sug_filtros || '';

    if (v.vin) decodeVIN();

    titulo.textContent    = 'Editar Vehículo';
    btnSubmit.innerHTML   = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Actualizar Vehículo`;
  } else {
    document.getElementById('vehiculo-id').value = '';
    titulo.textContent  = 'Nuevo Vehículo';
    btnSubmit.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Vehículo`;
  }

  modal.classList.add('active');
}

function cerrarModalVehiculo() {
  document.getElementById('modal-vehiculo').classList.remove('active');
}

// ── Guardar Vehículo ──────────────────────────────────────
async function guardarVehiculo(e) {
  e.preventDefault();
  const id = document.getElementById('vehiculo-id').value;
  const data = {
    placa:               document.getElementById('veh-placa').value.trim().toUpperCase(),
    marca_modelo:        document.getElementById('veh-marca').value.trim(),
    anio:                parseInt(document.getElementById('veh-anio').value) || null,
    cliente_id:          parseInt(document.getElementById('veh-cliente-id').value) || null,
    tipo_vehiculo:       document.getElementById('veh-tipo').value || 'Sedán',
    color:               document.getElementById('veh-color').value.trim() || null,
    transmision:         document.getElementById('veh-transmision').value || null,
    tipo_motor:          document.getElementById('veh-tipo-motor').value.trim() || null,
    n_motor:             document.getElementById('veh-n-motor').value.trim() || null,
    vin:                 document.getElementById('veh-vin').value.trim().toUpperCase() || null,
    km_actual:           parseInt(document.getElementById('veh-km-actual').value) || null,
    km_ultimo_servicio:  parseInt(document.getElementById('veh-km-ult-serv').value) || null,
    km_ultimo_aceite:         parseInt(document.getElementById('veh-km-aceite').value) || null,
    km_ultimo_frenos:         parseInt(document.getElementById('veh-km-frenos').value) || null,
    km_ultimo_bujias:         parseInt(document.getElementById('veh-km-bujias').value) || null,
    km_ultimo_filtros:        parseInt(document.getElementById('veh-km-filtros').value) || null,
    km_ultimo_liquido_frenos: parseInt(document.getElementById('veh-km-liq-frenos').value) || null,
    km_ultimo_refrigerante:   parseInt(document.getElementById('veh-km-refrigerante').value) || null,
    km_ultimo_distribucion:   parseInt(document.getElementById('veh-km-distribucion').value) || null,
    sug_aceite:          document.getElementById('veh-sug-aceite').value.trim() || null,
    sug_refrigerante:    document.getElementById('veh-sug-refrigerante').value.trim() || null,
    sug_bujias:          document.getElementById('veh-sug-bujias').value.trim() || null,
    sug_filtros:         document.getElementById('veh-sug-filtros').value.trim() || null,
  };

  const btn = document.getElementById('btn-save-vehiculo');
  btn.disabled = true;
  btn.style.opacity = '.6';

  const plateExists = vehiculosList.some(v => v.placa === data.placa && v.cliente_id === data.cliente_id && (!id || v.id != id));
  if (plateExists) {
    alert("Ya existe un vehículo con esta placa para este cliente.");
    btn.disabled = false;
    btn.style.opacity = '1';
    return;
  }

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
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// ── Modal Historial con Plano SVG ─────────────────────────
function renderModalHistorial() {
  return `
    <div id="modal-historial" class="modal-overlay">
      <div class="modal modal-xl">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <span class="modal-title">Expediente: <span id="historial-placa" style="color:var(--brand);font-family:'Courier New',monospace;"></span></span>
          </div>
          <button class="modal-close" id="btn-close-historial-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">

          <!-- Datos del vehículo -->
          <div id="historial-veh-datos" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>

          <!-- Plano SVG interactivo -->
          <div>
            <div style="font-size:11px;font-weight:800;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
              🔧 Plano de Diagnóstico — Zonas de Trabajo Registradas
            </div>
            <div class="car-blueprint-wrap" id="blueprint-wrap">
              ${renderCarBlueprint([])}
            </div>
            <div style="font-size:10px;color:var(--slate-5);margin-top:6px;text-align:center;">
              Los puntos verdes indican las zonas donde se han registrado trabajos en órdenes anteriores.
            </div>
          </div>

          <!-- Semáforo de KM en el historial -->
          <div id="historial-semaforo-wrap"></div>

          <!-- Tabla de Órdenes -->
          <div>
            <h3 style="font-size:12px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Órdenes de Servicio</h3>
            <div class="card">
              <div style="overflow-x:auto;">
                <table class="data-table" style="font-size:12px;">
                  <thead>
                    <tr>
                      <th>Fecha / N° Orden</th>
                      <th>KM Registrado</th>
                      <th>Falla / Trabajo</th>
                      <th>Estado</th>
                      <th class="text-right">Total Est.</th>
                    </tr>
                  </thead>
                  <tbody id="tabla-historial-body"><tr><td colspan="5" class="td-empty">Cargando...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza el plano SVG del auto con puntos de trabajo basados
 * en las palabras clave encontradas en las órdenes de servicio.
 */
function renderCarBlueprint(ordenes) {
  // Mapa de zonas del carro (coordenadas aproximadas en SVG 560x200)
  const ZONAS = [
    { id:'motor',      x:100, y:100, label:'Motor',      keywords:['motor','fuerza','arranque','aceite','turbo','alternador'] },
    { id:'frenos',     x:200, y:150, label:'Frenos',     keywords:['freno','pastill','disco','abs'] },
    { id:'suspension', x:200, y:60,  label:'Suspensión', keywords:['suspension','amort','muelle','resorte','mangueta'] },
    { id:'transmision',x:280, y:100, label:'Transmisión',keywords:['transmis','caja','embrague','clutch','diferencial'] },
    { id:'escape',     x:380, y:110, label:'Escape',     keywords:['escape','catali','silenciador','tubo'] },
    { id:'neumaticos', x:150, y:160, label:'Neumáticos', keywords:['neumatico','llanta','rueda','caucho','goma'] },
    { id:'electrico',  x:100, y:50,  label:'Eléctrico',  keywords:['electri','faro','bujia','sensor','bateria','fusible'] },
    { id:'carroceria', x:320, y:60,  label:'Carrocería', keywords:['carrocer','puerta','golpe','pintura','vidrio','para'] },
  ];

  // Determinar cuáles zonas están activas (tienen trabajo registrado)
  const textos = ordenes.map(o => (o.falla_reportada || '').toLowerCase()).join(' ');
  const activas = ZONAS.filter(z => z.keywords.some(kw => textos.includes(kw)));

  return `
    <svg viewBox="0 0 560 200" width="100%" style="max-width:560px;" xmlns="http://www.w3.org/2000/svg">
      <!-- Carrocería del auto (silueta lateral minimalista) -->
      <g opacity=".5" fill="none" stroke="rgba(16,185,129,.4)" stroke-width="1.5">
        <!-- Cuerpo principal -->
        <path d="M80,140 L80,110 Q100,70 160,60 L320,60 Q380,60 420,80 L460,110 L460,140 Z" />
        <!-- Ventanas -->
        <path d="M170,65 L170,100 L310,100 L310,65 Q300,62 270,62 L200,62 Z" stroke-width="1" opacity=".7"/>
        <!-- Ruedas -->
        <circle cx="160" cy="148" r="28" opacity=".6"/>
        <circle cx="160" cy="148" r="18"/>
        <circle cx="380" cy="148" r="28" opacity=".6"/>
        <circle cx="380" cy="148" r="18"/>
        <!-- Faro delantero -->
        <path d="M460,115 L480,115 L480,125 L460,125 Z" stroke-width="1"/>
        <!-- Faro trasero -->
        <path d="M78,115 L60,115 L60,125 L78,125 Z" stroke-width="1"/>
        <!-- Motor (capó) -->
        <path d="M400,70 L460,110" stroke-width="1" opacity=".5"/>
        <!-- Techo -->
        <path d="M170,62 Q240,42 330,62" stroke-width="1" opacity=".5"/>
      </g>

      <!-- Etiqueta VIN en la esquina -->
      <text x="10" y="15" font-size="8" fill="rgba(16,185,129,.4)" font-family="'Courier New',monospace" font-weight="800">TALLER VARGAS — PLANO DE DIAGNÓSTICO</text>

      <!-- Líneas de guía -->
      ${ZONAS.map(z => `
        <line x1="${z.x}" y1="${z.y}" x2="${z.x}" y2="${z.y}" stroke="rgba(16,185,129,.15)" stroke-width="1" stroke-dasharray="3,3"/>
      `).join('')}

      <!-- Puntos de zonas -->
      ${ZONAS.map(z => {
        const isActive = activas.some(a => a.id === z.id);
        return `
          <g class="blueprint-zone" data-zona="${z.id}">
            ${isActive ? `
              <!-- Pulso externo animado -->
              <circle cx="${z.x}" cy="${z.y}" r="12" fill="rgba(16,185,129,.15)" stroke="rgba(16,185,129,.5)" stroke-width="1">
                <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values=".6;0;.6" dur="2s" repeatCount="indefinite"/>
              </circle>
              <circle cx="${z.x}" cy="${z.y}" r="5" class="blueprint-zone-dot"/>
              <text x="${z.x+10}" y="${z.y-8}" class="blueprint-zone-label">${z.label}</text>
            ` : `
              <circle cx="${z.x}" cy="${z.y}" r="4" fill="rgba(148,163,184,.25)" stroke="rgba(148,163,184,.4)" stroke-width="1"/>
              <text x="${z.x+8}" y="${z.y-6}" font-size="8" fill="rgba(100,116,139,.5)" font-family="'Courier New',monospace">${z.label}</text>
            `}
          </g>
        `;
      }).join('')}
    </svg>
  `;
}

async function verHistorial(id) {
  const v = vehiculosList.find(item => item.id == id);
  if (!v) return;

  // Actualizar datos en el modal
  document.getElementById('historial-placa').textContent = v.placa;

  const sem = calcSemaforo(v);

  document.getElementById('historial-veh-datos').innerHTML = `
    <div style="background:var(--slate-9);padding:14px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Vehículo</p>
          <p style="font-weight:800;color:var(--dark);margin-top:2px;">${v.marca_modelo} ${v.anio ? '('+v.anio+')' : ''}</p>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Propietario</p>
          <p style="font-weight:800;color:var(--dark);margin-top:2px;">${v.cliente_nombre || '—'}</p>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Tipo</p>
          <p style="font-weight:800;color:var(--dark);margin-top:2px;">${TIPO_ICONS[v.tipo_vehiculo]||'🚘'} ${v.tipo_vehiculo || '—'}</p>
        </div>
      </div>
    </div>
    <div style="background:var(--slate-9);padding:14px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">VIN</p>
          <p style="font-weight:700;color:var(--dark);font-family:'Courier New',monospace;font-size:12px;margin-top:2px;">${v.vin || '—'}</p>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Motor</p>
          <p style="font-weight:700;color:var(--dark);font-size:12px;margin-top:2px;">${v.tipo_motor || '—'}</p>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Transmisión</p>
          <p style="font-weight:700;color:var(--dark);font-size:12px;margin-top:2px;">${v.transmision || '—'}</p>
        </div>
      </div>
    </div>
    <div style="background:var(--slate-9);padding:14px;border-radius:var(--radius-md);border:1px solid var(--slate-8);grid-column: span 2;">
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;">
        <div>
          <p style="font-size:9px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">🛢️ Aceite Sugerido</p>
          <p style="font-weight:700;color:var(--dark);font-size:11px;margin-top:2px;">${v.sug_aceite || '—'}</p>
        </div>
        <div>
          <p style="font-size:9px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">❄️ Refrigerante</p>
          <p style="font-weight:700;color:var(--dark);font-size:11px;margin-top:2px;">${v.sug_refrigerante || '—'}</p>
        </div>
        <div>
          <p style="font-size:9px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">⚡ Bujías</p>
          <p style="font-weight:700;color:var(--dark);font-size:11px;margin-top:2px;">${v.sug_bujias || '—'}</p>
        </div>
        <div>
          <p style="font-size:9px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">💨 Filtros</p>
          <p style="font-weight:700;color:var(--dark);font-size:11px;margin-top:2px;">${v.sug_filtros || '—'}</p>
        </div>
      </div>
    </div>
  `;

  // Semáforo en el historial con barra de progreso
  const semHtml = (label, icon, kmComponente, limite) => {
    const kmUltimo = kmComponente !== null && kmComponente !== undefined ? kmComponente : (v.km_ultimo_servicio || 0);
    const diff = (v.km_actual || 0) - kmUltimo;
    const cleanDiff = diff > 0 ? diff : 0;
    const pct = Math.min(100, Math.round((cleanDiff / limite) * 100));
    const barCls = pct < 70 ? 'ok' : pct < 100 ? 'warn' : 'over';
    return `
      <div style="background:var(--slate-9);border-radius:var(--radius-md);padding:10px;border:1px solid var(--slate-8);">
        <div style="font-size:10px;font-weight:800;color:var(--slate-5);text-transform:uppercase;">${icon} ${label}</div>
        <div style="font-size:12px;font-weight:700;color:var(--dark);margin-top:4px;">${cleanDiff > 0 ? cleanDiff.toLocaleString()+' km desde servicio' : 'Al día'}</div>
        <div class="km-bar-wrap"><div class="km-bar-fill ${barCls}" style="width:${pct}%"></div></div>
        <div style="font-size:10px;color:var(--slate-5);margin-top:3px;">Intervalo: cada ${limite.toLocaleString()} km</div>
      </div>
    `;
  };

  document.getElementById('historial-semaforo-wrap').innerHTML = `
    <div style="font-size:11px;font-weight:800;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📊 Estado de Mantenimiento Preventivo (Salud Clínica)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:10px;">
      ${semHtml('Aceite de Motor', '🛢️', v.km_ultimo_aceite, 8000)}
      ${semHtml('Pastillas de Freno', '🔩', v.km_ultimo_frenos, 30000)}
      ${semHtml('Bujías', '⚡', v.km_ultimo_bujias, 40000)}
      ${semHtml('Filtros (Aire/Aceite)', '💨', v.km_ultimo_filtros, 15000)}
      ${semHtml('Líquido de Frenos', '💧', v.km_ultimo_liquido_frenos, 40000)}
      ${semHtml('Refrigerante / Coolant', '❄️', v.km_ultimo_refrigerante, 40000)}
      ${semHtml('Correa de Distribución', '⛓️', v.km_ultimo_distribucion, 80000)}
    </div>
  `;

  // Abrir modal
  document.getElementById('modal-historial').classList.add('active');

  // Cargar historial de órdenes
  const tbody = document.getElementById('tabla-historial-body');
  tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px;color:var(--slate-5);">Cargando historial...</td></tr>`;

  try {
    const hist = await getHistorial(id);

    // Actualizar el plano SVG con las zonas activas
    document.getElementById('blueprint-wrap').innerHTML = renderCarBlueprint(hist);

    if (!hist.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty">Este vehículo no tiene órdenes registradas aún.</td></tr>`;
    } else {
      tbody.innerHTML = hist.map(h => {
        const dateStr = new Date(h.fecha_ingreso).toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' });
        return `
          <tr>
            <td>
              <span style="font-weight:700;color:var(--dark);">${dateStr}</span>
              <div style="font-size:10px;color:var(--slate-5);margin-top:2px;">Orden #${h.id}</div>
            </td>
            <td><strong>${h.kilometraje ? h.kilometraje.toLocaleString()+' Km' : '—'}</strong></td>
            <td>
              <div style="font-weight:500;color:var(--dark);max-width:240px;">${h.falla_reportada || '—'}</div>
            </td>
            <td>
              <span class="badge ${h.estado==='Finalizado' ? 'badge-emerald' : h.estado==='En Proceso' ? 'badge-blue' : 'badge-amber'}">${h.estado}</span>
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
