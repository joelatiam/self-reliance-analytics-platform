import { DataSource } from 'typeorm';

import { AdvisorySession } from 'src/modules/clients/entities/advisory-session.entity';
import { Business } from 'src/modules/clients/entities/business.entity';
import { BusinessMonthlyMetric } from 'src/modules/clients/entities/business-monthly-metric.entity';
import { Client } from 'src/modules/clients/entities/client.entity';
import { Loan } from 'src/modules/clients/entities/loan.entity';
import { LoanRepayment } from 'src/modules/clients/entities/loan-repayment.entity';
import {
  ProgramCountry,
  findCountryByIso3,
  resolveCountry,
} from 'src/modules/clients/constants/countries';
import programCountries from 'src/modules/clients/constants/countries';
import {
  ENTITIES,
  GeneratedBatch,
  INSERT_CHUNK_SIZE,
  SequenceCounters,
} from './types';

export function buildDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: process.env.DATABASE_PORT
      ? Number.parseInt(process.env.DATABASE_PORT, 10)
      : 5432,
    username: process.env.DATABASE_USERNAME ?? 'sr_app',
    password: process.env.DATABASE_PASSWORD ?? 'sr_app_pw',
    database: process.env.DATABASE_NAME ?? 'self_reliance_ops',
    entities: ENTITIES,
    synchronize: true,
    logging: false,
  });
}

export function resolveScope(country: string | null): ProgramCountry[] {
  const configured = process.env.SIMULATION_COUNTRIES?.split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  const pool = configured?.length
    ? configured
        .map((code) => findCountryByIso3(code))
        .filter((entry): entry is ProgramCountry => Boolean(entry))
    : programCountries;

  if (!country) return pool;

  const resolved = resolveCountry(country);
  if (!resolved) {
    throw new Error(`Unknown country code: ${country}`);
  }
  return [resolved];
}

export async function loadSequenceCounters(
  dataSource: DataSource,
  scope: ProgramCountry[],
): Promise<SequenceCounters> {
  const tables: Record<string, string> = {
    CLIENT: 'clients',
    BUSINESS: 'businesses',
    LOAN: 'loans',
    REPAYMENT: 'loan_repayments',
    ADVISORY: 'advisory_sessions',
  };

  const counters: SequenceCounters = {};
  for (const [kind, table] of Object.entries(tables)) {
    for (const country of scope) {
      const rows = await dataSource.query(
        `SELECT count(*)::int AS total FROM ${table} WHERE country_iso3 = $1`,
        [country.isoAlpha3],
      );
      counters[`${kind}:${country.isoAlpha3}`] = rows[0]?.total ?? 0;
    }
  }
  return counters;
}
export async function insertChunked<T>(
  dataSource: DataSource,
  entity: new () => T,
  rows: Partial<T>[],
): Promise<void> {
  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + INSERT_CHUNK_SIZE);
    await dataSource
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values(chunk as never)
      .orIgnore()
      .execute();
  }
}

/** Order matters: parents before the rows that reference their codes. */
export async function flushBatch(
  dataSource: DataSource,
  batch: GeneratedBatch,
): Promise<void> {
  await insertChunked(dataSource, Client, batch.clients);
  await insertChunked(dataSource, Business, batch.businesses);
  await insertChunked(dataSource, Loan, batch.loans);
  await insertChunked(dataSource, LoanRepayment, batch.repayments);
  await insertChunked(dataSource, AdvisorySession, batch.advisorySessions);
  await insertChunked(dataSource, BusinessMonthlyMetric, batch.metrics);
}

export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `TRUNCATE TABLE business_monthly_metrics, advisory_sessions, loan_repayments,
       loans, businesses, clients, activity_ticks RESTART IDENTITY CASCADE`,
  );
}
