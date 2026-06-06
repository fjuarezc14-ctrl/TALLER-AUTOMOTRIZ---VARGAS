import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      // Redirige /api/* al backend Express para evitar CORS en desarrollo
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
})
