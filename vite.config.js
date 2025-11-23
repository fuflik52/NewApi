import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'request-logger',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const time = new Date().toLocaleTimeString();
          console.log(`[${time}] ${req.method} ${req.url}`);
          next();
        });
      }
    }
  ],
  server: {
    host: true, // Открывает доступ по сети
    port: 3000,
    allowedHosts: ['bublickrust.ru', '109.73.198.41', 'all'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/img': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
