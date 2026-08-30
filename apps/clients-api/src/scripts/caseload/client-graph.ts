import {
  ClientStatus,
  LoanStatus,
} from 'src/modules/clients/clients.constants';
import { ProgramCountry } from 'src/modules/clients/constants/countries';
import { Business } from 'src/modules/clients/entities/business.entity';
import { Client } from 'src/modules/clients/entities/client.entity';
import { Loan } from 'src/modules/clients/entities/loan.entity';
import { generateAdvisorySession } from 'src/modules/clients/helpers/advisory-generator.helper';
import { generateBusiness } from 'src/modules/clients/helpers/business-generator.helper';
import { generateBusinessMetric } from 'src/modules/clients/helpers/business-metric-generator.helper';
import {
  backdatedEnrolmentDate,
  generateClient,
} from 'src/modules/clients/helpers/client-generator.helper';
import {
  disburseLoan,
  generateLoan,
} from 'src/modules/clients/helpers/loan-generator.helper';
import { RecordBudget } from 'src/modules/clients/helpers/record-budget.helper';
import { generateRepayment } from 'src/modules/clients/helpers/repayment-generator.helper';
import {
  addDays,
  toPeriod,
} from 'src/modules/clients/helpers/simulation-format.helper';
import {
  chance,
  randomInt,
} from 'src/modules/clients/helpers/simulation-random.helper';
import { GeneratedBatch, SequenceCounters } from './types';

export function nextSequence(
  counters: SequenceCounters,
  kind: string,
  iso3: string,
): number {
  const key = `${kind}:${iso3}`;
  counters[key] = (counters[key] ?? 0) + 1;
  return counters[key];
}

/**
 * Builds one client and everything that hangs off them. Returns nothing once
 * the budget cannot fit a client and their business.
 */
export function generateClientGraph(
  country: ProgramCountry,
  counters: SequenceCounters,
  budget: RecordBudget,
  batch: GeneratedBatch,
): boolean {
  if (budget.remaining < 2) return false;

  const enrolledOn = backdatedEnrolmentDate();
  const client = generateClient({
    country,
    sequence: nextSequence(counters, 'CLIENT', country.isoAlpha3),
    enrolledOn,
  });
  client.status = ClientStatus.ACTIVE;

  const business = generateBusiness({
    client: client as Required<
      Pick<
        Client,
        'clientCode' | 'countryIso3' | 'locationName' | 'lastName' | 'gender'
      >
    >,
    country,
    sequence: nextSequence(counters, 'BUSINESS', country.isoAlpha3),
    earliestYear: client.arrivalYear ?? undefined,
  });

  budget.take(2);
  batch.clients.push(client);
  batch.businesses.push(business);

  // Loans, and the installments already paid against them.
  const loanCount = Math.min(randomInt(0, 3), budget.remaining);
  for (let cycle = 1; cycle <= loanCount; cycle++) {
    if (!budget.takeOne()) break;

    const appliedOn = addDays(enrolledOn, randomInt(14, 400));
    const loan = generateLoan({
      business: business as Required<
        Pick<Business, 'businessCode' | 'clientCode' | 'sector' | 'countryIso3'>
      >,
      country,
      sequence: nextSequence(counters, 'LOAN', country.isoAlpha3),
      loanCycle: cycle,
      appliedOn,
    }) as Loan;

    Object.assign(loan, disburseLoan(loan, appliedOn));
    batch.loans.push(loan);

    const installmentsToPay = Math.min(
      randomInt(0, loan.installmentsTotal),
      budget.remaining,
    );
    for (let installment = 0; installment < installmentsToPay; installment++) {
      if (!budget.takeOne()) break;

      const { repayment, loanUpdate } = generateRepayment({
        loan,
        country,
        sequence: nextSequence(counters, 'REPAYMENT', country.isoAlpha3),
        onTimeRate: 0.93,
        paidAt: addDays(appliedOn, 30 * (installment + 1)),
      });
      batch.repayments.push(repayment);
      Object.assign(loan, loanUpdate);
    }

    // A loan nobody has finished paying is either performing or in arrears.
    if (loan.status !== LoanStatus.REPAID && chance(0.06)) {
      loan.status = LoanStatus.LATE;
      loan.daysPastDue = randomInt(31, 120);
    }
  }

  // Advisory touchpoints.
  const sessionCount = Math.min(randomInt(0, 6), budget.remaining);
  for (let index = 0; index < sessionCount; index++) {
    if (!budget.takeOne()) break;

    batch.advisorySessions.push(
      generateAdvisorySession({
        client: client as Required<
          Pick<
            Client,
            'clientCode' | 'countryIso3' | 'advisorCode' | 'primaryLanguage'
          >
        >,
        country,
        sequence: nextSequence(counters, 'ADVISORY', country.isoAlpha3),
        businessCode: business.businessCode ?? null,
        deliveredAt: addDays(enrolledOn, randomInt(1, 700)),
      }),
    );
  }

  // Monthly results for the last few months of trading.
  const metricMonths = Math.min(randomInt(1, 4), budget.remaining);
  const now = new Date();
  for (let index = 0; index < metricMonths; index++) {
    if (!budget.takeOne()) break;

    const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const { metric, businessUpdate } = generateBusinessMetric({
      business: business as Business,
      country,
      hasActiveLoan: batch.loans.some(
        (loan) =>
          loan.businessCode === business.businessCode &&
          loan.status !== LoanStatus.REPAID,
      ),
      period: toPeriod(monthDate),
    });
    batch.metrics.push(metric);
    Object.assign(business, businessUpdate);
  }

  return true;
}
