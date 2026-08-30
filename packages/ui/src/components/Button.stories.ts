import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Button from './Button.svelte';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { label: 'Save changes' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

function buttonIn(canvasElement: HTMLElement) {
  const button = canvasElement.querySelector('button');
  if (!(button instanceof HTMLButtonElement))
    throw new Error('Button story did not render a button');
  return button;
}

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', label: 'Cancel' } };
export const Quiet: Story = { args: { variant: 'quiet', label: 'Skip for now' } };
export const Destructive: Story = { args: { variant: 'destructive', label: 'Refund payment' } };
export const Icon: Story = { args: { variant: 'icon', label: '⋯', 'aria-label': 'More actions' } };
export const FocusVisible: Story = {
  play: ({ canvasElement }) => {
    const button = buttonIn(canvasElement);
    button.focus();
    if (document.activeElement !== button) throw new Error('Button did not receive focus');
  },
};
export const Active: Story = {
  play: ({ canvasElement }) => {
    const button = buttonIn(canvasElement);
    let activated = false;
    button.addEventListener('click', () => (activated = true), { once: true });
    button.click();
    if (!activated) throw new Error('Button did not activate');
  },
};
export const Loading: Story = {
  args: { loading: true, label: 'Save changes' },
  play: ({ canvasElement }) => {
    const button = buttonIn(canvasElement);
    if (!button.disabled || button.getAttribute('aria-busy') !== 'true') {
      throw new Error('Loading button is not disabled and busy');
    }
  },
};
export const Disabled: Story = {
  args: { disabled: true, label: 'Unavailable' },
  play: ({ canvasElement }) => {
    if (!buttonIn(canvasElement).disabled) throw new Error('Disabled button is enabled');
  },
};
export const Compact: Story = {
  args: { variant: 'primary', label: 'Publish update' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: { label: 'Save changes' }, globals: { theme: 'dark' } };
