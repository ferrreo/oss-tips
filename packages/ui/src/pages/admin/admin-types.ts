import type { NavGroup } from '../../fixtures/demo.js';
import type {
  AdminCase,
  AuditEvent,
  DirectoryPerson,
  DirectoryProject,
  ReconRow,
  ReviewItem,
} from './admin-demo.js';

export type AdminPageState = 'ready' | 'empty' | 'error' | 'forbidden';

export interface FailedJob {
  id: string;
  kind: string;
  target: string;
  retries: number;
  lastError: string;
}

export interface AdminOverviewAmount {
  amountMinor: number;
  currency: string;
}

export interface AdminOverviewChartSeries {
  id: string;
  labelKey: string;
  currency: string;
  points: Array<{ label: string; value: number }>;
  stroke?: 'solid' | 'dashed';
  marker?: 'circle' | 'square' | 'diamond';
}

export interface AdminOverviewMetrics {
  publishedProjects: number;
  publishedThisMonth: number;
  settlementVolume: AdminOverviewAmount | null;
  previousSettlementVolume: AdminOverviewAmount | null;
  fees: AdminOverviewAmount | null;
  tips: AdminOverviewAmount | null;
  currencyCodes: string[];
  settledVolumeSeries: AdminOverviewChartSeries[];
  reconciliationAvailable: boolean;
}

export interface AdminPageProps {
  navGroups?: NavGroup[] | undefined;
  state?: AdminPageState | undefined;
}

export interface AdminOverviewPageProps extends AdminPageProps {
  overviewMetrics: AdminOverviewMetrics;
  reviewItems?: ReviewItem[] | undefined;
  cases?: AdminCase[] | undefined;
  reconciliation?: ReconRow[] | undefined;
  failedJobs?: FailedJob[] | undefined;
}

export interface AdminAuditPageProps extends AdminPageProps {
  events?: AuditEvent[] | undefined;
  initialFilter?: string | undefined;
}

export interface AdminCasesPageProps extends AdminPageProps {
  cases?: AdminCase[] | undefined;
  initialFilter?: string | undefined;
  initialSelectedId?: string | undefined;
}

export interface AdminDirectoryPageProps extends AdminPageProps {
  projects?: DirectoryProject[] | undefined;
  people?: DirectoryPerson[] | undefined;
  initialSearch?: string | undefined;
  initialView?: 'projects' | 'people' | undefined;
}

export interface AdminReconciliationPageProps extends AdminPageProps {
  rows?: ReconRow[] | undefined;
}

export interface AdminReviewQueuePageProps extends AdminPageProps {
  reviewItems?: ReviewItem[] | undefined;
  initialFilter?: string | undefined;
  initialSelectedId?: string | undefined;
}
