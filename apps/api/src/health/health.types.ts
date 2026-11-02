export type DependencyStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ok' | 'unavailable';
  checks: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
}

export interface LivenessReport {
  status: 'ok';
}
