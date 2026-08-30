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

import { allocateByPopulation } from 'src/modules/clients/constants/refugee-populations';
import {
  RecordBudget,
  SimulationMode,
  resolveSimulationMode,
} from 'src/modules/clients/helpers/record-budget.helper';
import { seedSimulation } from 'src/modules/clients/helpers/simulation-random.helper';
import { generateClientGraph } from './caseload/client-graph';
import {
  buildDataSource,
  flushBatch,
  loadSequenceCounters,
  resolveScope,
  truncateAll,
} from './caseload/caseload-writer';
import {
  CLIENTS_PER_BATCH,
  ROWS_PER_CLIENT,
  ScriptOptions,
  emptyBatch,
} from './caseload/types';

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
