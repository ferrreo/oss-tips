import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectPostEditorPage, { type PostEditorAction } from './ProjectPostEditorPage.svelte';
import { demoPosts } from '../../fixtures/demo.js';
import { extraPosts } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Post Editor',
  component: ProjectPostEditorPage,
  parameters: { layout: 'fullscreen' },
  args: { draft: demoPosts[0]!, recentPosts: [...demoPosts, ...extraPosts] },
} satisfies Meta<typeof ProjectPostEditorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const EmptyHistory: Story = { args: { recentPosts: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const AutosavePending: Story = {
  args: { autosave: false, initialAutosaveState: 'pending' },
};
export const AutosaveSaved: Story = { args: { autosave: false, initialAutosaveState: 'saved' } };
export const AttachmentUpload: Story = {
  args: {
    autosave: false,
    uploadState: 'uploading',
    uploadProgress: 58,
    attachments: [
      {
        id: 'asset-1',
        name: 'application/pdf',
        sizeLabel: '1.8 MB',
        url: '/api/v1/assets/demo/download?redirect=1',
      },
    ],
    onUploadAttachment: async () => '/api/v1/assets/demo/download?redirect=1',
  },
};
const conflictSave: PostEditorAction = async () => {
  const error = new globalThis.Error('The post changed elsewhere.') as Error & { status: number };
  error.status = 409;
  throw error;
};
export const Conflict: Story = {
  args: {
    autosave: false,
    initialAutosaveState: 'conflict',
    onSaveDraft: conflictSave,
    onRefreshVersion: async () => '"2026-05-28T12:00:00.000Z"',
  },
};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
