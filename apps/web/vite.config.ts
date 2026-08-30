import { sveltekit } from '@sveltejs/kit/vite';
import stylex from '@stylexjs/unplugin';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  ...(process.env.VITE_CACHE_DIR ? { cacheDir: process.env.VITE_CACHE_DIR } : {}),
  plugins: [
    sveltekit(),
    ...(mode === 'test'
      ? []
      : [
          stylex.vite({
            useCSSLayers: true,
          }),
        ]),
  ],
  server: {
    fs: {
      allow: ['../..'],
    },
    watch: {
      ignored: ['**/.svelte-kit-e2e-*/**'],
    },
  },
  ssr: {
    external: ['@oss-tips/storage'],
    noExternal: ['@oss-tips/ui'],
  },
}));
