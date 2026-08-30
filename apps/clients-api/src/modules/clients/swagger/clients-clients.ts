import {
  exampleBusiness,
  exampleClient,
  examplePaginationMeta,
} from './clients-examples';

export const swaggerDefinitions = {
  listClientsOperation: {
    summary: 'List clients',
    description:
      'Paged list of enrolled entrepreneurs. Pass `updatedSince` with the ' +
      '`maxUpdatedAt` from your previous page to pull only what changed since ' +
      'the last fetch — this is how the pipeline ingests incrementally.',
  },
  getClientOperation: {
    summary: 'Get one client',
    description:
      'Full client record including their businesses and loan history.',
  },
  createClientOperation: {
    summary: 'Enrol a client',
    description:
      'Adds a client by hand. Every field except `country` is optional: what ' +
      "you leave out is generated from that country's realistic distributions " +
      '(displacement mix, camp locations, languages, demographics).',
  },

  listClientsSuccess: {
    description: 'Page of clients, oldest change first',
    schema: {
      example: { data: [exampleClient], meta: examplePaginationMeta },
    },
  },
  getClientSuccess: {
    description: 'The requested client',
    schema: { example: exampleClient },
  },
  clientNotFound: {
    description: 'No client with that code',
    schema: {
      example: {
        statusCode: 404,
        message: 'Client not found: SR-C-KEN-999999',
        error: 'Not Found',
      },
    },
  },
  createClientSuccess: {
    description: 'The client, plus the business created alongside them',
    schema: {
      example: { client: exampleClient, business: exampleBusiness },
    },
  },
  createClientBadRequest: {
    description: 'Unknown country, location or sector',
    schema: {
      example: {
        statusCode: 400,
        message:
          'Unknown location for KEN: Nairobi West. Known locations: Kakuma Camp, Kalobeyei Settlement, ...',
        error: 'Bad Request',
      },
    },
  },
  createClientExamples: {
    generated: {
      summary: 'Fully generated — country only',
      value: { country: 'KEN' },
    },
    detailed: {
      summary: 'Specific client with a chosen sector',
      value: {
        country: 'RWA',
        firstName: 'Esperance',
        lastName: 'Uwimana',
        gender: 'FEMALE',
        displacementStatus: 'REFUGEE',
        originCountryIso3: 'BDI',
        locationName: 'Mahama Camp',
        birthYear: 1991,
        educationLevel: 'SECONDARY',
        householdSize: 6,
        sector: 'Tailoring & Textiles',
      },
    },
    hostCommunity: {
      summary: 'Host-community trader, no business yet',
      value: {
        country: 'ETH',
        displacementStatus: 'HOST_COMMUNITY',
        withBusiness: false,
      },
    },
  },

  countryQueryParam: {
    name: 'country',
    description: 'Host country as ISO3 or ISO2 (RWA, KEN, ETH, SSD, TCD)',
    required: false,
    example: 'KEN',
  },
  updatedSinceQueryParam: {
    name: 'updatedSince',
    description:
      "Return only rows changed after this ISO-8601 timestamp; use the previous response's meta.maxUpdatedAt",
    required: false,
    example: '2026-08-30T10:00:00.000Z',
  },
  pageQueryParam: {
    name: 'page',
    description: '1-based page number',
    required: false,
    example: 1,
  },
  limitQueryParam: {
    name: 'limit',
    description: 'Rows per page (max 1000)',
    required: false,
    example: 100,
  },
  clientCodeParam: {
    name: 'clientCode',
    description: 'Client code',
    required: true,
    example: 'SR-C-KEN-000042',
  },
};
