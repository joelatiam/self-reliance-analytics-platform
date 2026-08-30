import hostCountryPopulations, {
  allocateByPopulation,
  findHostPopulation,
} from './refugee-populations';
import { PROGRAM_COUNTRY_ISO3 } from './countries';

describe('refugee population distribution', () => {
  it('covers every program country', () => {
    for (const iso3 of PROGRAM_COUNTRY_ISO3) {
      expect(findHostPopulation(iso3)).toBeDefined();
    }
  });

  it('has origin and displacement shares that sum to 1 per country', () => {
    for (const country of hostCountryPopulations) {
      const origins = country.originShares.reduce((sum, s) => sum + s.share, 0);
      const statuses = country.displacementShares.reduce(
        (sum, s) => sum + s.share,
        0,
      );
      expect(origins).toBeCloseTo(1, 5);
      expect(statuses).toBeCloseTo(1, 5);
    }
  });

  it('never assigns a nationality that country does not host', () => {
    // Rwanda hosts Congolese and Burundians, not Somalis.
    const rwanda = findHostPopulation('RWA');
    expect(rwanda?.originShares.map((s) => s.value).sort()).toEqual([
      'BDI',
      'COD',
    ]);
  });

  it('splits a caseload in proportion to hosted population', () => {
    const allocation = allocateByPopulation(1000, PROGRAM_COUNTRY_ISO3);

    // Chad hosts the most people of the five, Rwanda by far the fewest.
    expect(allocation.TCD).toBeGreaterThan(allocation.ETH);
    expect(allocation.ETH).toBeGreaterThan(allocation.SSD);
    expect(allocation.SSD).toBeGreaterThan(allocation.KEN);
    expect(allocation.KEN).toBeGreaterThan(allocation.RWA);
  });

  it('allocates exactly the requested total, including awkward numbers', () => {
    for (const total of [1, 7, 999, 1000, 500_000, 1_000_000]) {
      const allocation = allocateByPopulation(total, PROGRAM_COUNTRY_ISO3);
      const sum = Object.values(allocation).reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });

  it('gives everything to the only country in scope', () => {
    expect(allocateByPopulation(250, ['TCD'])).toEqual({ TCD: 250 });
  });

  it('returns zeros for an empty request', () => {
    expect(allocateByPopulation(0, ['TCD', 'RWA'])).toEqual({ TCD: 0, RWA: 0 });
  });
});
