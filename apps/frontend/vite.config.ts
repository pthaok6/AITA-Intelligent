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
        timeout: 120000,
        proxyTimeout: 120000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (res && !('headersSent' in res && res.headersSent) && 'writeHead' in res) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: `Không kết nối được Backend API: ${err.message}` }));
            }
          });
        },
      },
    },
  },
})
