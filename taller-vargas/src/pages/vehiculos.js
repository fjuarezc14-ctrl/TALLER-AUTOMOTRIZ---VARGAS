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

  // Semáforo de mantenimiento (basado en km)
  const kmAct  = v.km_actual || 0;
  const kmServ = v.km_ultimo_servicio || 0;
  const kmDiff = kmAct - kmServ;
  const semaforo = calcSemaforo(kmDiff);

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
        <div style="margin-top:8px;">
          <div style="font-size:9px;font-weight:800;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Mantenimiento Preventivo</div>
          <div class="mant-semaforo">
            ${renderMantItem(semaforo.aceite,   '🛢️ Aceite')}
            ${renderMantItem(semaforo.pastillas,'🔩 Frenos')}
            ${renderMantItem(semaforo.bujias,   '⚡ Bujías')}
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
function calcSemaforo(kmDiff) {
  const state = (limite) => {
    if (kmDiff <= 0)                   return 'ok';
    const pct = kmDiff / limite;
    if (pct < 0.7)                     return 'ok';
    if (pct < 1.0)                     return 'warn';
    return 'alert';
  };
  return {
    aceite:    state(5000),
    pastillas: state(20000),
    bujias:    state(30000),
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
        <form id="form-vehiculo">
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

            <!-- Sección 4: KM -->
            <div>
              <div class="form-section-title">📍 Kilometraje</div>
              <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                  <label class="form-label">KM Actual</label>
                  <input type="number" id="veh-km-actual" class="form-input" placeholder="Ej: 45000" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">KM en Último Servicio</label>
                  <input type="number" id="veh-km-ult-serv" class="form-input" placeholder="Ej: 40000" min="0" />
                </div>
              </div>
            </div>

            <!-- Sección 5: Cliente -->
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


function decodeVIN() {
  const vin = document.getElementById('veh-vin').value.toUpperCase().trim();
  const res  = document.getElementById('vin-decode-result');

  if (vin.length < 3) { res.className = 'vin-decode-result'; return; }

  const wmi    = vin.substring(0,3);
  const year   = vin.length >= 10 ? getVINYear(vin[9]) : null;
  const origen = VIN_WMI[wmi] || `Fabricante: ${wmi}`;

  const msgs = [];
  if (origen) msgs.push(`🏭 ${origen}`);
  if (year)   msgs.push(`📅 Año aprox.: ${year}`);
  if (vin.length === 17) msgs.push(`✅ VIN válido (17 dígitos)`);
  else msgs.push(`⚠️ VIN incompleto (${vin.length}/17 dígitos)`);

  res.textContent = msgs.join('  ·  ');
  res.className = 'vin-decode-result visible';

  // Auto-completar año si el campo está vacío
  if (year && !document.getElementById('veh-anio').value) {
    document.getElementById('veh-anio').value = year;
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
  };

  const btn = document.getElementById('btn-save-vehiculo');
  btn.disabled = true;
  btn.style.opacity = '.6';

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

  const kmAct  = v.km_actual || 0;
  const kmServ = v.km_ultimo_servicio || 0;
  const kmDiff = kmAct - kmServ;
  const sem    = calcSemaforo(kmDiff);

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
  `;

  // Semáforo en el historial con barra de progreso
  const semHtml = (label, icon, diff, limite, color) => {
    const pct   = Math.min(100, Math.round((diff/limite)*100));
    const barCls = pct < 70 ? 'ok' : pct < 100 ? 'warn' : 'over';
    return `
      <div style="flex:1;background:var(--slate-9);border-radius:var(--radius-md);padding:10px;border:1px solid var(--slate-8);">
        <div style="font-size:10px;font-weight:800;color:var(--slate-5);text-transform:uppercase;">${icon} ${label}</div>
        <div style="font-size:12px;font-weight:700;color:var(--dark);margin-top:4px;">${diff > 0 ? diff.toLocaleString()+' km desde servicio' : 'Al día'}</div>
        <div class="km-bar-wrap"><div class="km-bar-fill ${barCls}" style="width:${pct}%"></div></div>
        <div style="font-size:10px;color:var(--slate-5);margin-top:3px;">Intervalo: cada ${limite.toLocaleString()} km</div>
      </div>
    `;
  };

  document.getElementById('historial-semaforo-wrap').innerHTML = `
    <div style="font-size:11px;font-weight:800;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📊 Estado de Mantenimiento Preventivo</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${semHtml('Aceite de Motor', '🛢️', kmDiff, 5000, 'green')}
      ${semHtml('Pastillas de Freno', '🔩', kmDiff, 20000, 'orange')}
      ${semHtml('Bujías / Filtros', '⚡', kmDiff, 30000, 'red')}
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
