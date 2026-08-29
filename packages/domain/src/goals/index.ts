export type GoalType =
  | 'one_time_money'
  | 'calendar_month_money'
  | 'active_supporter_count'
  | 'mrr';

export type GoalProgressInput = {
  type: GoalType;
  targetMinor: bigint | null;
  targetCount: number | null;
  /** Settled project support before Stripe/oss fees, excluding tip, net of refunds. */
  settledProjectSupportMinor: bigint;
  activeSupporterCount: number;
  mrrMinor: bigint;
};

export type GoalProgress = {
  current: bigint;
  target: bigint;
  ratio: number;
  percent: number;
  complete: boolean;
};

export function computeGoalProgress(input: GoalProgressInput): GoalProgress {
  let current: bigint;
  let target: bigint;

  switch (input.type) {
    case 'one_time_money':
    case 'calendar_month_money':
      current = input.settledProjectSupportMinor;
      target = input.targetMinor ?? 0n;
      break;
    case 'active_supporter_count':
      current = BigInt(input.activeSupporterCount);
      target = BigInt(input.targetCount ?? 0);
      break;
    case 'mrr':
      current = input.mrrMinor;
      target = input.targetMinor ?? 0n;
      break;
    default: {
      const _exhaustive: never = input.type;
      return _exhaustive;
    }
  }

  const ratio = target === 0n ? 0 : Number(current) / Number(target);
  const percent = Math.min(100, Math.round(ratio * 100));
  return {
    current,
    target,
    ratio,
    percent,
    complete: target > 0n && current >= target,
  };
}
