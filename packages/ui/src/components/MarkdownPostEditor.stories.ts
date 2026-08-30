import type { Meta, StoryObj } from '@storybook/svelte-vite';
import MarkdownPostEditor from './MarkdownPostEditor.svelte';

const populated = `## What shipped\n\nThe second-region object storage cutover is underway.\n\n- **Backups** are verified\n- [Runbook](https://oss.tips/docs) is ready\n\n@[youtube](https://www.youtube.com/watch?v=oss-tips)\n\n\`\`\`ts\nconst ready = true;\n\`\`\``;

const meta = {
  title: 'Components/Markdown Post Editor',
  component: MarkdownPostEditor,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MarkdownPostEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const upload = () => '/api/v1/assets/demo/download?redirect=1';

export const Empty: Story = {
  args: { id: 'post-editor-empty', value: '', onUploadAttachment: upload },
};

export const Populated: Story = {
  args: {
    id: 'post-editor-populated',
    value: populated,
    visibility: 'Supporter+',
    codeLanguage: 'ts',
    attachments: [
      {
        id: 'asset-1',
        name: 'application/pdf',
        sizeLabel: '1.8 MB',
        url: '/api/v1/assets/demo/download?redirect=1',
      },
    ],
    onUploadAttachment: upload,
  },
};

export const Source: Story = {
  args: {
    id: 'post-editor-source',
    value: populated,
    initialMode: 'source',
    onUploadAttachment: upload,
  },
};

export const Preview: Story = {
  args: {
    id: 'post-editor-preview',
    value: populated,
    visibility: 'Backer+',
    initialMode: 'preview',
    onUploadAttachment: upload,
  },
};

export const Error: Story = {
  args: {
    id: 'post-editor-error',
    value: populated,
    error: 'This draft could not be saved. Check your connection and try again.',
    uploadError: 'release-notes.pdf was rejected because it is still being scanned.',
    onUploadAttachment: upload,
  },
};

export const Uploading: Story = {
  args: {
    id: 'post-editor-uploading',
    value: populated,
    uploadState: 'uploading',
    uploadProgress: 58,
    onUploadAttachment: upload,
  },
};

export const Dark: Story = {
  args: {
    id: 'post-editor-dark',
    value: populated,
    initialMode: 'preview',
    visibility: 'Supporter+',
    onUploadAttachment: upload,
  },
  globals: { theme: 'dark' },
};

export const Compact: Story = {
  args: {
    id: 'post-editor-compact',
    value: populated,
    visibility: 'Supporter+',
    onUploadAttachment: upload,
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
