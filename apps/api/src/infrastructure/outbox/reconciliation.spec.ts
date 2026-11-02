import { decideReconciliation, observeBullState } from './reconciliation';

describe('outbox reconciliation decisions', () => {
  it('marks failed and missing jobs only', () => {
    expect(decideReconciliation('failed', 'smtp down')).toEqual({
      action: 'mark_failed',
      processingError: 'smtp down',
    });
    expect(decideReconciliation('missing', null)).toEqual({
      action: 'mark_failed',
      processingError: 'job_missing',
    });
    for (const state of [
      'active',
      'waiting',
      'delayed',
      'completed',
      'other',
    ] as const) {
      expect(decideReconciliation(state, 'ignored')).toEqual({
        action: 'leave',
      });
    }
  });

  it('maps BullMQ waiting variants to waiting and a null job to missing', () => {
    expect(observeBullState(null)).toBe('missing');
    expect(observeBullState('prioritized')).toBe('waiting');
    expect(observeBullState('waiting-children')).toBe('waiting');
    expect(observeBullState('completed')).toBe('completed');
    expect(observeBullState('unknown')).toBe('other');
  });
});
