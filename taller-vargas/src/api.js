// ============================================================
// API Client - Taller Vargas ERP
// Centraliza todas las llamadas al backend REST
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}/api${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Error de servidor', res.status);
  return data;
}

// ── Dashboard ────────────────────────────────────────────
export const getDashboard = () => request('/dashboard');

// ── Clientes ─────────────────────────────────────────────
export const getClientes          = ()         => request('/clientes');
export const getCliente           = (id)       => request(`/clientes/${id}`);
export const getClienteHistorial  = (id)       => request(`/clientes/${id}/historial`);
export const getClientesCrmStats  = ()         => request('/clientes/stats/crm');
export const createCliente        = (data)     => request('/clientes', { method: 'POST', body: data });
export const updateCliente        = (id, data) => request(`/clientes/${id}`, { method: 'PUT', body: data });
export const patchClienteNotas    = (id, nota) => request(`/clientes/${id}/notas`, { method: 'PATCH', body: { notas: nota } });
export const deleteCliente        = (id)       => request(`/clientes/${id}`, { method: 'DELETE' });

// ── Vehículos ─────────────────────────────────────────────
export const getVehiculos    = ()       => request('/vehiculos');
export const getHistorial    = (id)     => request(`/vehiculos/${id}/historial`);
export const createVehiculo  = (data)   => request('/vehiculos', { method: 'POST', body: data });
export const updateVehiculo  = (id, d)  => request(`/vehiculos/${id}`, { method: 'PUT', body: d });

// ── Mecánicos ─────────────────────────────────────────────
export const getMecanicos       = ()         => request('/mecanicos');
export const getMecanicosStats  = ()         => request('/mecanicos/stats');
export const createMecanico     = (data)     => request('/mecanicos', { method: 'POST', body: data });
export const updateMecanico     = (id, data) => request(`/mecanicos/${id}`, { method: 'PUT', body: data });
export const patchOrdenMecanico = (id, mid)  => request(`/ordenes/${id}/mecanico`, { method: 'PATCH', body: { mecanico_id: mid } });


// ── Órdenes de Servicio ──────────────────────────────────
export const getOrdenes     = ()         => request('/ordenes');
export const getOrdenesEnProceso = ()    => request('/ordenes/proceso');
export const getOrden       = (id)       => request(`/ordenes/${id}`);
export const createOrden    = (data)     => request('/ordenes', { method: 'POST', body: data });
export const updateOrden    = (id, data) => request(`/ordenes/${id}`, { method: 'PUT', body: data });
export const cambiarEstado  = (id, data) => request(`/ordenes/${id}/estado`, { method: 'PATCH', body: data });
export const addItem        = (id, data) => request(`/ordenes/${id}/items`, { method: 'POST', body: data });
export const deleteItem     = (oid, iid) => request(`/ordenes/${oid}/items/${iid}`, { method: 'DELETE' });

// ── Almacén ───────────────────────────────────────────────
export const getAlmacen       = ()           => request('/almacen');
export const getAlmacenMecanico = ()         => request('/almacen/mecanico');
export const getAlertasStock  = ()           => request('/almacen/alertas');
export const createProducto   = (data)       => request('/almacen', { method: 'POST', body: data });
export const updateProducto   = (id, data)   => request(`/almacen/${id}`, { method: 'PUT', body: data });
export const deleteProducto   = (id)         => request(`/almacen/${id}`, { method: 'DELETE' });
export const ajustarStock     = (id, data)   => request(`/almacen/${id}/stock`, { method: 'PATCH', body: data });
export const getSolicitudesMecanico = ()     => request('/almacen/solicitudes');
export const crearSolicitudMecanico = (data) => request('/almacen/solicitudes', { method: 'POST', body: data });

// ── Facturación ───────────────────────────────────────────
export const getCobros    = ()         => request('/cobros');
export const getStatsCobros = ()       => request('/cobros/stats');
export const registrarCobro = (id, d)  => request(`/cobros/${id}/cobrar`, { method: 'PATCH', body: d });
export const dividirCobro   = (id, d)  => request(`/cobros/${id}/dividir`, { method: 'PATCH', body: d });

// ── Archivos ──────────────────────────────────────────────
export const getArchivos    = ()       => request('/archivos');
export const createArchivo  = (data)   => request('/archivos', { method: 'POST', body: data });
export const deleteArchivo  = (id)     => request(`/archivos/${id}`, { method: 'DELETE' });
