import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LoanStatus, OUTSTANDING_LOAN_STATUSES } from '../clients.constants';
import { findCountryByIso3, ProgramCountry } from '../constants/countries';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import {
  ageDelinquentLoan,
  generateRepayment,
} from '../helpers/repayment-generator.helper';
import { ClientsActivitySelectionService } from './clients-activity-selection.service';
import { ClientsGeneratorService } from './clients-generator.service';
import { ClientsSequenceService } from './clients-sequence.service';

export interface RepaymentRoundResult {
  repaymentsRecorded: number;
  loansClosed: number;
  /** Loans that paid this round, so arrears ageing can skip them. */
  repaidLoanCodes: Set<string>;
}

/**
 * The money path of a tick: applications, credit decisions, disbursements,
 * installments and arrears. Each step is independent and returns its own
 * counts, so the tick stays a readable sequence rather than one long method.
 */
@Injectable()
export class ClientsLendingStepsService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LoanRepayment)
    private readonly repaymentRepository: Repository<LoanRepayment>,
    private readonly selectionService: ClientsActivitySelectionService,
    private readonly generatorService: ClientsGeneratorService,
    private readonly sequenceService: ClientsSequenceService,
  ) {}

  /** Files new loan applications from businesses with nothing outstanding. */
  async fileLoanApplications(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<number> {
    let filed = 0;
    for (const business of await this.selectionService.pickBusinessesWithoutOpenLoan(
      scope,
      limit,
    )) {
      await this.generatorService.applyForLoan(business);
      filed += 1;
    }
    return filed;
  }

  /** Credit decisions on everything still pending. */
  async decidePendingLoans(
    scope: ProgramCountry[],
    limit: number,
    decide: (loan: Loan) => LoanStatus,
  ): Promise<number> {
    const loans = await this.selectionService.pickLoansByStatus(
      scope,
      [LoanStatus.PENDING],
      limit,
    );
    for (const loan of loans) {
      loan.status = decide(loan);
      await this.loanRepository.save(loan);
    }
    return loans.length;
  }

  /** Pays out approved loans. */
  async disburseApprovedLoans(
    scope: ProgramCountry[],
    limit: number,
    disburse: (loan: Loan) => Partial<Loan>,
  ): Promise<number> {
    const loans = await this.selectionService.pickLoansByStatus(
      scope,
      [LoanStatus.APPROVED],
      limit,
    );
    for (const loan of loans) {
      Object.assign(loan, disburse(loan));
      await this.loanRepository.save(loan);
    }
    return loans.length;
  }

  /** Records the next installment on loans that are still owing. */
  async recordRepayments(
    scope: ProgramCountry[],
    limit: number,
    onTimeRate: number,
  ): Promise<RepaymentRoundResult> {
    const result: RepaymentRoundResult = {
      repaymentsRecorded: 0,
      loansClosed: 0,
      repaidLoanCodes: new Set<string>(),
    };

    const loans = await this.selectionService.pickLoansByStatus(
      scope,
      [...OUTSTANDING_LOAN_STATUSES],
      limit,
    );

    for (const loan of loans) {
      const country = findCountryByIso3(loan.countryIso3);
      if (!country) continue;

      const sequence = await this.sequenceService.next(
        'REPAYMENT',
        country.isoAlpha3,
      );
      const { repayment, loanUpdate } = generateRepayment({
        loan,
        country,
        sequence,
        onTimeRate,
      });

      await this.repaymentRepository.save(
        this.repaymentRepository.create(repayment),
      );
      Object.assign(loan, loanUpdate);
      await this.loanRepository.save(loan);

      result.repaidLoanCodes.add(loan.loanCode);
      result.repaymentsRecorded += 1;
      if (loan.status === LoanStatus.REPAID) result.loansClosed += 1;
    }

    return result;
  }

  /** Ages arrears on late loans that did not pay this tick. */
  async ageDelinquentLoans(
    scope: ProgramCountry[],
    limit: number,
    defaultRate: number,
    skip: Set<string>,
  ): Promise<number> {
    let closed = 0;

    for (const loan of await this.selectionService.pickLoansByStatus(
      scope,
      [LoanStatus.LATE],
      limit,
    )) {
      if (skip.has(loan.loanCode)) continue;

      const update = ageDelinquentLoan(loan, defaultRate);
      if (!update) continue;

      Object.assign(loan, update);
      await this.loanRepository.save(loan);
      if (
        loan.status === LoanStatus.DEFAULTED ||
        loan.status === LoanStatus.WRITTEN_OFF
      ) {
        closed += 1;
      }
    }

    return closed;
  }
}
