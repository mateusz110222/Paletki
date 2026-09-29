import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from "path";
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    envDir: resolve(import.meta.dirname, '..'),
    envPrefix: ['VITE_', 'FIS1_UNIT_HISTORY_URL', 'FIS2_UNIT_HISTORY_URL'],
    plugins: [react(), tailwindcss()],
    build: {
      target: 'es2022',
      rolldownOptions: {
        output: {
          minify: {
            compress: {dropConsole: true, dropDebugger: true},
            mangle: true,
            codegen: true,
          },
          codeSplitting: {
            groups: [
              {name: 'vendor-react', test: /[\\/]node_modules[\\/](?:react|react-dom|react-router)(?:[\\/]|$)/, priority: 30},
              {name: 'vendor-query', test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/, priority: 20},
              {name: 'vendor-icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, priority: 10},
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@backend': resolve(import.meta.dirname, '..', 'backend'),
      },
    },
  };
});
