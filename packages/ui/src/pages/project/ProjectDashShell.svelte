<script lang="ts">
  import type { Snippet } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import DashboardShell from '../../components/DashboardShell.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import { projectStyles } from '../../styles/project.stylex';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    title?: string;
    lede?: string;
    children?: Snippet;
  }

  export type ProjectShellProps = Pick<Props, 'project' | 'navGroups'>;

  let { project = demoProject, navGroups = projectNavGroups, title = '', lede = '', children }: Props = $props();
</script>

<div class={stylex.attrs(projectStyles.page).class}>
  <DashboardShell projectName={project.name} {navGroups} {title} {lede}>
    {@render children?.()}
  </DashboardShell>
</div>
