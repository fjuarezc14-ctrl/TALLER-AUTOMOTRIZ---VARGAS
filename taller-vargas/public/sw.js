// Este es un Service Worker básico solo para habilitar la instalación PWA
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado');
});

self.addEventListener('fetch', (e) => {
    // Por ahora lo dejamos vacío para que el sistema siga funcionando normalmente con internet
});
