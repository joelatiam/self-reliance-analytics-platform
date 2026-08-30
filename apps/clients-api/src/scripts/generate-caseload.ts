/**
 * Bulk caseload generator.
 *
 * Builds a full program dataset — clients, businesses, loans, repayments,
 * advisory sessions and monthly business metrics — sized in rows rather than
 * clients, because "half a million records" is the thing you actually want to
 * ask for. Clients are split across the five countries in proportion to the
 * displaced population each one hosts, and nationalities follow the real origin
 * mix for that country.
 *
 * Rows are written with chunked bulk inserts rather than the ORM's per-entity
 * save(), which is what makes a million rows finish in minutes instead of hours.
 *
 * Usage:
 *   npm run seed:caseload -- --records=500000
 *   npm run seed:caseload -- --records=1000000 --truncate --seed=42
 *   npm run seed:caseload -- --clients=5000 --country=TCD
 *
 * In test mode (SIMULATION_MODE=test or NODE_ENV=test) the whole run is capped
 * at 100 rows regardless of what was asked for.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { ClientStatus, LoanStatus } from '../modules/clients/clients.constants';
import programCountries, {
  ProgramCountry,
  findCountryByIso3,
  resolveCountry,
} from '../modules/clients/constants/countries';
import { allocateByPopulation } from '../modules/clients/constants/refugee-populations';
import { ActivityTick } from '../modules/clients/entities/activity-tick.entity';
import { AdvisorySession } from '../modules/clients/entities/advisory-session.entity';
import { Business } from '../modules/clients/entities/business.entity';
import { BusinessMonthlyMetric } from '../modules/clients/entities/business-monthly-metric.entity';
import { Client } from '../modules/clients/entities/client.entity';
import { Loan } from '../modules/clients/entities/loan.entity';
import { LoanRepayment } from '../modules/clients/entities/loan-repayment.entity';
import { generateAdvisorySession } from '../modules/clients/helpers/advisory-generator.helper';
import { generateBusiness } from '../modules/clients/helpers/business-generator.helper';
import { generateBusinessMetric } from '../modules/clients/helpers/business-metric-generator.helper';
import {
  backdatedEnrolmentDate,
  generateClient,
} from '../modules/clients/helpers/client-generator.helper';
import {
  disburseLoan,
  generateLoan,
} from '../modules/clients/helpers/loan-generator.helper';
import {
  RecordBudget,
  resolveSimulationMode,
  SimulationMode,
} from '../modules/clients/helpers/record-budget.helper';
import { generateRepayment } from '../modules/clients/helpers/repayment-generator.helper';
import {
  addDays,
  toPeriod,
} from '../modules/clients/helpers/simulation-format.helper';
import {
  chance,
  randomInt,
  seedSimulation,
} from '../modules/clients/helpers/simulation-random.helper';

/**
 * Deliberately below the measured average (~18) so a row target never runs out
 * of allocated clients before the budget is spent; the budget is what actually
 * stops the run.
 */
const ROWS_PER_CLIENT = 12;

/** Clients generated in memory before a flush. */
const CLIENTS_PER_BATCH = 500;

/** Rows per INSERT statement. */
const INSERT_CHUNK_SIZE = 1000;

const ENTITIES = [
  Client,
  Business,
  Loan,
  LoanRepayment,
  AdvisorySession,
  BusinessMonthlyMetric,
  ActivityTick,
];

interface ScriptOptions {
  records: number | null;
  clients: number | null;
  country: string | null;
  truncate: boolean;
  seed: number | null;
}

interface GeneratedBatch {
  clients: Partial<Client>[];
  businesses: Partial<Business>[];
  loans: Partial<Loan>[];
  repayments: Partial<LoanRepayment>[];
  advisorySessions: Partial<AdvisorySession>[];
  metrics: Partial<BusinessMonthlyMetric>[];
}

/** Running code sequence per entity per country. */
type SequenceCounters = Record<string, number>;

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    records: null,
    clients: null,
    country: null,
    truncate: false,
    seed: null,
  };

  for (const arg of argv) {
    const [rawKey, rawValue] = arg.replace(/^--/, '').split('=');
    const value = rawValue ?? 'true';

    switch (rawKey) {
      case 'records':
        options.records = Number.parseInt(value, 10);
        break;
      case 'clients':
        options.clients = Number.parseInt(value, 10);
        break;
      case 'country':
        options.country = value.toUpperCase();
        break;
      case 'truncate':
        options.truncate = value !== 'false';
        break;
      case 'seed':
        options.seed = Number.parseInt(value, 10);
        break;
      default:
        break;
    }
  }

  return options;
}

function buildDataSource(): DataSource {
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

function resolveScope(country: string | null): ProgramCountry[] {
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

async function loadSequenceCounters(
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

function nextSequence(
  counters: SequenceCounters,
  kind: string,
  iso3: string,
): number {
  const key = `${kind}:${iso3}`;
  counters[key] = (counters[key] ?? 0) + 1;
  return counters[key];
}

/**
 * Builds one client and everything that hangs off them. Returns nothing once
 * the budget cannot fit a client and their business.
 */
function generateClientGraph(
  country: ProgramCountry,
  counters: SequenceCounters,
  budget: RecordBudget,
  batch: GeneratedBatch,
): boolean {
  if (budget.remaining < 2) return false;

  const enrolledOn = backdatedEnrolmentDate();
  const client = generateClient({
    country,
    sequence: nextSequence(counters, 'CLIENT', country.isoAlpha3),
    enrolledOn,
  });
  client.status = ClientStatus.ACTIVE;

  const business = generateBusiness({
    client: client as Required<
      Pick<
        Client,
        'clientCode' | 'countryIso3' | 'locationName' | 'lastName' | 'gender'
      >
    >,
    country,
    sequence: nextSequence(counters, 'BUSINESS', country.isoAlpha3),
    earliestYear: client.arrivalYear ?? undefined,
  });

  budget.take(2);
  batch.clients.push(client);
  batch.businesses.push(business);

  // Loans, and the installments already paid against them.
  const loanCount = Math.min(randomInt(0, 3), budget.remaining);
  for (let cycle = 1; cycle <= loanCount; cycle++) {
    if (!budget.takeOne()) break;

    const appliedOn = addDays(enrolledOn, randomInt(14, 400));
    const loan = generateLoan({
      business: business as Required<
        Pick<Business, 'businessCode' | 'clientCode' | 'sector' | 'countryIso3'>
      >,
      country,
      sequence: nextSequence(counters, 'LOAN', country.isoAlpha3),
      loanCycle: cycle,
      appliedOn,
    }) as Loan;

    Object.assign(loan, disburseLoan(loan, appliedOn));
    batch.loans.push(loan);

    const installmentsToPay = Math.min(
      randomInt(0, loan.installmentsTotal),
      budget.remaining,
    );
    for (let installment = 0; installment < installmentsToPay; installment++) {
      if (!budget.takeOne()) break;

      const { repayment, loanUpdate } = generateRepayment({
        loan,
        country,
        sequence: nextSequence(counters, 'REPAYMENT', country.isoAlpha3),
        onTimeRate: 0.93,
        paidAt: addDays(appliedOn, 30 * (installment + 1)),
      });
      batch.repayments.push(repayment);
      Object.assign(loan, loanUpdate);
    }

    // A loan nobody has finished paying is either performing or in arrears.
    if (loan.status !== LoanStatus.REPAID && chance(0.06)) {
      loan.status = LoanStatus.LATE;
      loan.daysPastDue = randomInt(31, 120);
    }
  }

  // Advisory touchpoints.
  const sessionCount = Math.min(randomInt(0, 6), budget.remaining);
  for (let index = 0; index < sessionCount; index++) {
    if (!budget.takeOne()) break;

    batch.advisorySessions.push(
      generateAdvisorySession({
        client: client as Required<
          Pick<
            Client,
            'clientCode' | 'countryIso3' | 'advisorCode' | 'primaryLanguage'
          >
        >,
        country,
        sequence: nextSequence(counters, 'ADVISORY', country.isoAlpha3),
        businessCode: business.businessCode ?? null,
        deliveredAt: addDays(enrolledOn, randomInt(1, 700)),
      }),
    );
  }

  // Monthly results for the last few months of trading.
  const metricMonths = Math.min(randomInt(1, 4), budget.remaining);
  const now = new Date();
  for (let index = 0; index < metricMonths; index++) {
    if (!budget.takeOne()) break;

    const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const { metric, businessUpdate } = generateBusinessMetric({
      business: business as Business,
      country,
      hasActiveLoan: batch.loans.some(
        (loan) =>
          loan.businessCode === business.businessCode &&
          loan.status !== LoanStatus.REPAID,
      ),
      period: toPeriod(monthDate),
    });
    batch.metrics.push(metric);
    Object.assign(business, businessUpdate);
  }

  return true;
}

function emptyBatch(): GeneratedBatch {
  return {
    clients: [],
    businesses: [],
    loans: [],
    repayments: [],
    advisorySessions: [],
    metrics: [],
  };
}

async function insertChunked<T>(
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
async function flushBatch(
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

async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `TRUNCATE TABLE business_monthly_metrics, advisory_sessions, loan_repayments,
       loans, businesses, clients, activity_ticks RESTART IDENTITY CASCADE`,
  );
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const mode = resolveSimulationMode(
    process.env.SIMULATION_MODE,
    process.env.NODE_ENV,
  );
  // A row target is enforced by the budget, so --records=500000 means exactly
  // that many rows rather than however many the client estimate happened to
  // produce. Test mode overrides any target with its own hard cap.
  const budget =
    mode === SimulationMode.TEST
      ? RecordBudget.forMode(mode)
      : options.records
        ? RecordBudget.of(options.records)
        : RecordBudget.unlimited();

  seedSimulation(options.seed ?? null);

  const scope = resolveScope(options.country);

  const requestedClients =
    options.clients ??
    (options.records ? Math.ceil(options.records / ROWS_PER_CLIENT) : 1000);

  const allocation = allocateByPopulation(
    requestedClients,
    scope.map((country) => country.isoAlpha3),
  );

  console.log(
    `[caseload] mode=${mode} target=${requestedClients} clients ` +
      `(~${requestedClients * ROWS_PER_CLIENT} rows) across ${scope.length} countries`,
  );
  for (const country of scope) {
    console.log(
      `[caseload]   ${country.isoAlpha3} ${country.countryName}: ${allocation[country.isoAlpha3]} clients`,
    );
  }
  if (mode === SimulationMode.TEST) {
    console.log('[caseload] test mode: this run is capped at 100 rows');
  }

  const dataSource = await buildDataSource().initialize();
  const startedAt = Date.now();

  try {
    if (options.truncate) {
      console.log('[caseload] truncating existing data');
      await truncateAll(dataSource);
    }

    const counters = await loadSequenceCounters(dataSource, scope);

    // Countries are drawn from in proportion on every batch, so if the budget
    // stops the run early the mix is still representative rather than being
    // whichever countries happened to come first.
    const remaining: Record<string, number> = { ...allocation };
    const totalRemaining = () =>
      Object.values(remaining).reduce((sum, value) => sum + value, 0);

    let clientsWritten = 0;

    while (totalRemaining() > 0 && !budget.exhausted) {
      const batchPlan = allocateByPopulation(
        Math.min(CLIENTS_PER_BATCH, totalRemaining()),
        scope
          .filter((country) => remaining[country.isoAlpha3] > 0)
          .map((country) => country.isoAlpha3),
      );

      const batch = emptyBatch();
      for (const country of scope) {
        const planned = Math.min(
          batchPlan[country.isoAlpha3] ?? 0,
          remaining[country.isoAlpha3],
        );

        for (let index = 0; index < planned; index++) {
          if (!generateClientGraph(country, counters, budget, batch)) break;
          remaining[country.isoAlpha3] -= 1;
        }
      }

      if (batch.clients.length === 0) break;

      await flushBatch(dataSource, batch);
      clientsWritten += batch.clients.length;

      console.log(
        `[caseload] ${clientsWritten} clients written, ${budget.describe()}`,
      );
    }

    if (budget.exhausted) {
      console.log('[caseload] record budget reached; stopping');
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `[caseload] done in ${seconds}s: ${clientsWritten} clients, ${budget.spent} rows`,
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('[caseload] generation failed', error);
  process.exit(1);
});
