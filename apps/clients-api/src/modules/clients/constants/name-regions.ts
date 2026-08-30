import { Gender } from '../clients.constants';
import { NAME_POOLS, NameRegion } from './name-pools';

/**
 * Lookup from a country to a naming region. A client's names follow their
 * origin community, not their host country, so a Somali living in Kakuma is not
 * given a Turkana surname.
 *
 * Depends on name-pools and not the other way round: the reverse was a cycle,
 * which left NAME_POOLS undefined at module initialisation.
 */

/** Origin (or host) country ISO3 -> naming region. */
const REGION_BY_ISO3: Record<string, NameRegion> = {
  RWA: NameRegion.GREAT_LAKES,
  BDI: NameRegion.GREAT_LAKES,
  COD: NameRegion.GREAT_LAKES,
  KEN: NameRegion.HORN_OF_AFRICA,
  ETH: NameRegion.HORN_OF_AFRICA,
  SOM: NameRegion.HORN_OF_AFRICA,
  ERI: NameRegion.HORN_OF_AFRICA,
  SSD: NameRegion.NILE_VALLEY,
  SDN: NameRegion.NILE_VALLEY,
  TCD: NameRegion.SAHEL,
  CAF: NameRegion.SAHEL,
  NGA: NameRegion.SAHEL,
  CMR: NameRegion.SAHEL,
};

export function resolveNameRegion(iso3: string): NameRegion {
  return REGION_BY_ISO3[iso3.toUpperCase()] ?? NameRegion.GREAT_LAKES;
}

export function getGivenNamePool(region: NameRegion, gender: Gender): string[] {
  const pool = NAME_POOLS[region];
  return gender === Gender.FEMALE ? pool.female : pool.male;
}

export function getFamilyNamePool(region: NameRegion): string[] {
  return NAME_POOLS[region].family;
}
