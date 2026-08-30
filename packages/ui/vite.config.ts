import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import stylex from '@stylexjs/unplugin';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    svelte(),
    stylex.vite({
      useCSSLayers: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'svelte',
        '@oss-tips/design-tokens',
        '@oss-tips/design-tokens/paperlight.stylex',
        '@stylexjs/stylex',
      ],
    },
  },
});
