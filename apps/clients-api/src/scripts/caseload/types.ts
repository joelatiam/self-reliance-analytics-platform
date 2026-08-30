import { ActivityTick } from 'src/modules/clients/entities/activity-tick.entity';
import { AdvisorySession } from 'src/modules/clients/entities/advisory-session.entity';
import { Business } from 'src/modules/clients/entities/business.entity';
import { BusinessMonthlyMetric } from 'src/modules/clients/entities/business-monthly-metric.entity';
import { Client } from 'src/modules/clients/entities/client.entity';
import { Loan } from 'src/modules/clients/entities/loan.entity';
import { LoanRepayment } from 'src/modules/clients/entities/loan-repayment.entity';

/** Rows written per client on average; used to turn a row target into clients. */
export const ROWS_PER_CLIENT = 12;

/** Clients generated in memory before a flush. */
export const CLIENTS_PER_BATCH = 500;

/** Rows per INSERT statement. */
export const INSERT_CHUNK_SIZE = 1000;

export const ENTITIES = [
  Client,
  Business,
  Loan,
  LoanRepayment,
  AdvisorySession,
  BusinessMonthlyMetric,
  ActivityTick,
];

export interface ScriptOptions {
  records: number | null;
  clients: number | null;
  country: string | null;
  truncate: boolean;
  seed: number | null;
}

export interface GeneratedBatch {
  clients: Partial<Client>[];
  businesses: Partial<Business>[];
  loans: Partial<Loan>[];
  repayments: Partial<LoanRepayment>[];
  advisorySessions: Partial<AdvisorySession>[];
  metrics: Partial<BusinessMonthlyMetric>[];
}

/** Running code sequence per entity per country. */
export type SequenceCounters = Record<string, number>;

export function emptyBatch(): GeneratedBatch {
  return {
    clients: [],
    businesses: [],
    loans: [],
    repayments: [],
    advisorySessions: [],
    metrics: [],
  };
}
