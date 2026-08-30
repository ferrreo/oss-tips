import type { Meta, StoryObj } from '@storybook/svelte-vite';
import PublicFooter from './PublicFooter.svelte';

const tabletViewport = {
  defaultViewport: 'tablet',
  viewports: { tablet: { name: 'Tablet 768', styles: { width: '768px', height: '800px' } } },
};

const meta = {
  title: 'Components/PublicFooter',
  component: PublicFooter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { theme: 'light' } };

export const Dark: Story = {
  args: { theme: 'dark' },
  globals: { theme: 'dark' },
};

export const Tablet: Story = {
  args: { theme: 'light' },
  parameters: { viewport: tabletViewport },
};

export const Compact: Story = {
  args: { theme: 'light' },
  parameters: {
    viewport: {
      defaultViewport: 'compact',
      viewports: { compact: { name: 'Compact 320', styles: { width: '320px', height: '800px' } } },
    },
  },
};

export const German: Story = { args: { theme: 'light' }, globals: { locale: 'de' } };

export const FrenchDark: Story = {
  args: { theme: 'dark' },
  globals: { theme: 'dark', locale: 'fr' },
};
