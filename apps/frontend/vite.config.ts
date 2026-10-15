import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      strict: false,
      allow: ['..', 'D:/Documents/SWP/AITA-Intelligent-main', 'D:/AITA-Intelligent-main'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 3000,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !('headersSent' in res && res.headersSent) && 'writeHead' in res) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Backend API chưa chạy trên cổng 5000.' }));
            }
          });
        },
      },
    },
  },
})
