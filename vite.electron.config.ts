import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        main: resolve(__dirname, 'electron/main.ts'),
        preload: resolve(__dirname, 'electron/preload.ts')
      },
      format: 'cjs',
      fileName: (format, entryName) => `${entryName}.cjs`
    },
    rollupOptions: {
      external: ['electron', 'path', 'fs', 'crypto']
    },
    outDir: 'dist-electron',
    emptyOutDir: true,
    minify: false,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});