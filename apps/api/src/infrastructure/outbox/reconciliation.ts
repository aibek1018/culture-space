export type BullJobObservation =
  | 'failed'
  | 'active'
  | 'waiting'
  | 'delayed'
  | 'completed'
  | 'missing'
  | 'other';

export type ReconciliationDecision =
  { action: 'mark_failed'; processingError: string } | { action: 'leave' };

/**
 * Startup reconciliation marks only failed and missing jobs.
 * Active, waiting, delayed, and completed jobs stay unmarked, and this
 * function never describes an enqueue.
 */
export function decideReconciliation(
  state: BullJobObservation,
  failedReason: string | null,
): ReconciliationDecision {
  if (state === 'failed') {
    const reason =
      failedReason !== null && failedReason.trim().length > 0
        ? failedReason
        : 'failed';
    return { action: 'mark_failed', processingError: reason.slice(0, 500) };
  }
  if (state === 'missing') {
    return { action: 'mark_failed', processingError: 'job_missing' };
  }
  return { action: 'leave' };
}

export function observeBullState(state: string | null): BullJobObservation {
  if (state === null) {
    return 'missing';
  }
  if (state === 'failed') return 'failed';
  if (state === 'active') return 'active';
  if (
    state === 'waiting' ||
    state === 'prioritized' ||
    state === 'waiting-children'
  ) {
    return 'waiting';
  }
  if (state === 'delayed') return 'delayed';
  if (state === 'completed') return 'completed';
  return 'other';
}
