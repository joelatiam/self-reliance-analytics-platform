import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AllConfigType } from 'src/config';
import { ActivityTick } from '../entities/activity-tick.entity';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Business } from '../entities/business.entity';
import { BusinessMonthlyMetric } from '../entities/business-monthly-metric.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import {
  ACTIVITY_TICK_CRON,
  getActivityTickMinutes,
  getNextActivityTickAt,
} from '../helpers/clients-activity-schedule.helper';
import { ActivityTickResult, SimulationStatus } from '../types/activity.types';

/**
 * Reports what the simulation is doing: schedule, next tick, the last tick's
 * counts and row totals per table. Read-only, and deliberately separate from
 * the service that runs the ticks.
 */
@Injectable()
export class ClientsSimulationStatusService {
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
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async getStatus(
    isRunning: boolean,
    lastTick: ActivityTickResult | null,
  ): Promise<SimulationStatus> {
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
      isRunning,
      countries: clientsConfig.countries,
      lastTick: lastTick ?? (await this.loadLastTick()),
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
}
