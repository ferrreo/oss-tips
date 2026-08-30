import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SegmentedControl from './SegmentedControl.svelte';

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'settings', label: 'Settings' },
];

function segmentButtonsIn(canvasElement: HTMLElement) {
  const buttons = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('button'));
  if (buttons.length !== options.length)
    throw new Error('Segmented control rendered the wrong number of buttons');
  return buttons;
}

export const Default: Story = { args: { options, value: 'overview', label: 'Project view' } };
export const Disabled: Story = {
  args: { options, value: 'overview', label: 'Project view', disabled: true },
  play: ({ canvasElement }) => {
    if (segmentButtonsIn(canvasElement).some((button) => !button.disabled)) {
      throw new Error('Disabled segmented control has an enabled option');
    }
  },
};
export const FocusVisible: Story = {
  args: { options, value: 'overview', label: 'Project view' },
  play: ({ canvasElement }) => {
    const [first] = segmentButtonsIn(canvasElement);
    first?.focus();
    if (document.activeElement !== first)
      throw new Error('Segmented control did not receive focus');
  },
};
export const Active: Story = {
  args: { options, value: 'overview', label: 'Project view' },
  play: async ({ canvasElement }) => {
    const [, activity] = segmentButtonsIn(canvasElement);
    activity?.click();
    await Promise.resolve();
    if (activity?.getAttribute('aria-pressed') !== 'true')
      throw new Error('Segment did not become active');
  },
};
export const Compact: Story = {
  args: { options, value: 'activity', label: 'Project view' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = {
  args: { options, value: 'activity', label: 'Project view' },
  globals: { theme: 'dark' },
};
