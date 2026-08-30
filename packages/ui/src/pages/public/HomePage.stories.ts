import type { Meta, StoryObj } from '@storybook/svelte-vite';
import HomePage from './HomePage.svelte';
import { featuredProjects } from '../../fixtures/demo.js';

const meta = {
  title: 'Pages/Public/Home',
  component: HomePage,
  args: { projects: featuredProjects },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HomePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const EmptyIndex: Story = { args: { projects: [] } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };

export const German: Story = {
  globals: { locale: 'de' },
};

export const BrazilianPortugueseDark: Story = {
  globals: { theme: 'dark', locale: 'pt-BR' },
};
export const LongCopy: Story = {
  args: {
    strapline:
      'Direct support for open source projects, with a longer line that proves the hero copy wraps without pushing the artwork or actions out of view.',
    support:
      'Choose one-off or recurring support, see the fee before checkout, and keep access tied to a confirmed Stripe payment.',
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'fr', direction: 'rtl' },
};
