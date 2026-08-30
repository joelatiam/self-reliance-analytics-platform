import {
  ENTITY_CODE_PREFIX,
  LoanPurpose,
  LoanStatus,
  RiskGrade,
} from '../clients.constants';
import { ProgramCountry } from '../constants/countries';
import { findSector } from '../constants/sectors';
import { Business } from '../entities/business.entity';
import { Loan } from '../entities/loan.entity';
import {
  addMonths,
  buildEntityCode,
  parseMoney,
  toIsoDate,
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

/** Repeat borrowers unlock larger principals as they build a track record. */
const LOAN_CYCLE_MULTIPLIER: Record<number, number> = {
  1: 0.35,
  2: 0.6,
  3: 0.85,
  4: 1,
};

/** The program lends below market; rates sit well under commercial MFI pricing. */
const INTEREST_RATE_RANGE = { min: 8, max: 16 };

export interface GenerateLoanOptions {
  business: Pick<
    Business,
    'businessCode' | 'clientCode' | 'sector' | 'countryIso3'
  >;
  country: ProgramCountry;
  sequence: number;
  loanCycle: number;
  appliedOn?: Date;
  principalUsd?: number;
  purpose?: LoanPurpose;
}

export function riskGradeForCycle(loanCycle: number): RiskGrade {
  if (loanCycle >= 4) return pickWeighted([RiskGrade.A, RiskGrade.B]);
  if (loanCycle === 3)
    return pickWeighted([RiskGrade.B, RiskGrade.A, RiskGrade.C]);
  if (loanCycle === 2)
    return pickWeighted([RiskGrade.B, RiskGrade.C, RiskGrade.A]);
  return pickWeighted([RiskGrade.C, RiskGrade.B, RiskGrade.D]);
}

export function generateLoan(options: GenerateLoanOptions): Partial<Loan> {
  const { business, country, sequence, loanCycle } = options;
  const appliedOn = options.appliedOn ?? new Date();
  const sector = findSector(business.sector);

  const range = sector?.loanRangeUsd ?? { min: 150, max: 3000 };
  const multiplier = LOAN_CYCLE_MULTIPLIER[Math.min(loanCycle, 4)];
  const principalUsd =
    options.principalUsd ??
    Math.round(
      randomFloat(range.min, range.min + (range.max - range.min) * multiplier),
    );

  const interestRate = randomFloat(
    INTEREST_RATE_RANGE.min,
    INTEREST_RATE_RANGE.max,
    2,
  );
  const termMonths = pickWeighted([12, 6, 18, 24, 9]);
  const totalRepayable =
    principalUsd * (1 + (interestRate / 100) * (termMonths / 12));

  const purpose =
    options.purpose ??
    pickOne(
      sector?.commonLoanPurposes ?? [
        LoanPurpose.WORKING_CAPITAL,
        LoanPurpose.INVENTORY,
      ],
    );

  return {
    loanCode: buildEntityCode(
      ENTITY_CODE_PREFIX.LOAN,
      country.isoAlpha3,
      sequence,
    ),
    clientCode: business.clientCode,
    businessCode: business.businessCode,
    countryIso3: country.isoAlpha3,
    loanCycle,
    currency: country.currency,
    principalLocal: toMoney(usdToLocal(principalUsd, country.fxRatePerUsd)),
    principalUsd: toMoney(principalUsd),
    interestRateAnnual: toMoney(interestRate),
    termMonths,
    purpose,
    riskGrade: riskGradeForCycle(loanCycle),
    appliedOn: toIsoDate(appliedOn),
    disbursedOn: null,
    maturityOn: null,
    installmentsTotal: termMonths,
    installmentsPaid: 0,
    totalRepayableUsd: toMoney(totalRepayable),
    amountRepaidUsd: toMoney(0),
    outstandingUsd: toMoney(0),
    daysPastDue: 0,
    status: LoanStatus.PENDING,
  };
}

/** Credit decision on a pending application; most are approved after coaching. */
export function decidePendingLoan(loan: Pick<Loan, 'riskGrade'>): LoanStatus {
  const approvalOdds = loan.riskGrade === RiskGrade.D ? 0.6 : 0.92;
  return chance(approvalOdds) ? LoanStatus.APPROVED : LoanStatus.REJECTED;
}

/** Fields to set when an approved loan is paid out. */
export function disburseLoan(
  loan: Pick<Loan, 'termMonths' | 'totalRepayableUsd'>,
  disbursedOn: Date = new Date(),
): Partial<Loan> {
  return {
    status: LoanStatus.DISBURSED,
    disbursedOn: toIsoDate(disbursedOn),
    maturityOn: toIsoDate(addMonths(disbursedOn, loan.termMonths)),
    outstandingUsd: toMoney(parseMoney(loan.totalRepayableUsd)),
    daysPastDue: 0,
  };
}

/** Equal installments, with the last one absorbing any rounding remainder. */
export function installmentAmountUsd(
  loan: Pick<
    Loan,
    'totalRepayableUsd' | 'installmentsTotal' | 'outstandingUsd'
  >,
  installmentNumber: number,
): number {
  const total = parseMoney(loan.totalRepayableUsd);
  const perInstallment = total / Math.max(1, loan.installmentsTotal);

  if (installmentNumber >= loan.installmentsTotal) {
    return Math.max(0, parseMoney(loan.outstandingUsd));
  }
  return Math.min(perInstallment, parseMoney(loan.outstandingUsd));
}

/** Number of prior loans a client has taken, so the next one gets the right cycle. */
export function nextLoanCycle(previousLoanCount: number): number {
  return Math.min(previousLoanCount + 1, 6);
}

export function randomLoanTermMonths(): number {
  return randomInt(6, 24);
}
