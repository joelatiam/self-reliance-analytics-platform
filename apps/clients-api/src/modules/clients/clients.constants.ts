/**
 * Domain vocabulary for the program's client base: displacement-affected
 * entrepreneurs (refugees, returnees, IDPs) and the host communities they
 * trade with, across Rwanda, Kenya, Ethiopia, South Sudan and Chad.
 */

/** Mirrors the UNHCR population categories the pipeline already ingests. */
export enum DisplacementStatus {
  REFUGEE = 'REFUGEE',
  ASYLUM_SEEKER = 'ASYLUM_SEEKER',
  RETURNED_REFUGEE = 'RETURNED_REFUGEE',
  IDP = 'IDP',
  RETURNED_IDP = 'RETURNED_IDP',
  STATELESS = 'STATELESS',
  HOST_COMMUNITY = 'HOST_COMMUNITY',
}

/** Displacement statuses that count as displaced for impact reporting. */
export const DISPLACED_STATUSES = [
  DisplacementStatus.REFUGEE,
  DisplacementStatus.ASYLUM_SEEKER,
  DisplacementStatus.RETURNED_REFUGEE,
  DisplacementStatus.IDP,
  DisplacementStatus.RETURNED_IDP,
  DisplacementStatus.STATELESS,
] as const;

export enum ClientStatus {
  ENROLLED = 'ENROLLED',
  ACTIVE = 'ACTIVE',
  GRADUATED = 'GRADUATED',
  DORMANT = 'DORMANT',
  EXITED = 'EXITED',
}

export enum Gender {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
}

export enum EducationLevel {
  NONE = 'NONE',
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  VOCATIONAL = 'VOCATIONAL',
  TERTIARY = 'TERTIARY',
}

/** The program's three service pillars. */
export enum ProgramTrack {
  ADVISORY = 'ADVISORY',
  FINANCING = 'FINANCING',
  MARKET_ACCESS = 'MARKET_ACCESS',
}

export enum BusinessStage {
  IDEA = 'IDEA',
  STARTUP = 'STARTUP',
  ESTABLISHED = 'ESTABLISHED',
  GROWTH = 'GROWTH',
}

export enum RegistrationStatus {
  INFORMAL = 'INFORMAL',
  COOPERATIVE = 'COOPERATIVE',
  REGISTERED = 'REGISTERED',
}

export enum MarketAccess {
  CAMP_ONLY = 'CAMP_ONLY',
  HOST_MARKET = 'HOST_MARKET',
  REGIONAL = 'REGIONAL',
  EXPORT = 'EXPORT',
}

export enum BusinessStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
}

export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DISBURSED = 'DISBURSED',
  REPAYING = 'REPAYING',
  LATE = 'LATE',
  REPAID = 'REPAID',
  DEFAULTED = 'DEFAULTED',
  WRITTEN_OFF = 'WRITTEN_OFF',
  REJECTED = 'REJECTED',
}

/** Loans still owing money — used for portfolio-at-risk style rollups. */
export const OUTSTANDING_LOAN_STATUSES = [
  LoanStatus.DISBURSED,
  LoanStatus.REPAYING,
  LoanStatus.LATE,
] as const;

export enum LoanPurpose {
  WORKING_CAPITAL = 'WORKING_CAPITAL',
  INVENTORY = 'INVENTORY',
  EQUIPMENT = 'EQUIPMENT',
  EXPANSION = 'EXPANSION',
  PREMISES = 'PREMISES',
  INPUTS = 'INPUTS',
}

export enum RiskGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum RepaymentMethod {
  MOBILE_MONEY = 'MOBILE_MONEY',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  SACCO = 'SACCO',
}

export enum AdvisorySessionType {
  GROUP_TRAINING = 'GROUP_TRAINING',
  ONE_ON_ONE_COACHING = 'ONE_ON_ONE_COACHING',
  FINANCIAL_LITERACY = 'FINANCIAL_LITERACY',
  MARKET_LINKAGE = 'MARKET_LINKAGE',
  LOAN_READINESS = 'LOAN_READINESS',
  BOOKKEEPING = 'BOOKKEEPING',
}

/** What triggered a simulation tick. */
export enum ActivityTickSource {
  CRON = 'cron',
  API = 'api',
  SEED = 'seed',
}

/** Code prefixes so every generated row is traceable to its entity type. */
export const ENTITY_CODE_PREFIX = {
  CLIENT: 'SR-C',
  BUSINESS: 'SR-B',
  LOAN: 'SR-L',
  REPAYMENT: 'SR-R',
  ADVISORY: 'SR-A',
  ADVISOR: 'SR-ADV',
} as const;
