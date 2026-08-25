import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from "path";
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    envDir: resolve(__dirname, '..'),
    envPrefix: ['VITE_', 'FIS1_UNIT_HISTORY_URL', 'FIS2_UNIT_HISTORY_URL'],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@backend': resolve(__dirname, '..', 'backend'),
      },
    },
  };
});
