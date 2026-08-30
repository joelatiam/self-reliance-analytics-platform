import {
  BusinessStage,
  BusinessStatus,
  ENTITY_CODE_PREFIX,
  MarketAccess,
  RegistrationStatus,
} from '../clients.constants';
import { ProgramCountry } from '../constants/countries';
import businessSectors, {
  BUSINESS_NAME_QUALIFIERS,
  BUSINESS_NAME_SUFFIXES,
  BusinessSectorDefinition,
  findSector,
} from '../constants/sectors';
import { Business } from '../entities/business.entity';
import { Client } from '../entities/client.entity';
import {
  buildEntityCode,
  parseMoney,
  toMoney,
  usdToLocal,
} from './simulation-format.helper';
import {
  chance,
  pickOne,
  pickWeighted,
  randomFloat,
  randomInt,
} from './simulation-random.helper';

export interface GenerateBusinessOptions {
  client: Pick<
    Client,
    'clientCode' | 'countryIso3' | 'locationName' | 'lastName' | 'gender'
  >;
  country: ProgramCountry;
  sequence: number;
  sectorName?: string;
  /** Enrolment year, so a business never predates the client's arrival. */
  earliestYear?: number;
}

/** Camp businesses stay small; stage scales revenue and headcount. */
const STAGE_REVENUE_MULTIPLIER: Record<BusinessStage, number> = {
  [BusinessStage.IDEA]: 0.15,
  [BusinessStage.STARTUP]: 0.45,
  [BusinessStage.ESTABLISHED]: 1,
  [BusinessStage.GROWTH]: 1.6,
};

export function generateBusinessName(
  lastName: string,
  sector: BusinessSectorDefinition,
): string {
  const style = randomInt(1, 3);
  const qualifier = pickOne(BUSINESS_NAME_QUALIFIERS);
  const suffix = pickOne(BUSINESS_NAME_SUFFIXES);

  if (style === 1) return `${qualifier} ${suffix}`;
  if (style === 2) return `${lastName} ${suffix}`;
  return `${qualifier} ${sector.subSectors[0].split(' ')[0]} ${suffix}`;
}

export function generateBusiness(
  options: GenerateBusinessOptions,
): Partial<Business> {
  const { client, country, sequence } = options;
  const sector =
    (options.sectorName ? findSector(options.sectorName) : undefined) ??
    pickWeighted(businessSectors);

  const stage = pickWeighted([
    BusinessStage.STARTUP,
    BusinessStage.ESTABLISHED,
    BusinessStage.IDEA,
    BusinessStage.GROWTH,
  ]);

  const currentYear = new Date().getFullYear();
  const earliestYear = options.earliestYear ?? currentYear - 8;
  const startedYear = randomInt(
    Math.min(earliestYear, currentYear),
    currentYear,
  );

  const baseRevenueUsd = randomFloat(
    sector.monthlyRevenueUsd.min,
    sector.monthlyRevenueUsd.max,
  );
  const revenueUsd = baseRevenueUsd * STAGE_REVENUE_MULTIPLIER[stage];
  const margin = randomFloat(sector.marginRange.min, sector.marginRange.max, 3);

  const employeesFullTime =
    stage === BusinessStage.IDEA
      ? 0
      : randomInt(0, stage === BusinessStage.GROWTH ? 8 : 3);
  const employeesPartTime = randomInt(0, 4);
  const totalEmployees = employeesFullTime + employeesPartTime;

  return {
    businessCode: buildEntityCode(
      ENTITY_CODE_PREFIX.BUSINESS,
      country.isoAlpha3,
      sequence,
    ),
    clientCode: client.clientCode,
    name: generateBusinessName(client.lastName, sector),
    sector: sector.name,
    subSector: pickOne(sector.subSectors),
    stage,
    registrationStatus: pickWeighted([
      RegistrationStatus.INFORMAL,
      RegistrationStatus.REGISTERED,
      RegistrationStatus.COOPERATIVE,
    ]),
    marketAccess: pickWeighted([
      MarketAccess.CAMP_ONLY,
      MarketAccess.HOST_MARKET,
      MarketAccess.REGIONAL,
      MarketAccess.EXPORT,
    ]),
    countryIso3: country.isoAlpha3,
    locationName: client.locationName,
    startedYear,
    employeesFullTime,
    employeesPartTime,
    employeesFemale: randomInt(0, totalEmployees),
    employeesDisplaced: randomInt(0, totalEmployees),
    currency: country.currency,
    monthlyRevenueLocal: toMoney(usdToLocal(revenueUsd, country.fxRatePerUsd)),
    monthlyRevenueUsd: toMoney(revenueUsd),
    monthlyProfitUsd: toMoney(revenueUsd * margin),
    baselineMonthlyRevenueUsd: toMoney(revenueUsd),
    status: BusinessStatus.ACTIVE,
  };
}

/**
 * Applies one period of trading to a business. Growth is positive on average
 * (supported businesses in these programs report 50-70% revenue growth) but any
 * single month can dip.
 */
export function growBusinessRevenue(
  business: Pick<
    Business,
    | 'monthlyRevenueUsd'
    | 'baselineMonthlyRevenueUsd'
    | 'currency'
    | 'employeesFullTime'
    | 'employeesPartTime'
  >,
  fxRatePerUsd: number,
  hasActiveLoan: boolean,
): {
  monthlyRevenueUsd: string;
  monthlyRevenueLocal: string;
  monthlyProfitUsd: string;
  revenueGrowthPct: string;
} {
  const current = parseMoney(business.monthlyRevenueUsd);
  const baseline = parseMoney(business.baselineMonthlyRevenueUsd) || current;

  // Capital access is the growth lever, so financed businesses trend faster.
  const drift = hasActiveLoan
    ? randomFloat(0.01, 0.09, 3)
    : randomFloat(-0.01, 0.05, 3);
  const shock = chance(0.12) ? randomFloat(-0.18, -0.03, 3) : 0;
  const nextRevenue = Math.max(20, current * (1 + drift + shock));

  const margin = randomFloat(0.12, 0.32, 3);
  const growthPct =
    baseline > 0 ? ((nextRevenue - baseline) / baseline) * 100 : 0;

  return {
    monthlyRevenueUsd: toMoney(nextRevenue),
    monthlyRevenueLocal: toMoney(usdToLocal(nextRevenue, fxRatePerUsd)),
    monthlyProfitUsd: toMoney(nextRevenue * margin),
    revenueGrowthPct: toMoney(growthPct),
  };
}

export function nextBusinessStatus(current: BusinessStatus): BusinessStatus {
  if (current !== BusinessStatus.ACTIVE) return current;
  if (chance(0.01)) return BusinessStatus.SUSPENDED;
  return BusinessStatus.ACTIVE;
}
