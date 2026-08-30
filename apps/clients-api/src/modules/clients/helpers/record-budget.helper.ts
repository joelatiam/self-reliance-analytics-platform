/**
 * Caps how many rows a generation run may write.
 *
 * Test mode exists so CI and local smoke runs never build a real dataset: the
 * whole run is limited to a hundred rows, which is enough to prove the shape of
 * the data and fast enough to throw away afterwards. Live mode is unbounded and
 * is what the bulk script uses to build a 500k-1M row caseload.
 */

export const TEST_MODE_MAX_RECORDS = 100;

export enum SimulationMode {
  TEST = 'test',
  LIVE = 'live',
}

export class RecordBudget {
  private used = 0;

  private constructor(private readonly limit: number | null) {}

  /** Unbounded budget, for live runs. */
  static unlimited(): RecordBudget {
    return new RecordBudget(null);
  }

  static of(limit: number): RecordBudget {
    return new RecordBudget(Math.max(0, limit));
  }

  /** Test mode caps every run at TEST_MODE_MAX_RECORDS rows. */
  static forMode(mode: SimulationMode): RecordBudget {
    return mode === SimulationMode.TEST
      ? RecordBudget.of(TEST_MODE_MAX_RECORDS)
      : RecordBudget.unlimited();
  }

  get remaining(): number {
    return this.limit === null
      ? Number.POSITIVE_INFINITY
      : this.limit - this.used;
  }

  get spent(): number {
    return this.used;
  }

  get exhausted(): boolean {
    return this.remaining <= 0;
  }

  /** How many of `count` rows may be written; spends what it grants. */
  take(count = 1): number {
    const granted = Math.max(0, Math.min(count, this.remaining));
    this.used += granted;
    return granted;
  }

  /** True when a single row fits; spends it. */
  takeOne(): boolean {
    return this.take(1) === 1;
  }

  describe(): string {
    return this.limit === null
      ? `${this.used} rows (no limit)`
      : `${this.used}/${this.limit} rows`;
  }
}

/** Resolves the mode from env, treating NODE_ENV=test as test mode. */
export function resolveSimulationMode(
  simulationMode?: string,
  nodeEnv?: string,
): SimulationMode {
  const explicit = simulationMode?.trim().toLowerCase();
  if (explicit === SimulationMode.TEST) return SimulationMode.TEST;
  if (explicit === SimulationMode.LIVE) return SimulationMode.LIVE;
  return nodeEnv?.trim().toLowerCase() === 'test'
    ? SimulationMode.TEST
    : SimulationMode.LIVE;
}
