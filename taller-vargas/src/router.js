/**
 * Router SPA simple para el ERP Taller Vargas
 * Maneja navegación entre módulos sin recarga de página
 */

const routes = {
  '/':             () => import('./pages/dashboard.js'),
  '/ordenes':      () => import('./pages/ordenes.js'),
  '/vehiculos':    () => import('./pages/vehiculos.js'),
  '/clientes':     () => import('./pages/clientes.js'),
  '/operaciones':  () => import('./pages/operaciones.js'),
  '/almacen':      () => import('./pages/almacen.js'),
  '/facturacion':  () => import('./pages/facturacion.js'),
  '/archivos':     () => import('./pages/archivos.js'),
  '/taller':       () => import('./pages/operaciones.js'),
  '/confirmar':    () => import('./pages/confirmar.js'),
};

let currentModule = null;

export async function navigate(path = '/') {
  const pathname = path.split('?')[0];
  const matchedPath = pathname.startsWith('/confirmar') ? '/confirmar' : pathname;
  
  const loader = routes[matchedPath] || routes['/'];
  
  const sidebar = document.getElementById('sidebar-menu');
  const menuBtn = document.getElementById('btn-menu-toggle');
  const mainParent = document.querySelector('.flex-1.flex.flex-col.overflow-hidden.relative');

  if (matchedPath === '/confirmar') {
    if (sidebar) sidebar.style.display = 'none';
    if (menuBtn) menuBtn.style.display = 'none';
    if (mainParent) {
      mainParent.style.padding = '0';
      mainParent.style.margin = '0';
    }
  } else {
    if (sidebar) sidebar.style.display = '';
    if (menuBtn) menuBtn.style.display = '';
    if (mainParent) {
      mainParent.style.padding = '';
      mainParent.style.margin = '';
    }
  }

  // Actualizar sidebar activo
  document.querySelectorAll('.sidebar-item').forEach(el => {
    const route = el.dataset.route;
    const isActive = (route === matchedPath) || (route === '/operaciones' && matchedPath === '/taller');
    el.classList.toggle('sidebar-active', isActive);
  });

  // Auto-expandir el submenú de la ruta activa y su cabecera (cerrando el resto)
  document.querySelectorAll('.sidebar-submenu').forEach(sub => sub.classList.remove('open'));
  document.querySelectorAll('.sidebar-group-header').forEach(hdr => hdr.classList.remove('open'));

  const activeItem = Array.from(document.querySelectorAll('.sidebar-item')).find(el => el.classList.contains('sidebar-active'));
  if (activeItem) {
    const parentSubmenu = activeItem.closest('.sidebar-submenu');
    if (parentSubmenu) {
      parentSubmenu.classList.add('open');
      const headerBtn = parentSubmenu.previousElementSibling;
      if (headerBtn) {
        headerBtn.classList.add('open');
      }
    }
  }

  // Cerrar sidebar si está abierto en móvil
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && sidebar.classList.contains('sidebar-open')) {
    sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.add('hidden');
  }

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
  '/':             ['Panel Principal', 'Resumen General'],
  '/ordenes':      ['Órdenes de Servicio', 'Gestión Operativa'],
  '/vehiculos':    ['Vehículos', 'Directorio y Proceso'],
  '/clientes':     ['CRM Clientes', 'Seguimiento 360° y Fidelización'],
  '/operaciones':  ['Taller y Operaciones', 'Control en Vivo, Equipo Técnico y Portal Mecánico'],
  '/almacen':      ['Almacén / Repuestos', 'Control de Inventario'],
  '/facturacion':  ['Finanzas', 'Facturación y Cobros'],
  '/archivos':     ['Documentos', 'Repositorio General'],
  '/taller':       ['Taller y Operaciones', 'Portal de Diagnóstico y Operaciones Mecánicas'],
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
