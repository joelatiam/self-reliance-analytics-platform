import {
  addDays,
  addMonths,
  buildAdvisorCode,
  buildEntityCode,
  daysBetween,
  parseMoney,
  toCohort,
  toIsoDate,
  toMoney,
  toPeriod,
  usdToLocal,
} from './simulation-format.helper';
import { ENTITY_CODE_PREFIX } from '../clients.constants';

describe('simulation format helpers', () => {
  it('builds traceable entity codes', () => {
    expect(buildEntityCode(ENTITY_CODE_PREFIX.LOAN, 'KEN', 42)).toBe(
      'SR-L-KEN-000042',
    );
    expect(buildAdvisorCode('RWA', 4)).toBe('SR-ADV-RWA-004');
  });

  it('formats and parses money without floating point drift', () => {
    expect(toMoney(843.754999)).toBe('843.75');
    expect(parseMoney('843.75')).toBe(843.75);
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney('not-a-number')).toBe(0);
  });

  it('converts USD to local currency', () => {
    expect(usdToLocal(750, 129)).toBe(96750);
  });

  it('derives date, period and cohort keys', () => {
    const date = new Date('2026-08-30T10:25:00Z');
    expect(toIsoDate(date)).toBe('2026-08-30');
    expect(toPeriod(date)).toBe('2026-08');
    expect(toCohort(date)).toBe('2026-Q3');
  });

  it('shifts dates by months and days', () => {
    expect(toIsoDate(addMonths(new Date('2026-06-05T00:00:00Z'), 12))).toBe(
      '2027-06-05',
    );
    expect(toIsoDate(addDays(new Date('2026-06-05T00:00:00Z'), -5))).toBe(
      '2026-05-31',
    );
    expect(
      daysBetween(
        new Date('2026-06-01T00:00:00Z'),
        new Date('2026-06-11T00:00:00Z'),
      ),
    ).toBe(10);
  });
});
