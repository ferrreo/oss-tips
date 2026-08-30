<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import { admin } from '../../styles/admin.stylex.js';

  export interface Props {
    context: string;
    detail?: string;
    tone?: 'neutral' | 'warning' | 'danger';
  }

  let { context, detail, tone = 'neutral' }: Props = $props();

  const barStyle = $derived(
    tone === 'warning' ? [admin.operatorBar, admin.operatorBarWarning] : tone === 'danger' ? [admin.operatorBar, admin.operatorBarDanger] : admin.operatorBar,
  );
</script>

<div {...stylex.attrs(barStyle)} role="status">
  <p {...stylex.attrs(admin.operatorContext)}>{context}</p>
  {#if detail}
    <p {...stylex.attrs(admin.operatorDetail)}>{detail}</p>
  {/if}
</div>
