import type { Meta, StoryObj } from '@storybook/svelte-vite';
import PublicNav from './PublicNav.svelte';

const compactViewport = {
  defaultViewport: 'compact',
  viewports: { compact: { name: 'Compact 320', styles: { width: '320px', height: '800px' } } },
};
const tabletViewport = {
  defaultViewport: 'tablet',
  viewports: { tablet: { name: 'Tablet 768', styles: { width: '768px', height: '800px' } } },
};

const meta = {
  title: 'Components/PublicNav',
  component: PublicNav,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicNav>;

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

export const ActiveExplore: Story = {
  args: { theme: 'light', activeHref: '/explore' },
};

export const Compact: Story = {
  args: { theme: 'light' },
  parameters: { viewport: compactViewport },
};

export const CompactOpen: Story = {
  args: { theme: 'light', initialMenuOpen: true },
  parameters: { viewport: compactViewport },
};

export const DarkCompactOpen: Story = {
  args: { theme: 'dark', initialMenuOpen: true },
  globals: { theme: 'dark' },
  parameters: { viewport: compactViewport },
};

export const German: Story = { globals: { locale: 'de' } };

export const FrenchCompactOpen: Story = {
  args: { initialMenuOpen: true },
  globals: { locale: 'fr' },
  parameters: { viewport: compactViewport },
};

export const RTLLayoutSmoke: Story = {
  globals: { locale: 'de', direction: 'rtl' },
};
