import { ProgramCountry } from '../constants/countries';
import { Business } from '../entities/business.entity';
import { BusinessMonthlyMetric } from '../entities/business-monthly-metric.entity';
import { growBusinessRevenue } from './business-generator.helper';
import { parseMoney, toMoney, toPeriod } from './simulation-format.helper';
import { randomInt } from './simulation-random.helper';

export interface GenerateBusinessMetricOptions {
  business: Business;
  country: ProgramCountry;
  hasActiveLoan: boolean;
  period?: string;
}

export interface GeneratedBusinessMetric {
  metric: Partial<BusinessMonthlyMetric>;
  /** Revenue figures to write back onto the business row. */
  businessUpdate: Partial<Business>;
}

/**
 * Produces the monthly snapshot for a business and advances its headline
 * revenue, so the mart layer can report growth against the enrolment baseline.
 */
export function generateBusinessMetric(
  options: GenerateBusinessMetricOptions,
): GeneratedBusinessMetric {
  const { business, country, hasActiveLoan } = options;
  const period = options.period ?? toPeriod(new Date());

  const grown = growBusinessRevenue(
    business,
    country.fxRatePerUsd,
    hasActiveLoan,
  );
  const employeesTotal =
    business.employeesFullTime + business.employeesPartTime;
  const revenueUsd = parseMoney(grown.monthlyRevenueUsd);

  return {
    metric: {
      businessCode: business.businessCode,
      clientCode: business.clientCode,
      countryIso3: business.countryIso3,
      period,
      currency: business.currency,
      revenueLocal: grown.monthlyRevenueLocal,
      revenueUsd: grown.monthlyRevenueUsd,
      profitUsd: grown.monthlyProfitUsd,
      employeesTotal,
      // Ticket sizes in camp markets are small, so customer counts run high.
      customersServed: randomInt(
        Math.round(revenueUsd / 12),
        Math.round(revenueUsd / 2) + 20,
      ),
      revenueGrowthPct: grown.revenueGrowthPct,
    },
    businessUpdate: {
      monthlyRevenueUsd: grown.monthlyRevenueUsd,
      monthlyRevenueLocal: grown.monthlyRevenueLocal,
      monthlyProfitUsd: grown.monthlyProfitUsd,
    },
  };
}

/** Growth percentage of a business against its enrolment baseline. */
export function revenueGrowthPct(
  business: Pick<Business, 'monthlyRevenueUsd' | 'baselineMonthlyRevenueUsd'>,
): string {
  const baseline = parseMoney(business.baselineMonthlyRevenueUsd);
  if (baseline <= 0) return toMoney(0);
  const current = parseMoney(business.monthlyRevenueUsd);
  return toMoney(((current - baseline) / baseline) * 100);
}
