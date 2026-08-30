<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table, { type CellValue, type Column, type LinkCell } from '../../components/Table.svelte';
  import { display } from '../../styles/display.stylex.js';
  import { admin } from '../../styles/admin.stylex.js';
  import { primitives } from '../../styles/primitives.stylex.js';

  export interface Props {
    columns: Column[];
    rows: Record<string, CellValue>[];
    caption: string;
    emptyMessage?: string;
  }

  let { columns, rows, caption, emptyMessage }: Props = $props();

  const linkAttrs = stylex.attrs(display.tableLink, primitives.focusRing);

  function isLinkCell(value: CellValue | undefined): value is LinkCell {
    return typeof value === 'object' && value !== null && 'href' in value;
  }

  function linkHref(value: CellValue | undefined): string {
    return isLinkCell(value) ? value.href : '';
  }

  function linkLabel(value: CellValue | undefined): string | number {
    return isLinkCell(value) ? value.label : '';
  }
</script>

<div {...stylex.attrs(admin.responsiveTable)}>
  {#if rows.length === 0}
    {#if emptyMessage}
      <EmptyState title={caption} description={emptyMessage} />
    {:else}
      <EmptyState title={caption} />
    {/if}
  {:else}
    <div {...stylex.attrs(admin.responsiveTableWide)}>
      <Table {columns} {rows} {caption} />
    </div>

    <div
      {...stylex.attrs(admin.responsiveTableNarrow)}
      role="group"
      aria-label={caption}
    >
      <p {...stylex.attrs(admin.responsiveTableCaption)}><bdi>{caption}</bdi></p>
      {#each rows as row, rowIndex (rowIndex)}
        <dl {...stylex.attrs(admin.responsiveTableCard)}>
          {#each columns as column (column.key)}
            <div {...stylex.attrs(admin.responsiveTableCell)}>
              <dt {...stylex.attrs(admin.responsiveTableLabel)}><bdi>{column.label}</bdi></dt>
              <dd {...stylex.attrs(admin.responsiveTableValue)}>
                {#if isLinkCell(row[column.key])}
                  <a
                    class={linkAttrs.class}
                    style={linkAttrs.style}
                    href={linkHref(row[column.key])}
                    download
                  >{linkLabel(row[column.key])}</a>
                {:else}
                  <bdi>{row[column.key]}</bdi>
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      {/each}
    </div>
  {/if}
</div>
