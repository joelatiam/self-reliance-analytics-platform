import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AllConfigType } from 'src/config';
import { ActivityTickSource } from '../clients.constants';
import { ActivityTick } from '../entities/activity-tick.entity';
import {
  decidePendingLoan,
  disburseLoan,
} from '../helpers/loan-generator.helper';
import { randomRange, scaleRange } from '../helpers/simulation-random.helper';
import {
  ActivityTickOptions,
  ActivityTickResult,
  SimulationStatus,
  TriggerActivityTickResult,
} from '../types/activity.types';
import { ClientsGeneratorService } from './clients-generator.service';
import { ClientsLendingStepsService } from './clients-lending-steps.service';
import { ClientsOutreachStepsService } from './clients-outreach-steps.service';
import { ClientsSimulationStatusService } from './clients-simulation-status.service';

/** Pending applications reviewed for a credit decision each tick. */
const DECISIONS_PER_TICK = 25;

/** Approved loans paid out each tick. */
const DISBURSEMENTS_PER_TICK = 25;

/** Late loans whose arrears are aged each tick. */
const ARREARS_REVIEWED_PER_TICK = 20;

/** Clients considered for a lifecycle move each tick. */
const CLIENTS_REVIEWED_PER_TICK = 15;

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
    @InjectRepository(ActivityTick)
    private readonly tickRepository: Repository<ActivityTick>,
    private readonly generatorService: ClientsGeneratorService,
    private readonly lendingSteps: ClientsLendingStepsService,
    private readonly outreachSteps: ClientsOutreachStepsService,
    private readonly statusService: ClientsSimulationStatusService,
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

  getStatus(): Promise<SimulationStatus> {
    return this.statusService.getStatus(this.isRunning, this.lastTick);
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

    const result = this.emptyResult(source, startedAt);
    const volume = (range: { min: number; max: number }) =>
      randomRange(scaleRange(range, intensity));

    // 1. New enrolments, each with the business they came to the program for.
    const newClients = volume(clientsConfig.newClientsPerTick);
    for (let index = 0; index < newClients; index++) {
      const country = scope[index % scope.length];
      const enrolled = await this.generatorService.enrolClient({ country });
      result.clientsEnrolled += 1;
      if (enrolled.business) result.businessesCreated += 1;
    }

    // 2-4. The lending cycle: apply, decide, disburse.
    result.loansApplied = await this.lendingSteps.fileLoanApplications(
      scope,
      volume(clientsConfig.loanApplicationsPerTick),
    );
    await this.lendingSteps.decidePendingLoans(
      scope,
      DECISIONS_PER_TICK,
      decidePendingLoan,
    );
    result.loansDisbursed = await this.lendingSteps.disburseApprovedLoans(
      scope,
      DISBURSEMENTS_PER_TICK,
      (loan) => disburseLoan(loan),
    );

    // 5. Installments against loans that are still owing.
    const repayments = await this.lendingSteps.recordRepayments(
      scope,
      volume(clientsConfig.repaymentsPerTick),
      clientsConfig.onTimeRepaymentRate,
    );
    result.repaymentsRecorded = repayments.repaymentsRecorded;
    result.loansClosed = repayments.loansClosed;

    // 6. Arrears age on late loans that did not pay this tick.
    result.loansClosed += await this.lendingSteps.ageDelinquentLoans(
      scope,
      ARREARS_REVIEWED_PER_TICK,
      clientsConfig.defaultRate,
      repayments.repaidLoanCodes,
    );

    // 7-9. Coaching, monthly results, and lifecycle moves.
    result.advisorySessionsLogged =
      await this.outreachSteps.logAdvisorySessions(
        scope,
        volume(clientsConfig.advisorySessionsPerTick),
      );
    result.metricsRecorded = await this.outreachSteps.recordBusinessMetrics(
      scope,
      volume(clientsConfig.metricsPerTick),
    );
    result.clientsUpdated = await this.outreachSteps.advanceClientStatuses(
      scope,
      CLIENTS_REVIEWED_PER_TICK,
    );

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
