import {
  ClientStatus,
  DisplacementStatus,
  DISPLACED_STATUSES,
  EducationLevel,
  ENTITY_CODE_PREFIX,
  Gender,
  ProgramTrack,
} from '../clients.constants';
import { ProgramCountry } from '../constants/countries';
import { findHostPopulation } from '../constants/refugee-populations';
import {
  getFamilyNamePool,
  getGivenNamePool,
  resolveNameRegion,
} from '../constants/names';
import { Client } from '../entities/client.entity';
import {
  addDays,
  buildAdvisorCode,
  buildEntityCode,
  buildMaskedPhone,
  toCohort,
  toIsoDate,
} from './simulation-format.helper';
import {
  chance,
  pickByShare,
  pickOne,
  pickWeighted,
  randomInt,
} from './simulation-random.helper';

/** Advisors per country office; clients are assigned round-robin-ish. */
const ADVISORS_PER_COUNTRY = 12;

export interface GenerateClientOptions {
  country: ProgramCountry;
  sequence: number;
  enrolledOn?: Date;
  displacementStatus?: DisplacementStatus;
  gender?: Gender;
}

export function isDisplaced(status: DisplacementStatus): boolean {
  return (DISPLACED_STATUSES as readonly DisplacementStatus[]).includes(status);
}

/**
 * ~58% women and ~57% youth across the caseload, matching the demographic
 * split these programs report, with displacement status weighted by host
 * country.
 */
export function generateClient(
  options: GenerateClientOptions,
): Partial<Client> {
  const { country, sequence } = options;
  const enrolledOn = options.enrolledOn ?? new Date();

  const population = findHostPopulation(country.isoAlpha3);

  const gender = options.gender ?? (chance(0.58) ? Gender.FEMALE : Gender.MALE);
  const displacementStatus =
    options.displacementStatus ??
    (population
      ? pickByShare(population.displacementShares)
      : pickWeighted(country.displacementMix));
  const displaced = isDisplaced(displacementStatus);

  // Nationalities follow the real origin mix for this host country.
  const originCountryIso3 = displaced
    ? population
      ? pickByShare(population.originShares)
      : pickWeighted(country.originCountries)
    : null;

  const nameRegion = resolveNameRegion(originCountryIso3 ?? country.isoAlpha3);
  const firstName = pickOne(getGivenNamePool(nameRegion, gender));
  const lastName = pickOne(getFamilyNamePool(nameRegion));

  // Youth is 18-35; the remainder skews to established traders in their 40s.
  const age = chance(0.57) ? randomInt(18, 35) : randomInt(36, 62);
  const birthYear = enrolledOn.getFullYear() - age;

  const location = displaced
    ? pickWeighted(
        country.locations.filter((l) => l.isCamp).length
          ? country.locations.filter((l) => l.isCamp)
          : country.locations,
      )
    : pickOne(country.locations);

  const householdSize = randomInt(2, 11);

  return {
    clientCode: buildEntityCode(
      ENTITY_CODE_PREFIX.CLIENT,
      country.isoAlpha3,
      sequence,
    ),
    firstName,
    lastName,
    gender,
    birthYear,
    isYouth: age <= 35,
    countryIso3: country.isoAlpha3,
    countryIso2: country.isoAlpha2,
    locationName: location.name,
    region: location.region,
    inCamp: location.isCamp,
    displacementStatus,
    originCountryIso3,
    arrivalYear: displaced
      ? randomInt(
          Math.max(2010, enrolledOn.getFullYear() - 14),
          enrolledOn.getFullYear(),
        )
      : null,
    householdSize,
    dependents: randomInt(0, householdSize - 1),
    educationLevel: pickWeighted([
      EducationLevel.PRIMARY,
      EducationLevel.SECONDARY,
      EducationLevel.NONE,
      EducationLevel.VOCATIONAL,
      EducationLevel.TERTIARY,
    ]),
    primaryLanguage: pickWeighted(country.languages),
    phoneMasked: buildMaskedPhone(country.phonePrefix),
    programTrack: pickWeighted([
      ProgramTrack.ADVISORY,
      ProgramTrack.FINANCING,
      ProgramTrack.MARKET_ACCESS,
    ]),
    cohort: toCohort(enrolledOn),
    enrolledOn: toIsoDate(enrolledOn),
    advisorCode: buildAdvisorCode(
      country.isoAlpha3,
      randomInt(1, ADVISORS_PER_COUNTRY),
    ),
    status: ClientStatus.ENROLLED,
  };
}

/**
 * Clients move ENROLLED -> ACTIVE once they start trading, and a small share
 * graduate out of the program or go dormant over time.
 */
export function nextClientStatus(
  current: ClientStatus,
  enrolledOn: string,
  now: Date = new Date(),
): ClientStatus {
  const monthsEnrolled =
    (now.getTime() - new Date(enrolledOn).getTime()) /
    (1000 * 60 * 60 * 24 * 30);

  if (current === ClientStatus.ENROLLED) {
    return chance(0.7) ? ClientStatus.ACTIVE : ClientStatus.ENROLLED;
  }
  if (current === ClientStatus.ACTIVE) {
    if (monthsEnrolled > 18 && chance(0.06)) return ClientStatus.GRADUATED;
    if (chance(0.03)) return ClientStatus.DORMANT;
    return ClientStatus.ACTIVE;
  }
  if (current === ClientStatus.DORMANT) {
    return chance(0.35) ? ClientStatus.ACTIVE : ClientStatus.DORMANT;
  }
  return current;
}

/** Enrolment dates for the initial seed, spread over the past two years. */
export function backdatedEnrolmentDate(now: Date = new Date()): Date {
  return addDays(now, -randomInt(0, 730));
}
