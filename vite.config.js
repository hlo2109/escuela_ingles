import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Usa variable de entorno VITE_BASE para override si existe
const base = process.env.VITE_BASE || (process.env.NODE_ENV === 'production' ? '/ingles/' : '/');

export default defineConfig({
  base: command === 'build' ? '/ingles/' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173
  },
  publicDir: 'public'
});
