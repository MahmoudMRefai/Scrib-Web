import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// All API calls go through /api and are proxied to Scribe Core in dev,
// so the browser never deals with CORS or a hard-coded backend origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
