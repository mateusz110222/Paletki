import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from "path";
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    envDir: resolve(__dirname, '..'),
    envPrefix: ['VITE_', 'FIS1_UNIT_HISTORY_URL', 'FIS2_UNIT_HISTORY_URL'],
    plugins: [react(), tailwindcss()],
    build: {
      target: 'es2022',
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          passes: 2,
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@backend': resolve(__dirname, '..', 'backend'),
      },
    },
  };
});
