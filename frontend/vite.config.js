import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, /api calls go to the Flask server so the browser sees one origin (no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:5000' } },
  test: { environment: 'node' },
});
