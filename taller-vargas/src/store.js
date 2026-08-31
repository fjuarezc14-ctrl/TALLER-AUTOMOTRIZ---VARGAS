// ─── Mini-Store Global con Caché TTL e Invalidación Reactiva ─────────
import { getClientes, getVehiculos, getMecanicos, getOrdenes } from './api.js';

// Caché en memoria
const cache = {
  clientes: { data: null, timestamp: 0 },
  vehiculos: { data: null, timestamp: 0 },
  mecanicos: { data: null, timestamp: 0 },
  ordenes:   { data: null, timestamp: 0 },
};

// Tiempo de vida predeterminado: 60 segundos
const DEFAULT_TTL_MS = 60 * 1000;

export const store = {
  /**
   * Obtiene la lista de clientes (usa caché si sigue fresca).
   * @param {boolean} forceRefresh - Forzar petición al servidor
   */
  async getClientes(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.clientes.data && (now - cache.clientes.timestamp < DEFAULT_TTL_MS)) {
      return cache.clientes.data;
    }
    const res = await getClientes();
    const data = res.data || [];
    cache.clientes = { data, timestamp: now };
    return data;
  },

  /**
   * Obtiene la lista de vehículos (usa caché si sigue fresca).
   */
  async getVehiculos(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.vehiculos.data && (now - cache.vehiculos.timestamp < DEFAULT_TTL_MS)) {
      return cache.vehiculos.data;
    }
    const res = await getVehiculos();
    const data = res.data || [];
    cache.vehiculos = { data, timestamp: now };
    return data;
  },

  /**
   * Obtiene la lista de mecánicos (usa caché si sigue fresca).
   */
  async getMecanicos(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.mecanicos.data && (now - cache.mecanicos.timestamp < DEFAULT_TTL_MS)) {
      return cache.mecanicos.data;
    }
    const res = await getMecanicos();
    const data = res.data || [];
    cache.mecanicos = { data, timestamp: now };
    return data;
  },

  /**
   * Invalida una o todas las claves del caché.
   * @param {'clientes'|'vehiculos'|'mecanicos'|'ordenes'|'all'} key
   */
  invalidate(key = 'all') {
    if (key === 'all') {
      Object.keys(cache).forEach(k => {
        cache[k].data = null;
        cache[k].timestamp = 0;
      });
    } else if (cache[key]) {
      cache[key].data = null;
      cache[key].timestamp = 0;
    }
  }
};
