import { ActivityTickSource } from '../clients.constants';

/** Counts produced by one simulation tick. */
export interface ActivityTickResult {
  source: ActivityTickSource;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  clientsEnrolled: number;
  businessesCreated: number;
  loansApplied: number;
  loansDisbursed: number;
  repaymentsRecorded: number;
  loansClosed: number;
  advisorySessionsLogged: number;
  metricsRecorded: number;
  clientsUpdated: number;
  notes?: string | null;
}

export interface ActivityTickOptions {
  source?: ActivityTickSource;
  /** Restrict the tick to one country (ISO3); defaults to all configured ones. */
  countryIso3?: string;
  /** Overrides the configured per-tick volumes; useful for demos via Swagger. */
  intensity?: number;
}

export interface TriggerActivityTickResult {
  started: boolean;
  source: ActivityTickSource;
  countryIso3: string | null;
  /** Present when the caller asked to wait for the tick to finish. */
  result?: ActivityTickResult;
}

export interface SimulationStatus {
  cronEnabled: boolean;
  tickCron: string;
  tickMinutes: number[];
  nextTickAt: string;
  isRunning: boolean;
  countries: string[];
  lastTick: ActivityTickResult | null;
  totals: {
    clients: number;
    businesses: number;
    loans: number;
    repayments: number;
    advisorySessions: number;
    businessMetrics: number;
    ticks: number;
  };
}
