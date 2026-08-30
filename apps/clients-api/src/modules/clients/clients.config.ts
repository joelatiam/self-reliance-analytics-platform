import { registerAs } from '@nestjs/config';

import { PROGRAM_COUNTRY_ISO3 } from './constants/countries';
import {
  resolveSimulationMode,
  SimulationMode,
  TEST_MODE_MAX_RECORDS,
} from './helpers/record-budget.helper';

export type ClientsConfigType = {
  /** ISO3 codes the simulator generates activity for. */
  countries: string[];
  /** Test mode caps every generation run at TEST_MODE_MAX_RECORDS rows. */
  mode: SimulationMode;
  testModeMaxRecords: number;
  /** Seed the database with a starting caseload on first boot when empty. */
  seedOnBoot: boolean;
  seedClientCount: number;
  /** Faker seed; set for reproducible data, leave empty for fresh randomness. */
  simulationSeed: number | null;
  /** New enrolments created per activity tick. */
  newClientsPerTick: { min: number; max: number };
  loanApplicationsPerTick: { min: number; max: number };
  repaymentsPerTick: { min: number; max: number };
  advisorySessionsPerTick: { min: number; max: number };
  metricsPerTick: { min: number; max: number };
  /** Share of installments paid on or before the due date (programs of this kind report 92-96%). */
  onTimeRepaymentRate: number;
  /** Share of late loans that roll into default rather than catching up. */
  defaultRate: number;
  /** Whether the cron-driven tick runs; disable to drive the API by hand only. */
  cronEnabled: boolean;
};

/** Parses "min:max" or a single number into a bounded range. */
function parseRange(
  value: string | undefined,
  fallback: { min: number; max: number },
): { min: number; max: number } {
  if (!value?.trim()) return fallback;

  const [rawMin, rawMax] = value.split(':');
  const min = Number.parseInt(rawMin, 10);
  const max = rawMax === undefined ? min : Number.parseInt(rawMax, 10);

  if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max < min) {
    return fallback;
  }
  return { min, max };
}

function parseRate(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
}

/** Env flags default to true unless explicitly set to "false". */
function envFlag(value: string | undefined, defaultValue = true): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value !== 'false';
}

export default registerAs<ClientsConfigType>('clients', () => {
  const configured = process.env.SIMULATION_COUNTRIES?.split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  const countries = configured?.length
    ? configured.filter((code) => PROGRAM_COUNTRY_ISO3.includes(code))
    : PROGRAM_COUNTRY_ISO3;

  const seed = process.env.SIMULATION_SEED
    ? Number.parseInt(process.env.SIMULATION_SEED, 10)
    : NaN;

  const mode = resolveSimulationMode(
    process.env.SIMULATION_MODE,
    process.env.NODE_ENV,
  );

  return {
    countries: countries.length ? countries : PROGRAM_COUNTRY_ISO3,
    mode,
    testModeMaxRecords: TEST_MODE_MAX_RECORDS,
    seedOnBoot: envFlag(process.env.SIMULATION_SEED_ON_BOOT, true),
    seedClientCount: process.env.SIMULATION_SEED_CLIENTS
      ? Number.parseInt(process.env.SIMULATION_SEED_CLIENTS, 10)
      : 250,
    simulationSeed: Number.isNaN(seed) ? null : seed,
    newClientsPerTick: parseRange(process.env.SIMULATION_NEW_CLIENTS, {
      min: 1,
      max: 5,
    }),
    loanApplicationsPerTick: parseRange(process.env.SIMULATION_LOAN_APPS, {
      min: 1,
      max: 6,
    }),
    repaymentsPerTick: parseRange(process.env.SIMULATION_REPAYMENTS, {
      min: 3,
      max: 14,
    }),
    advisorySessionsPerTick: parseRange(process.env.SIMULATION_ADVISORY, {
      min: 2,
      max: 10,
    }),
    metricsPerTick: parseRange(process.env.SIMULATION_METRICS, {
      min: 2,
      max: 12,
    }),
    onTimeRepaymentRate: parseRate(process.env.SIMULATION_ON_TIME_RATE, 0.93),
    defaultRate: parseRate(process.env.SIMULATION_DEFAULT_RATE, 0.04),
    cronEnabled: envFlag(process.env.SIMULATION_CRON_ENABLED, true),
  };
});
