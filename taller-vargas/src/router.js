/**
 * Router SPA simple para el ERP Taller Vargas
 * Maneja navegación entre módulos sin recarga de página
 */

const routes = {
  '/':             () => import('./pages/dashboard.js'),
  '/ordenes':      () => import('./pages/ordenes.js'),
  '/vehiculos':    () => import('./pages/vehiculos.js'),
  '/clientes':     () => import('./pages/clientes.js'),
  '/almacen':      () => import('./pages/almacen.js'),
  '/facturacion':  () => import('./pages/facturacion.js'),
  '/archivos':     () => import('./pages/archivos.js'),
};

let currentModule = null;

export async function navigate(path = '/') {
  const loader = routes[path] || routes['/'];
  
  // Actualizar sidebar activo
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('sidebar-active', el.dataset.route === path);
  });

  // Limpiar módulo anterior
  if (currentModule?.destroy) currentModule.destroy();

  // Mostrar spinner de carga
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="flex flex-col items-center gap-3">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-slate-400 text-sm font-medium">Cargando módulo...</p>
      </div>
    </div>`;

  try {
    const module = await loader();
    currentModule = module;
    await module.init(main);
    
    // Actualizar URL sin recargar
    history.pushState({ path }, '', path);
    
    // Actualizar breadcrumb
    updateBreadcrumb(path);
  } catch (err) {
    console.error('[Router] Error cargando módulo:', err);
    main.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <p class="text-red-500 font-bold text-lg">Error cargando el módulo</p>
          <p class="text-slate-400 text-sm mt-1">${err.message}</p>
          <button onclick="navigate('/')" class="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">
            Volver al inicio
          </button>
        </div>
      </div>`;
  }
}

const breadcrumbs = {
  '/':            ['Panel Principal', 'Resumen General'],
  '/ordenes':     ['Órdenes de Servicio', 'Gestión Operativa'],
  '/vehiculos':   ['Vehículos', 'Directorio y Proceso'],
  '/clientes':    ['Clientes', 'Directorio de Contactos'],
  '/almacen':     ['Almacén / Repuestos', 'Control de Inventario'],
  '/facturacion': ['Finanzas', 'Facturación y Cobros'],
  '/archivos':    ['Documentos', 'Repositorio General'],
};

function updateBreadcrumb(path) {
  const [mod, sub] = breadcrumbs[path] || ['', ''];
  const modEl = document.getElementById('breadcrumb-modulo');
  const subEl = document.getElementById('breadcrumb-sub');
  if (modEl) modEl.textContent = mod;
  if (subEl) subEl.textContent = sub;
}

// Manejar botón atrás del navegador
window.addEventListener('popstate', (e) => {
  navigate(e.state?.path || '/');
});

// Exponer para HTML
window.navigate = navigate;
