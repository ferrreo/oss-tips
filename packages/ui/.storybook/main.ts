import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { StorybookConfig } from '@storybook/svelte-vite';
import stylex from '@stylexjs/unplugin';

const require = createRequire(import.meta.url);

/** Resolve package roots for pnpm's strict node_modules layout. */
function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|svelte)'],
  addons: [
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-mcp'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/svelte-vite'),
    options: {},
  },
  staticDirs: ['../static'],
  async viteFinal(config) {
    config.plugins = [
      ...(config.plugins ?? []),
      stylex.vite({
        useCSSLayers: true,
      }),
    ];
    return config;
  },
};

export default config;
