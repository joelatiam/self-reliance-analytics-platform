import {
  ENTITY_CODE_PREFIX,
  LoanStatus,
  RepaymentMethod,
} from '../clients.constants';
import { ProgramCountry } from '../constants/countries';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import {
  addMonths,
  buildEntityCode,
  parseMoney,
  toIsoDate,
  toMoney,
  usdToLocal,
} from './simulation-format.helper';
import { chance, pickWeighted, randomInt } from './simulation-random.helper';
import { installmentAmountUsd } from './loan-generator.helper';

/** Mobile money dominates repayments in camp economies. */
const REPAYMENT_METHODS = [
  RepaymentMethod.MOBILE_MONEY,
  RepaymentMethod.CASH,
  RepaymentMethod.SACCO,
  RepaymentMethod.BANK_TRANSFER,
];

export interface GenerateRepaymentOptions {
  loan: Loan;
  country: ProgramCountry;
  sequence: number;
  /** Configured share of installments paid on or before the due date. */
  onTimeRate: number;
  paidAt?: Date;
}

export interface GeneratedRepayment {
  repayment: Partial<LoanRepayment>;
  /** Loan-side fields to persist alongside the repayment. */
  loanUpdate: Partial<Loan>;
}

/**
 * Records the next installment on a loan and rolls the loan forward: paid
 * count, outstanding balance, arrears and terminal status.
 */
export function generateRepayment(
  options: GenerateRepaymentOptions,
): GeneratedRepayment {
  const { loan, country, sequence, onTimeRate } = options;
  const paidAt = options.paidAt ?? new Date();

  const installmentNumber = loan.installmentsPaid + 1;
  const amountUsd = installmentAmountUsd(loan, installmentNumber);

  const disbursedOn = loan.disbursedOn ? new Date(loan.disbursedOn) : paidAt;
  const dueOn = addMonths(disbursedOn, installmentNumber);

  const onTime = chance(onTimeRate);
  const daysLate = onTime ? 0 : randomInt(1, 45);

  const outstanding = Math.max(0, parseMoney(loan.outstandingUsd) - amountUsd);
  const repaid = parseMoney(loan.amountRepaidUsd) + amountUsd;
  const fullyRepaid =
    installmentNumber >= loan.installmentsTotal || outstanding <= 0.01;

  return {
    repayment: {
      repaymentCode: buildEntityCode(
        ENTITY_CODE_PREFIX.REPAYMENT,
        country.isoAlpha3,
        sequence,
      ),
      loanCode: loan.loanCode,
      clientCode: loan.clientCode,
      countryIso3: loan.countryIso3,
      installmentNumber,
      currency: country.currency,
      amountLocal: toMoney(usdToLocal(amountUsd, country.fxRatePerUsd)),
      amountUsd: toMoney(amountUsd),
      dueOn: toIsoDate(dueOn),
      paidAt,
      daysLate,
      onTime,
      method: pickWeighted(REPAYMENT_METHODS),
    },
    loanUpdate: {
      installmentsPaid: installmentNumber,
      amountRepaidUsd: toMoney(repaid),
      outstandingUsd: toMoney(fullyRepaid ? 0 : outstanding),
      daysPastDue: daysLate,
      status: fullyRepaid
        ? LoanStatus.REPAID
        : daysLate > 30
          ? LoanStatus.LATE
          : LoanStatus.REPAYING,
    },
  };
}

/**
 * Ages a loan that received no payment this tick. Arrears build up, and a
 * small share of persistently late loans are written off as defaults.
 */
export function ageDelinquentLoan(
  loan: Pick<Loan, 'status' | 'daysPastDue'>,
  defaultRate: number,
): Partial<Loan> | null {
  if (loan.status !== LoanStatus.LATE) return null;

  const daysPastDue = loan.daysPastDue + randomInt(1, 15);

  if (daysPastDue > 90 && chance(defaultRate * 5)) {
    return { status: LoanStatus.DEFAULTED, daysPastDue };
  }
  if (daysPastDue > 180) {
    return { status: LoanStatus.WRITTEN_OFF, daysPastDue };
  }
  return { daysPastDue };
}
