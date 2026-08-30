import { DisplacementStatus } from '../clients.constants';

/**
 * Displacement figures used to distribute a generated caseload realistically.
 *
 * Populations are indicative UNHCR mid-2024 orders of magnitude for people of
 * concern hosted by each country, and the origin shares reflect who those
 * people actually are — Sudanese in Chad, Somalis in Kenya, Congolese and
 * Burundians in Rwanda. They exist so a generated dataset has the same shape as
 * the real one: Chad and Ethiopia dominate, Rwanda is a rounding error beside
 * them, and nobody is given a nationality that does not appear in that country.
 */

export interface PopulationShare<T = string> {
  value: T;
  /** Share of the country's caseload, 0-1. Shares sum to 1 per country. */
  share: number;
}

export interface HostCountryPopulation {
  iso3: string;
  /** People of concern hosted, used as the weight when splitting a caseload. */
  displacedPopulation: number;
  /** Nationalities present among the displaced population. */
  originShares: PopulationShare[];
  /** Mix of displacement categories, including the host community the program serves. */
  displacementShares: PopulationShare<DisplacementStatus>[];
}

const hostCountryPopulations: HostCountryPopulation[] = [
  {
    // Sudan's war made Chad the largest operation of the five.
    iso3: 'TCD',
    displacedPopulation: 1_300_000,
    originShares: [
      { value: 'SDN', share: 0.78 },
      { value: 'CAF', share: 0.15 },
      { value: 'NGA', share: 0.04 },
      { value: 'CMR', share: 0.03 },
    ],
    displacementShares: [
      { value: DisplacementStatus.REFUGEE, share: 0.62 },
      { value: DisplacementStatus.HOST_COMMUNITY, share: 0.2 },
      { value: DisplacementStatus.ASYLUM_SEEKER, share: 0.08 },
      { value: DisplacementStatus.IDP, share: 0.07 },
      { value: DisplacementStatus.RETURNED_REFUGEE, share: 0.03 },
    ],
  },
  {
    iso3: 'ETH',
    displacedPopulation: 1_060_000,
    originShares: [
      { value: 'SSD', share: 0.4 },
      { value: 'SOM', share: 0.28 },
      { value: 'ERI', share: 0.2 },
      { value: 'SDN', share: 0.12 },
    ],
    displacementShares: [
      { value: DisplacementStatus.REFUGEE, share: 0.55 },
      { value: DisplacementStatus.HOST_COMMUNITY, share: 0.22 },
      { value: DisplacementStatus.IDP, share: 0.13 },
      { value: DisplacementStatus.RETURNED_IDP, share: 0.06 },
      { value: DisplacementStatus.ASYLUM_SEEKER, share: 0.04 },
    ],
  },
  {
    // Hosts Sudanese refugees while carrying one of the largest IDP caseloads.
    iso3: 'SSD',
    displacedPopulation: 900_000,
    originShares: [
      { value: 'SDN', share: 0.8 },
      { value: 'COD', share: 0.12 },
      { value: 'ETH', share: 0.06 },
      { value: 'CAF', share: 0.02 },
    ],
    displacementShares: [
      { value: DisplacementStatus.IDP, share: 0.42 },
      { value: DisplacementStatus.RETURNED_REFUGEE, share: 0.2 },
      { value: DisplacementStatus.HOST_COMMUNITY, share: 0.18 },
      { value: DisplacementStatus.REFUGEE, share: 0.14 },
      { value: DisplacementStatus.RETURNED_IDP, share: 0.06 },
    ],
  },
  {
    iso3: 'KEN',
    displacedPopulation: 800_000,
    originShares: [
      { value: 'SOM', share: 0.54 },
      { value: 'SSD', share: 0.245 },
      { value: 'COD', share: 0.089 },
      { value: 'ETH', share: 0.058 },
      { value: 'SDN', share: 0.038 },
      { value: 'BDI', share: 0.03 },
    ],
    displacementShares: [
      { value: DisplacementStatus.REFUGEE, share: 0.6 },
      { value: DisplacementStatus.HOST_COMMUNITY, share: 0.24 },
      { value: DisplacementStatus.ASYLUM_SEEKER, share: 0.12 },
      { value: DisplacementStatus.STATELESS, share: 0.04 },
    ],
  },
  {
    iso3: 'RWA',
    displacedPopulation: 135_000,
    originShares: [
      { value: 'COD', share: 0.62 },
      { value: 'BDI', share: 0.38 },
    ],
    displacementShares: [
      { value: DisplacementStatus.REFUGEE, share: 0.63 },
      { value: DisplacementStatus.HOST_COMMUNITY, share: 0.25 },
      { value: DisplacementStatus.ASYLUM_SEEKER, share: 0.08 },
      { value: DisplacementStatus.RETURNED_REFUGEE, share: 0.04 },
    ],
  },
];

export default hostCountryPopulations;

export function findHostPopulation(
  iso3: string,
): HostCountryPopulation | undefined {
  return hostCountryPopulations.find(
    (entry) => entry.iso3 === iso3.toUpperCase(),
  );
}

/**
 * Splits `total` clients across the given countries in proportion to the
 * displaced population each one hosts, using largest remainders so the parts
 * add back up to exactly `total`.
 */
export function allocateByPopulation(
  total: number,
  countryIso3Codes: string[],
): Record<string, number> {
  const populations = countryIso3Codes.map((iso3) => ({
    iso3,
    weight: findHostPopulation(iso3)?.displacedPopulation ?? 0,
  }));

  const totalWeight = populations.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0 || total <= 0) {
    return Object.fromEntries(countryIso3Codes.map((iso3) => [iso3, 0]));
  }

  const exact = populations.map((entry) => ({
    iso3: entry.iso3,
    value: (entry.weight / totalWeight) * total,
  }));

  const allocation: Record<string, number> = {};
  let assigned = 0;
  for (const entry of exact) {
    allocation[entry.iso3] = Math.floor(entry.value);
    assigned += allocation[entry.iso3];
  }

  // Hand the leftover units to whoever was rounded down hardest.
  const remainders = exact
    .map((entry) => ({
      iso3: entry.iso3,
      remainder: entry.value - Math.floor(entry.value),
    }))
    .sort((a, b) => b.remainder - a.remainder);

  let index = 0;
  while (assigned < total && remainders.length > 0) {
    allocation[remainders[index % remainders.length].iso3] += 1;
    assigned += 1;
    index += 1;
  }

  return allocation;
}
