<script lang="ts">
  import { attrs, display } from '../styles/display.stylex.js';
  import { primitives } from '../styles/primitives.stylex.js';
  import { locale, t } from '../lib/i18n.js';

  export interface Column {
    key: string;
    label: string;
  }

  export interface LinkCell {
    label: string | number;
    href: string;
  }

  export type CellValue = string | number | LinkCell;

  export interface Props {
    columns: Column[];
    rows: Record<string, CellValue>[];
    caption?: string;
  }

  let { columns, rows, caption }: Props = $props();

  const wrapAttrs = attrs(display.tableWrap, primitives.focusRing);
  const tableAttrs = attrs(display.table);
  const captionAttrs = attrs(display.tableCaption);
  const headAttrs = attrs(display.tableHead);
  const bodyAttrs = attrs(display.tableBody);
  const rowAttrs = attrs(display.tableRow);
  const cellAttrs = attrs(display.tableCell);
  const mobileLabelAttrs = attrs(display.tableMobileLabel);
  const linkAttrs = attrs(display.tableLink, primitives.focusRing);

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

<!-- svelte-ignore a11y_no_noninteractive_tabindex: the labelled region is intentionally keyboard-scrollable -->
<div
  class={wrapAttrs.class}
  style={wrapAttrs.style}
  role="region"
  tabindex="0"
  aria-label={caption ?? t('common.scrollableTable', {}, $locale)}
>
  <table class={tableAttrs.class} style={tableAttrs.style}>
    {#if caption}
      <caption class={captionAttrs.class} style={captionAttrs.style}><bdi>{caption}</bdi></caption>
    {/if}
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th class={headAttrs.class} style={headAttrs.style} scope="col"><bdi>{col.label}</bdi></th>
        {/each}
      </tr>
    </thead>
    <tbody class={bodyAttrs.class} style={bodyAttrs.style}>
      {#each rows as row, i (i)}
        <tr class={rowAttrs.class} style={rowAttrs.style}>
          {#each columns as col (col.key)}
            <td class={cellAttrs.class} style={cellAttrs.style} data-label={col.label}>
              <span class={mobileLabelAttrs.class} style={mobileLabelAttrs.style}><bdi>{col.label}</bdi></span>
              <span>
                {#if isLinkCell(row[col.key])}
                  <a class={linkAttrs.class} style={linkAttrs.style} href={linkHref(row[col.key])} download>{linkLabel(row[col.key])}</a>
                {:else}
                  <bdi>{row[col.key]}</bdi>
                {/if}
              </span>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
