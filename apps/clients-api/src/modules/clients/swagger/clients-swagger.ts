import { swaggerDefinitions as clientsSwaggerDefinitions } from './clients-clients';
import { swaggerDefinitions as portfolioSwaggerDefinitions } from './clients-portfolio';
import { swaggerDefinitions as simulationSwaggerDefinitions } from './clients-simulation';

export const swaggerDefinitions = {
  // Service
  homeOperation: simulationSwaggerDefinitions.homeOperation,
  homeResponse: simulationSwaggerDefinitions.homeResponse,
  referenceOperation: simulationSwaggerDefinitions.referenceOperation,
  referenceSuccess: simulationSwaggerDefinitions.referenceSuccess,

  // Clients
  listClientsOperation: clientsSwaggerDefinitions.listClientsOperation,
  listClientsSuccess: clientsSwaggerDefinitions.listClientsSuccess,
  getClientOperation: clientsSwaggerDefinitions.getClientOperation,
  getClientSuccess: clientsSwaggerDefinitions.getClientSuccess,
  clientNotFound: clientsSwaggerDefinitions.clientNotFound,
  createClientOperation: clientsSwaggerDefinitions.createClientOperation,
  createClientSuccess: clientsSwaggerDefinitions.createClientSuccess,
  createClientBadRequest: clientsSwaggerDefinitions.createClientBadRequest,
  createClientExamples: clientsSwaggerDefinitions.createClientExamples,

  // Shared query and path parameters
  countryQueryParam: clientsSwaggerDefinitions.countryQueryParam,
  updatedSinceQueryParam: clientsSwaggerDefinitions.updatedSinceQueryParam,
  pageQueryParam: clientsSwaggerDefinitions.pageQueryParam,
  limitQueryParam: clientsSwaggerDefinitions.limitQueryParam,
  clientCodeParam: clientsSwaggerDefinitions.clientCodeParam,
  businessCodeParam: portfolioSwaggerDefinitions.businessCodeParam,
  loanCodeParam: portfolioSwaggerDefinitions.loanCodeParam,
  sectorQueryParam: portfolioSwaggerDefinitions.sectorQueryParam,
  loanStatusQueryParam: portfolioSwaggerDefinitions.loanStatusQueryParam,
  periodQueryParam: portfolioSwaggerDefinitions.periodQueryParam,

  // Businesses
  listBusinessesOperation: portfolioSwaggerDefinitions.listBusinessesOperation,
  listBusinessesSuccess: portfolioSwaggerDefinitions.listBusinessesSuccess,
  getBusinessOperation: portfolioSwaggerDefinitions.getBusinessOperation,
  getBusinessSuccess: portfolioSwaggerDefinitions.getBusinessSuccess,
  businessNotFound: portfolioSwaggerDefinitions.businessNotFound,
  createBusinessOperation: portfolioSwaggerDefinitions.createBusinessOperation,
  createBusinessExamples: portfolioSwaggerDefinitions.createBusinessExamples,

  // Loans and repayments
  listLoansOperation: portfolioSwaggerDefinitions.listLoansOperation,
  listLoansSuccess: portfolioSwaggerDefinitions.listLoansSuccess,
  getLoanOperation: portfolioSwaggerDefinitions.getLoanOperation,
  getLoanSuccess: portfolioSwaggerDefinitions.getLoanSuccess,
  loanNotFound: portfolioSwaggerDefinitions.loanNotFound,
  createLoanOperation: portfolioSwaggerDefinitions.createLoanOperation,
  createLoanSuccess: portfolioSwaggerDefinitions.createLoanSuccess,
  createLoanExamples: portfolioSwaggerDefinitions.createLoanExamples,
  listRepaymentsOperation: portfolioSwaggerDefinitions.listRepaymentsOperation,
  listRepaymentsSuccess: portfolioSwaggerDefinitions.listRepaymentsSuccess,

  // Advisory and metrics
  listAdvisorySessionsOperation:
    portfolioSwaggerDefinitions.listAdvisorySessionsOperation,
  listAdvisorySessionsSuccess:
    portfolioSwaggerDefinitions.listAdvisorySessionsSuccess,
  createAdvisorySessionOperation:
    portfolioSwaggerDefinitions.createAdvisorySessionOperation,
  createAdvisorySessionSuccess:
    portfolioSwaggerDefinitions.createAdvisorySessionSuccess,
  listBusinessMetricsOperation:
    portfolioSwaggerDefinitions.listBusinessMetricsOperation,
  listBusinessMetricsSuccess:
    portfolioSwaggerDefinitions.listBusinessMetricsSuccess,

  // Simulation control
  seedOperation: simulationSwaggerDefinitions.seedOperation,
  seedSuccess: simulationSwaggerDefinitions.seedSuccess,
  seedExamples: simulationSwaggerDefinitions.seedExamples,
  triggerTickOperation: simulationSwaggerDefinitions.triggerTickOperation,
  triggerTickSuccess: simulationSwaggerDefinitions.triggerTickSuccess,
  triggerTickExamples: simulationSwaggerDefinitions.triggerTickExamples,
  statusOperation: simulationSwaggerDefinitions.statusOperation,
  statusSuccess: simulationSwaggerDefinitions.statusSuccess,
  summaryOperation: simulationSwaggerDefinitions.summaryOperation,
  summarySuccess: simulationSwaggerDefinitions.summarySuccess,
};
