import {
  exampleAdvisorySession,
  exampleBusiness,
  exampleBusinessMetric,
  exampleLoan,
  examplePaginationMeta,
  exampleRepayment,
} from './clients-examples';

export const swaggerDefinitions = {
  listBusinessesOperation: {
    summary: 'List businesses',
    description:
      'Enterprises run by clients, with headcount, market access and current ' +
      'monthly revenue against the baseline captured at enrolment.',
  },
  getBusinessOperation: {
    summary: 'Get one business',
    description: 'Full business record.',
  },
  createBusinessOperation: {
    summary: 'Register a business',
    description:
      'Attaches a business to an existing client. Sector, stage and revenue ' +
      'are generated when omitted.',
  },
  listLoansOperation: {
    summary: 'List loans',
    description:
      'Below-market loans with cycle, risk grade, outstanding balance and ' +
      'arrears. Filter by `status` to isolate the at-risk portfolio.',
  },
  getLoanOperation: {
    summary: 'Get one loan',
    description: 'Loan record including every installment recorded against it.',
  },
  createLoanOperation: {
    summary: 'Create a loan',
    description:
      'Files an application against a business. Pass `disburse: true` to skip ' +
      'straight to a disbursed loan that starts repaying on the next tick.',
  },
  listRepaymentsOperation: {
    summary: 'List loan repayments',
    description:
      'Individual installments, with days late and payment method. The ' +
      'on-time share here is what drives the repayment-rate metric.',
  },
  listAdvisorySessionsOperation: {
    summary: 'List advisory sessions',
    description:
      "Training and coaching touchpoints, delivered in the client's own language.",
  },
  createAdvisorySessionOperation: {
    summary: 'Log an advisory session',
    description: 'Records a coaching or training session for a client.',
  },
  listBusinessMetricsOperation: {
    summary: 'List monthly business metrics',
    description:
      'One row per business per month: revenue, profit, headcount, customers ' +
      'served and growth against the enrolment baseline.',
  },

  listBusinessesSuccess: {
    description: 'Page of businesses',
    schema: {
      example: { data: [exampleBusiness], meta: examplePaginationMeta },
    },
  },
  getBusinessSuccess: {
    description: 'The requested business',
    schema: { example: exampleBusiness },
  },
  businessNotFound: {
    description: 'No business with that code',
    schema: {
      example: {
        statusCode: 404,
        message: 'Business not found: SR-B-KEN-999999',
        error: 'Not Found',
      },
    },
  },
  listLoansSuccess: {
    description: 'Page of loans',
    schema: { example: { data: [exampleLoan], meta: examplePaginationMeta } },
  },
  getLoanSuccess: {
    description: 'The requested loan',
    schema: { example: { ...exampleLoan, repayments: [exampleRepayment] } },
  },
  loanNotFound: {
    description: 'No loan with that code',
    schema: {
      example: {
        statusCode: 404,
        message: 'Loan not found: SR-L-KEN-999999',
        error: 'Not Found',
      },
    },
  },
  createLoanSuccess: {
    description: 'The created loan',
    schema: { example: exampleLoan },
  },
  listRepaymentsSuccess: {
    description: 'Page of repayments',
    schema: {
      example: { data: [exampleRepayment], meta: examplePaginationMeta },
    },
  },
  listAdvisorySessionsSuccess: {
    description: 'Page of advisory sessions',
    schema: {
      example: { data: [exampleAdvisorySession], meta: examplePaginationMeta },
    },
  },
  createAdvisorySessionSuccess: {
    description: 'The logged session',
    schema: { example: exampleAdvisorySession },
  },
  listBusinessMetricsSuccess: {
    description: 'Page of monthly business metrics',
    schema: {
      example: { data: [exampleBusinessMetric], meta: examplePaginationMeta },
    },
  },

  createBusinessExamples: {
    generated: {
      summary: 'Generated from the client and a random sector',
      value: { clientCode: 'SR-C-KEN-000042' },
    },
    detailed: {
      summary: 'Specific business',
      value: {
        clientCode: 'SR-C-KEN-000042',
        name: 'Kalobeyei Solar Point',
        sector: 'Energy',
        stage: 'STARTUP',
        registrationStatus: 'REGISTERED',
        marketAccess: 'HOST_MARKET',
        monthlyRevenueUsd: 640,
        startedYear: 2025,
      },
    },
  },
  createLoanExamples: {
    application: {
      summary: 'New application, left pending for the next tick to decide',
      value: { businessCode: 'SR-B-KEN-000042' },
    },
    disbursed: {
      summary: 'Sized loan, disbursed immediately',
      value: {
        businessCode: 'SR-B-KEN-000042',
        principalUsd: 1200,
        purpose: 'EQUIPMENT',
        termMonths: 18,
        disburse: true,
      },
    },
  },

  businessCodeParam: {
    name: 'businessCode',
    description: 'Business code',
    required: true,
    example: 'SR-B-KEN-000042',
  },
  loanCodeParam: {
    name: 'loanCode',
    description: 'Loan code',
    required: true,
    example: 'SR-L-KEN-000042',
  },
  sectorQueryParam: {
    name: 'sector',
    description: 'Business sector, e.g. "Retail & Trade"',
    required: false,
    example: 'Retail & Trade',
  },
  loanStatusQueryParam: {
    name: 'status',
    description: 'Loan status',
    required: false,
    example: 'REPAYING',
  },
  periodQueryParam: {
    name: 'period',
    description: 'Reporting month as YYYY-MM',
    required: false,
    example: '2026-08',
  },
};
