import { ENTITY_CODE_PREFIX } from '../clients.constants';
import { randomInt } from './simulation-random.helper';

/** Business codes read as SR-B-KEN-000417: prefix, country, running number. */
export function buildEntityCode(
  prefix: (typeof ENTITY_CODE_PREFIX)[keyof typeof ENTITY_CODE_PREFIX],
  countryIso3: string,
  sequence: number,
): string {
  return `${prefix}-${countryIso3}-${String(sequence).padStart(6, '0')}`;
}

/** Advisors are staff, not clients, so their codes carry no sequence padding. */
export function buildAdvisorCode(countryIso3: string, index: number): string {
  return `${ENTITY_CODE_PREFIX.ADVISOR}-${countryIso3}-${String(index).padStart(3, '0')}`;
}

/** Keeps the shape of a real MSISDN without ever producing a dialable number. */
export function buildMaskedPhone(phonePrefix: string): string {
  const last = String(randomInt(0, 99)).padStart(2, '0');
  return `+${phonePrefix} ${'*'.repeat(6)}${last}`;
}

export function toMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function usdToLocal(amountUsd: number, fxRatePerUsd: number): number {
  return Math.round(amountUsd * fxRatePerUsd);
}

/** ISO date (YYYY-MM-DD) for Postgres `date` columns. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Reporting period key (YYYY-MM). */
export function toPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Calendar quarter label used for enrolment cohorts, e.g. 2026-Q1. */
export function toCohort(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export function daysBetween(from: Date, to: Date): number {
  const millisPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / millisPerDay);
}
