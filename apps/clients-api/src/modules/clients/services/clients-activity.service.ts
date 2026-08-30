import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { AllConfigType } from 'src/config';
import {
  ActivityTickSource,
  ClientStatus,
  LoanStatus,
  OUTSTANDING_LOAN_STATUSES,
} from '../clients.constants';
import { findCountryByIso3, ProgramCountry } from '../constants/countries';
import { ActivityTick } from '../entities/activity-tick.entity';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Business } from '../entities/business.entity';
import { BusinessMonthlyMetric } from '../entities/business-monthly-metric.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import { generateBusinessMetric } from '../helpers/business-metric-generator.helper';
import { nextClientStatus } from '../helpers/client-generator.helper';
import {
  decidePendingLoan,
  disburseLoan,
} from '../helpers/loan-generator.helper';
import {
  ageDelinquentLoan,
  generateRepayment,
} from '../helpers/repayment-generator.helper';
import {
  getActivityTickMinutes,
  getNextActivityTickAt,
  ACTIVITY_TICK_CRON,
} from '../helpers/clients-activity-schedule.helper';
import { toPeriod } from '../helpers/simulation-format.helper';
import { randomRange, scaleRange } from '../helpers/simulation-random.helper';
import {
  ActivityTickOptions,
  ActivityTickResult,
  SimulationStatus,
  TriggerActivityTickResult,
} from '../types/activity.types';
import { ClientsGeneratorService } from './clients-generator.service';
import { ClientsSequenceService } from './clients-sequence.service';

/**
 * Advances the simulated world by one step: new enrolments, loan decisions,
 * disbursements, repayments, coaching sessions and monthly business results.
 * Every row it touches gets a fresh updated_at, which is exactly what the
 * pipeline pages on.
 */
@Injectable()
export class ClientsActivityService {
  private readonly logger = new Logger(ClientsActivityService.name);
  private isRunning = false;
  private lastTick: ActivityTickResult | null = null;

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LoanRepayment)
    private readonly repaymentRepository: Repository<LoanRepayment>,
    @InjectRepository(AdvisorySession)
    private readonly advisorySessionRepository: Repository<AdvisorySession>,
    @InjectRepository(BusinessMonthlyMetric)
    private readonly metricRepository: Repository<BusinessMonthlyMetric>,
    @InjectRepository(ActivityTick)
    private readonly tickRepository: Repository<ActivityTick>,
    private readonly generatorService: ClientsGeneratorService,
    private readonly sequenceService: ClientsSequenceService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  isTickRunning(): boolean {
    return this.isRunning;
  }

  /** Fire-and-forget entry point used by the cron and by the API. */
  triggerTickInBackground(
    options: ActivityTickOptions = {},
  ): TriggerActivityTickResult {
    const source = options.source ?? ActivityTickSource.API;
    const countryIso3 = options.countryIso3 ?? null;

    if (this.isRunning) {
      this.logger.warn(
        `Activity tick already running; trigger skipped (source=${source})`,
      );
      return { started: false, source, countryIso3 };
    }

    void this.runTick(options).catch((error) => {
      this.logger.error(
        `Error during activity tick: ${error.message}`,
        error.stack,
      );
    });

    return { started: true, source, countryIso3 };
  }

  async runTick(
    options: ActivityTickOptions = {},
  ): Promise<ActivityTickResult> {
    const source = options.source ?? ActivityTickSource.API;
    const startedAt = new Date();

    if (this.isRunning) {
      this.logger.warn('Activity tick already running; skipping this run');
      return this.emptyResult(source, startedAt, 'skipped: already running');
    }

    this.isRunning = true;
    try {
      return await this.executeTick(options, source, startedAt);
    } finally {
      this.isRunning = false;
    }
  }

  async getStatus(): Promise<SimulationStatus> {
    const clientsConfig = this.configService.getOrThrow('clients', {
      infer: true,
    });

    const [
      clients,
      businesses,
      loans,
      repayments,
      advisorySessions,
      businessMetrics,
      ticks,
    ] = await Promise.all([
      this.clientRepository.count(),
      this.businessRepository.count(),
      this.loanRepository.count(),
      this.repaymentRepository.count(),
      this.advisorySessionRepository.count(),
      this.metricRepository.count(),
      this.tickRepository.count(),
    ]);

    return {
      cronEnabled: clientsConfig.cronEnabled,
      tickCron: ACTIVITY_TICK_CRON,
      tickMinutes: getActivityTickMinutes(),
      nextTickAt: getNextActivityTickAt().toISOString(),
      isRunning: this.isRunning,
      countries: clientsConfig.countries,
      lastTick: this.lastTick ?? (await this.loadLastTick()),
      totals: {
        clients,
        businesses,
        loans,
        repayments,
        advisorySessions,
        businessMetrics,
        ticks,
      },
    };
  }

  private async executeTick(
    options: ActivityTickOptions,
    source: ActivityTickSource,
    startedAt: Date,
  ): Promise<ActivityTickResult> {
    const clientsConfig = this.configService.getOrThrow('clients', {
      infer: true,
    });
    const intensity = options.intensity ?? 1;
    const scope = options.countryIso3
      ? [this.generatorService.resolveConfiguredCountry(options.countryIso3)]
      : this.generatorService.configuredCountries;

    const result: ActivityTickResult = this.emptyResult(source, startedAt);

    // 1. New enrolments, each with the business they came to the program for.
    const newClients = randomRange(
      scaleRange(clientsConfig.newClientsPerTick, intensity),
    );
    for (let index = 0; index < newClients; index++) {
      const country = scope[index % scope.length];
      const enrolled = await this.generatorService.enrolClient({ country });
      result.clientsEnrolled += 1;
      if (enrolled.business) result.businessesCreated += 1;
    }

    // 2. Fresh loan applications from businesses with nothing outstanding.
    const applications = randomRange(
      scaleRange(clientsConfig.loanApplicationsPerTick, intensity),
    );
    for (const business of await this.pickBusinessesWithoutOpenLoan(
      scope,
      applications,
    )) {
      await this.generatorService.applyForLoan(business);
      result.loansApplied += 1;
    }

    // 3. Credit decisions on everything still pending.
    for (const loan of await this.pickLoansByStatus(
      scope,
      [LoanStatus.PENDING],
      25,
    )) {
      loan.status = decidePendingLoan(loan);
      await this.loanRepository.save(loan);
    }

    // 4. Disbursements.
    for (const loan of await this.pickLoansByStatus(
      scope,
      [LoanStatus.APPROVED],
      25,
    )) {
      Object.assign(loan, disburseLoan(loan));
      await this.loanRepository.save(loan);
      result.loansDisbursed += 1;
    }

    // 5. Installments against loans that are still owing.
    const repaymentsTarget = randomRange(
      scaleRange(clientsConfig.repaymentsPerTick, intensity),
    );
    const repaidLoanCodes = new Set<string>();
    for (const loan of await this.pickLoansByStatus(
      scope,
      [...OUTSTANDING_LOAN_STATUSES],
      repaymentsTarget,
    )) {
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
        onTimeRate: clientsConfig.onTimeRepaymentRate,
      });

      await this.repaymentRepository.save(
        this.repaymentRepository.create(repayment),
      );
      Object.assign(loan, loanUpdate);
      await this.loanRepository.save(loan);

      repaidLoanCodes.add(loan.loanCode);
      result.repaymentsRecorded += 1;
      if (loan.status === LoanStatus.REPAID) result.loansClosed += 1;
    }

    // 6. Arrears age on late loans that did not pay this tick.
    for (const loan of await this.pickLoansByStatus(
      scope,
      [LoanStatus.LATE],
      20,
    )) {
      if (repaidLoanCodes.has(loan.loanCode)) continue;

      const update = ageDelinquentLoan(loan, clientsConfig.defaultRate);
      if (!update) continue;

      Object.assign(loan, update);
      await this.loanRepository.save(loan);
      if (
        loan.status === LoanStatus.DEFAULTED ||
        loan.status === LoanStatus.WRITTEN_OFF
      ) {
        result.loansClosed += 1;
      }
    }

    // 7. Advisory touchpoints.
    const sessions = randomRange(
      scaleRange(clientsConfig.advisorySessionsPerTick, intensity),
    );
    for (const client of await this.pickActiveClients(scope, sessions)) {
      const country = findCountryByIso3(client.countryIso3);
      if (!country) continue;

      const business = await this.businessRepository.findOne({
        where: { clientCode: client.clientCode },
      });
      await this.generatorService.logAdvisorySession(
        client,
        country,
        business?.businessCode ?? null,
      );
      result.advisorySessionsLogged += 1;
    }

    // 8. Monthly business results, which also move the business's revenue on.
    const metrics = randomRange(
      scaleRange(clientsConfig.metricsPerTick, intensity),
    );
    result.metricsRecorded = await this.recordBusinessMetrics(scope, metrics);

    // 9. Lifecycle moves for a slice of the caseload.
    result.clientsUpdated = await this.advanceClientStatuses(scope, 15);

    const finishedAt = new Date();
    result.finishedAt = finishedAt;
    result.durationMs = finishedAt.getTime() - startedAt.getTime();

    await this.tickRepository.save(this.tickRepository.create({ ...result }));
    this.lastTick = result;

    this.logger.log(
      `Activity tick (${source}) done in ${result.durationMs}ms: ` +
        `+${result.clientsEnrolled} clients, +${result.loansApplied} applications, ` +
        `${result.loansDisbursed} disbursed, ${result.repaymentsRecorded} repayments, ` +
        `${result.loansClosed} closed, ${result.advisorySessionsLogged} sessions, ` +
        `${result.metricsRecorded} metrics`,
    );

    return result;
  }

  private async recordBusinessMetrics(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<number> {
    const period = toPeriod(new Date());
    let recorded = 0;

    for (const business of await this.pickActiveBusinesses(scope, limit)) {
      const country = findCountryByIso3(business.countryIso3);
      if (!country) continue;

      const hasActiveLoan = await this.loanRepository.exists({
        where: {
          businessCode: business.businessCode,
          status: In([...OUTSTANDING_LOAN_STATUSES]),
        },
      });

      const { metric, businessUpdate } = generateBusinessMetric({
        business,
        country,
        hasActiveLoan,
        period,
      });

      // One row per business per month: later ticks in the month refine it.
      await this.metricRepository.upsert(this.metricRepository.create(metric), {
        conflictPaths: ['businessCode', 'period'],
      });
      Object.assign(business, businessUpdate);
      await this.businessRepository.save(business);
      recorded += 1;
    }

    return recorded;
  }

  private async advanceClientStatuses(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<number> {
    let updated = 0;

    for (const client of await this.pickClientsForReview(scope, limit)) {
      const status = nextClientStatus(client.status, client.enrolledOn);
      if (status === client.status) continue;

      client.status = status;
      await this.clientRepository.save(client);
      updated += 1;
    }

    return updated;
  }

  private async pickBusinessesWithoutOpenLoan(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Business[]> {
    if (limit <= 0) return [];

    return this.businessRepository
      .createQueryBuilder('business')
      .where('business.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('business.status = :status', { status: 'ACTIVE' })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM loans loan
          WHERE loan.business_code = business.business_code
            AND loan.status IN (:...openStatuses)
        )`,
        {
          openStatuses: [
            LoanStatus.PENDING,
            LoanStatus.APPROVED,
            ...OUTSTANDING_LOAN_STATUSES,
          ],
        },
      )
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private async pickLoansByStatus(
    scope: ProgramCountry[],
    statuses: LoanStatus[],
    limit: number,
  ): Promise<Loan[]> {
    if (limit <= 0) return [];

    return this.loanRepository
      .createQueryBuilder('loan')
      .where('loan.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('loan.status IN (:...statuses)', { statuses })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private async pickActiveClients(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Client[]> {
    if (limit <= 0) return [];

    return this.clientRepository
      .createQueryBuilder('client')
      .where('client.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('client.status IN (:...statuses)', {
        statuses: [ClientStatus.ACTIVE, ClientStatus.ENROLLED],
      })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private async pickActiveBusinesses(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Business[]> {
    if (limit <= 0) return [];

    return this.businessRepository
      .createQueryBuilder('business')
      .where('business.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('business.status = :status', { status: 'ACTIVE' })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private async pickClientsForReview(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Client[]> {
    if (limit <= 0) return [];

    return this.clientRepository.find({
      where: {
        countryIso3: In(scope.map((country) => country.isoAlpha3)),
        status: Not(In([ClientStatus.EXITED, ClientStatus.GRADUATED])),
      },
      order: { updatedAt: 'ASC' },
      take: limit,
    });
  }

  private async loadLastTick(): Promise<ActivityTickResult | null> {
    const tick = await this.tickRepository.findOne({
      where: {},
      order: { id: 'DESC' },
    });
    if (!tick) return null;

    const { id, createdAt, ...rest } = tick;
    void id;
    void createdAt;
    return rest as ActivityTickResult;
  }

  private emptyResult(
    source: ActivityTickSource,
    startedAt: Date,
    notes: string | null = null,
  ): ActivityTickResult {
    return {
      source,
      startedAt,
      finishedAt: startedAt,
      durationMs: 0,
      clientsEnrolled: 0,
      businessesCreated: 0,
      loansApplied: 0,
      loansDisbursed: 0,
      repaymentsRecorded: 0,
      loansClosed: 0,
      advisorySessionsLogged: 0,
      metricsRecorded: 0,
      clientsUpdated: 0,
      notes,
    };
  }
}
