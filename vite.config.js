import { defineConfig } from 'vite';

// "demo" mode builds one self-contained test page (see scripts/inline-demo.mjs).
export default defineConfig(({ mode }) =>
  mode === 'demo'
    ? {
        base: './',
        build: {
          outDir: 'dist-demo',
          chunkSizeWarningLimit: 4000,
          rollupOptions: { output: { inlineDynamicImports: true } },
        },
      }
    : { build: { chunkSizeWarningLimit: 1500 } },
);
