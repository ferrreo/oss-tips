<script lang="ts">
  interface Column {
    key: string;
    label: string;
  }

  interface Props {
    columns: Column[];
    rows: Record<string, string | number>[];
    caption?: string;
  }

  let { columns, rows, caption }: Props = $props();
</script>

<div class="pl-table-wrap">
  <table class="pl-table">
    {#if caption}
      <caption class="pl-muted" style="caption-side: top; padding-bottom: 0.5rem; text-align: left;">{caption}</caption>
    {/if}
    <thead>
      <tr>
        {#each columns as col (col.key)}
          <th scope="col">{col.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (i)}
        <tr>
          {#each columns as col (col.key)}
            <td>{row[col.key]}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
