import { faker } from '@faker-js/faker';

/** Seeds faker so a given SIMULATION_SEED always yields the same caseload. */
export function seedSimulation(seed: number | null): void {
  if (seed !== null) {
    faker.seed(seed);
  }
}

export function pickOne<T>(items: readonly T[]): T {
  return faker.helpers.arrayElement(items as T[]);
}

export function pickSome<T>(items: readonly T[], count: number): T[] {
  return faker.helpers.arrayElements(items as T[], count);
}

/**
 * Picks from a list where earlier entries are more likely, matching how the
 * caseload skews (e.g. mostly refugees, fewer stateless clients).
 */
export function pickWeighted<T>(items: readonly T[]): T {
  const weights = items.map((_, index) => 1 / (index + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = faker.number.float({ min: 0, max: total });

  for (let index = 0; index < items.length; index++) {
    threshold -= weights[index];
    if (threshold <= 0) return items[index];
  }
  return items[items.length - 1];
}

/**
 * Picks from a list of explicit shares (e.g. 54% Somali, 24.5% South Sudanese),
 * so generated populations match the real distribution rather than a guess.
 */
export function pickByShare<T>(
  items: readonly { value: T; share: number }[],
): T {
  const total = items.reduce((sum, item) => sum + item.share, 0);
  let threshold = faker.number.float({ min: 0, max: total });

  for (const item of items) {
    threshold -= item.share;
    if (threshold <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

export function randomInt(min: number, max: number): number {
  if (max <= min) return min;
  return faker.number.int({ min, max });
}

export function randomFloat(min: number, max: number, precision = 2): number {
  return faker.number.float({ min, max, fractionDigits: precision });
}

/** True with the given probability (0-1). */
export function chance(probability: number): boolean {
  return faker.number.float({ min: 0, max: 1 }) < probability;
}

export function randomRange(range: { min: number; max: number }): number {
  return randomInt(range.min, range.max);
}

/** Scales a configured range by an intensity multiplier from the API. */
export function scaleRange(
  range: { min: number; max: number },
  intensity = 1,
): { min: number; max: number } {
  if (intensity === 1) return range;
  return {
    min: Math.max(0, Math.round(range.min * intensity)),
    max: Math.max(0, Math.round(range.max * intensity)),
  };
}

export function randomDateBetween(from: Date, to: Date): Date {
  return faker.date.between({ from, to });
}
