import type { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|svelte)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-mcp'],
  framework: {
    name: '@storybook/svelte-vite',
    options: {},
  },
  staticDirs: ['../static'],
};

export default config;
