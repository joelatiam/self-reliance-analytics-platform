import {
  exampleActivityTick,
  examplePortfolioSummary,
} from './clients-examples';

export const swaggerDefinitions = {
  homeOperation: {
    summary: 'Get service info',
    description: 'Returns the name of the service, for connectivity testing.',
  },
  referenceOperation: {
    summary: 'Get reference data',
    description:
      'Countries, camp and settlement names, origin countries, languages and ' +
      'business sectors the simulator uses — the valid values for every filter.',
  },
  seedOperation: {
    summary: 'Seed a caseload',
    description:
      'Bulk-enrols clients with businesses and backdated loan history. Runs ' +
      'automatically on first boot when the database is empty; use this to top ' +
      'up or to rebuild after a reset.',
  },
  triggerTickOperation: {
    summary: 'Trigger an activity tick',
    description:
      'Runs one round of simulated activity immediately instead of waiting for ' +
      'the scheduled tick: new enrolments, loan decisions, disbursements, ' +
      'repayments, coaching sessions and monthly business results. Raise ' +
      '`intensity` to generate more in one go.',
  },
  statusOperation: {
    summary: 'Get simulation status',
    description:
      "Schedule, next tick time, configured countries, the last tick's counts " +
      'and row totals per table.',
  },
  summaryOperation: {
    summary: 'Get portfolio summary',
    description:
      'Impact-style rollup: caseload demographics, jobs supported, revenue ' +
      'growth, disbursed and outstanding capital, on-time repayment rate and ' +
      'portfolio at risk.',
  },

  homeResponse: {
    status: 200,
    description: 'Service name',
    schema: {
      example:
        'Self-Reliance Clients API — simulated client, business and loan activity',
    },
  },
  referenceSuccess: {
    description: 'Reference data',
    schema: {
      example: {
        countries: [
          {
            isoAlpha3: 'KEN',
            isoAlpha2: 'KE',
            name: 'Kenya',
            currency: 'KES',
            locations: [
              'Kakuma Camp',
              'Kalobeyei Settlement',
              'Dagahaley Camp',
            ],
            originCountries: ['SOM', 'SSD', 'COD', 'ETH', 'BDI'],
            languages: ['Swahili', 'Somali', 'English'],
          },
        ],
        sectors: [
          {
            name: 'Retail & Trade',
            subSectors: ['General shop', 'Kiosk', 'Second-hand clothing'],
            typicalLoanRangeUsd: { min: 200, max: 3500 },
          },
        ],
      },
    },
  },
  seedSuccess: {
    description: 'Counts created by the seed',
    schema: { example: { clients: 100, businesses: 100, loans: 96 } },
  },
  seedExamples: {
    default: {
      summary: 'Seed 100 clients across all configured countries',
      value: { clients: 100 },
    },
    singleCountry: {
      summary: 'Seed one country with no backdated history',
      value: { clients: 25, country: 'TCD', withHistory: false },
    },
  },
  triggerTickSuccess: {
    description: 'Counts produced by the tick',
    schema: { example: exampleActivityTick },
  },
  triggerTickAccepted: {
    description: 'Tick started in the background',
    schema: {
      example: { started: true, source: 'api', countryIso3: 'KEN' },
    },
  },
  triggerTickExamples: {
    default: {
      summary: 'One normal tick across all countries',
      value: {},
    },
    burst: {
      summary: 'Five times the usual volume, Kenya only',
      value: { country: 'KEN', intensity: 5 },
    },
    background: {
      summary: 'Fire and forget',
      value: { wait: false },
    },
  },
  statusSuccess: {
    description: 'Current simulation state',
    schema: {
      example: {
        cronEnabled: true,
        tickCron: '5-59/10 * * * *',
        tickMinutes: [5, 15, 25, 35, 45, 55],
        nextTickAt: '2026-08-30T10:35:00.000Z',
        isRunning: false,
        countries: ['RWA', 'KEN', 'ETH', 'SSD', 'TCD'],
        lastTick: exampleActivityTick,
        totals: {
          clients: 1240,
          businesses: 1240,
          loans: 968,
          repayments: 5412,
          advisorySessions: 4820,
          businessMetrics: 3106,
          ticks: 288,
        },
      },
    },
  },
  summarySuccess: {
    description: 'Portfolio rollup',
    schema: { example: examplePortfolioSummary },
  },

  intensityQueryParam: {
    name: 'intensity',
    description: 'Multiplier on the configured per-tick volumes',
    required: false,
    example: 1,
  },
};
