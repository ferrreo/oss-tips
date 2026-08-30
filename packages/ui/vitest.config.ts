import { configDefaults, defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import stylex from '@stylexjs/unplugin';

export default defineConfig({
  plugins: [
    svelte(),
    stylex.vite({
      devMode: 'off',
      useCSSLayers: true,
    }),
  ],
  test: {
    passWithNoTests: true,
    exclude: [...configDefaults.exclude, 'dist/**', '.svelte-kit/**'],
  },
});
