import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5174,
    host: '0.0.0.0',
    watch: {
      // Necesario en Docker sobre Windows: inotify no funciona en volúmenes montados
      usePolling: true,
      interval: 300,
    },
    proxy: {
      // Dentro del contenedor Docker, el backend se accede por nombre de servicio
      '/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
})

