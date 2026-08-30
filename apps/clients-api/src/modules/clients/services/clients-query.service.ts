import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { DEFAULT_PAGE_SIZE } from 'src/dto/pagination.dto';
import {
  DISPLACED_STATUSES,
  LoanStatus,
  OUTSTANDING_LOAN_STATUSES,
} from '../clients.constants';
import { resolveCountry } from '../constants/countries';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Business } from '../entities/business.entity';
import { BusinessMonthlyMetric } from '../entities/business-monthly-metric.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import {
  AdvisorySessionsQueryDto,
  BusinessMetricsQueryDto,
} from '../dto/advisory-session.dto';
import { BusinessesQueryDto } from '../dto/business.dto';
import { ClientsQueryDto } from '../dto/client.dto';
import { LoansQueryDto, RepaymentsQueryDto } from '../dto/loan.dto';
import { PaginatedResult, PortfolioSummary } from '../types/client.types';

/** Reads for both the API consumer and the pipeline's incremental pulls. */
@Injectable()
export class ClientsQueryService {
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
  ) {}

  async listClients(query: ClientsQueryDto): Promise<PaginatedResult<Client>> {
    const builder = this.clientRepository.createQueryBuilder('client');

    this.applyCountry(builder, 'client', query.country);
    if (query.displacementStatus) {
      builder.andWhere('client.displacementStatus = :displacementStatus', {
        displacementStatus: query.displacementStatus,
      });
    }
    if (query.status) {
      builder.andWhere('client.status = :status', { status: query.status });
    }
    if (query.gender) {
      builder.andWhere('client.gender = :gender', { gender: query.gender });
    }

    return this.paginate(builder, 'client', query);
  }

  async getClient(clientCode: string): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { clientCode },
      relations: ['businesses', 'loans'],
    });
    if (!client) {
      throw new NotFoundException(`Client not found: ${clientCode}`);
    }
    return client;
  }

  async listBusinesses(
    query: BusinessesQueryDto,
  ): Promise<PaginatedResult<Business>> {
    const builder = this.businessRepository.createQueryBuilder('business');

    this.applyCountry(builder, 'business', query.country);
    if (query.sector) {
      builder.andWhere('business.sector = :sector', { sector: query.sector });
    }
    if (query.stage) {
      builder.andWhere('business.stage = :stage', { stage: query.stage });
    }
    if (query.status) {
      builder.andWhere('business.status = :status', { status: query.status });
    }
    if (query.clientCode) {
      builder.andWhere('business.clientCode = :clientCode', {
        clientCode: query.clientCode,
      });
    }

    return this.paginate(builder, 'business', query);
  }

  async getBusiness(businessCode: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { businessCode },
    });
    if (!business) {
      throw new NotFoundException(`Business not found: ${businessCode}`);
    }
    return business;
  }

  async listLoans(query: LoansQueryDto): Promise<PaginatedResult<Loan>> {
    const builder = this.loanRepository.createQueryBuilder('loan');

    this.applyCountry(builder, 'loan', query.country);
    if (query.status) {
      builder.andWhere('loan.status = :status', { status: query.status });
    }
    if (query.clientCode) {
      builder.andWhere('loan.clientCode = :clientCode', {
        clientCode: query.clientCode,
      });
    }
    if (query.loanCycle) {
      builder.andWhere('loan.loanCycle = :loanCycle', {
        loanCycle: query.loanCycle,
      });
    }

    return this.paginate(builder, 'loan', query);
  }

  async getLoan(loanCode: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { loanCode },
      relations: ['repayments'],
    });
    if (!loan) {
      throw new NotFoundException(`Loan not found: ${loanCode}`);
    }
    return loan;
  }

  async listRepayments(
    query: RepaymentsQueryDto,
  ): Promise<PaginatedResult<LoanRepayment>> {
    const builder = this.repaymentRepository.createQueryBuilder('repayment');

    this.applyCountry(builder, 'repayment', query.country);
    if (query.loanCode) {
      builder.andWhere('repayment.loanCode = :loanCode', {
        loanCode: query.loanCode,
      });
    }
    if (query.clientCode) {
      builder.andWhere('repayment.clientCode = :clientCode', {
        clientCode: query.clientCode,
      });
    }

    return this.paginate(builder, 'repayment', query);
  }

  async listAdvisorySessions(
    query: AdvisorySessionsQueryDto,
  ): Promise<PaginatedResult<AdvisorySession>> {
    const builder =
      this.advisorySessionRepository.createQueryBuilder('session');

    this.applyCountry(builder, 'session', query.country);
    if (query.sessionType) {
      builder.andWhere('session.sessionType = :sessionType', {
        sessionType: query.sessionType,
      });
    }
    if (query.clientCode) {
      builder.andWhere('session.clientCode = :clientCode', {
        clientCode: query.clientCode,
      });
    }

    return this.paginate(builder, 'session', query);
  }

  async listBusinessMetrics(
    query: BusinessMetricsQueryDto,
  ): Promise<PaginatedResult<BusinessMonthlyMetric>> {
    const builder = this.metricRepository.createQueryBuilder('metric');

    this.applyCountry(builder, 'metric', query.country);
    if (query.period) {
      builder.andWhere('metric.period = :period', { period: query.period });
    }
    if (query.businessCode) {
      builder.andWhere('metric.businessCode = :businessCode', {
        businessCode: query.businessCode,
      });
    }

    return this.paginate(builder, 'metric', query);
  }

  /** Portfolio rollup shaped like the impact numbers these programs report. */
  async getPortfolioSummary(country?: string): Promise<PortfolioSummary> {
    const iso3 = country ? resolveCountry(country)?.isoAlpha3 : undefined;
    const countryFilter = iso3 ? 'WHERE country_iso3 = $1' : '';
    const params = iso3 ? [iso3] : [];

    const [clientStats] = await this.clientRepository.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status IN ('ACTIVE', 'ENROLLED'))::int AS active,
         count(*) FILTER (WHERE displacement_status = ANY($${params.length + 1}))::int AS displaced,
         count(*) FILTER (WHERE gender = 'FEMALE')::int AS women,
         count(*) FILTER (WHERE is_youth)::int AS youth,
         count(*) FILTER (WHERE displacement_status = 'HOST_COMMUNITY')::int AS host_community
       FROM clients ${countryFilter}`,
      [...params, [...DISPLACED_STATUSES]],
    );

    const [businessStats] = await this.businessRepository.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
         COALESCE(sum(employees_full_time + employees_part_time), 0)::int AS jobs_supported,
         COALESCE(sum(employees_displaced), 0)::int AS jobs_held_by_displaced,
         COALESCE(avg(
           CASE WHEN baseline_monthly_revenue_usd > 0
             THEN (monthly_revenue_usd - baseline_monthly_revenue_usd) / baseline_monthly_revenue_usd * 100
           END
         ), 0)::float AS average_revenue_growth_pct
       FROM businesses ${countryFilter}`,
      params,
    );

    const [loanStats] = await this.loanRepository.query(
      `SELECT
         count(*)::int AS total,
         COALESCE(sum(principal_usd) FILTER (WHERE disbursed_on IS NOT NULL), 0)::float AS disbursed_usd,
         COALESCE(sum(outstanding_usd), 0)::float AS outstanding_usd,
         COALESCE(sum(amount_repaid_usd), 0)::float AS repaid_usd,
         COALESCE(avg(principal_usd), 0)::float AS average_loan_size_usd,
         COALESCE(sum(outstanding_usd) FILTER (WHERE days_past_due > 30), 0)::float AS at_risk_usd
       FROM loans ${countryFilter}`,
      params,
    );

    const [repaymentStats] = await this.repaymentRepository.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE on_time)::int AS on_time
       FROM loan_repayments ${countryFilter}`,
      params,
    );

    const [advisoryStats] = await this.advisorySessionRepository.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE attended)::int AS attended,
         COALESCE(avg(satisfaction_score), 0)::float AS average_satisfaction
       FROM advisory_sessions ${countryFilter}`,
      params,
    );

    return {
      countryIso3: iso3 ?? null,
      clients: {
        total: clientStats.total,
        active: clientStats.active,
        displaced: clientStats.displaced,
        women: clientStats.women,
        youth: clientStats.youth,
        hostCommunity: clientStats.host_community,
      },
      businesses: {
        total: businessStats.total,
        active: businessStats.active,
        jobsSupported: businessStats.jobs_supported,
        jobsHeldByDisplaced: businessStats.jobs_held_by_displaced,
        averageRevenueGrowthPct: round(
          businessStats.average_revenue_growth_pct,
        ),
      },
      loans: {
        total: loanStats.total,
        disbursedUsd: round(loanStats.disbursed_usd),
        outstandingUsd: round(loanStats.outstanding_usd),
        repaidUsd: round(loanStats.repaid_usd),
        onTimeRepaymentRatePct: percentage(
          repaymentStats.on_time,
          repaymentStats.total,
        ),
        portfolioAtRiskPct: percentage(
          loanStats.at_risk_usd,
          loanStats.outstanding_usd,
        ),
        averageLoanSizeUsd: round(loanStats.average_loan_size_usd),
      },
      advisory: {
        sessions: advisoryStats.total,
        attendanceRatePct: percentage(
          advisoryStats.attended,
          advisoryStats.total,
        ),
        averageSatisfaction: round(advisoryStats.average_satisfaction),
      },
    };
  }

  /** Count of loans still owing, exposed for the metrics exporter. */
  async countOutstandingLoans(): Promise<number> {
    return this.loanRepository
      .createQueryBuilder('loan')
      .where('loan.status IN (:...statuses)', {
        statuses: [...OUTSTANDING_LOAN_STATUSES, LoanStatus.DEFAULTED],
      })
      .getCount();
  }

  private applyCountry<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
    alias: string,
    country?: string,
  ): void {
    if (!country) return;

    const resolved = resolveCountry(country);
    builder.andWhere(`${alias}.countryIso3 = :countryIso3`, {
      countryIso3: resolved?.isoAlpha3 ?? country.toUpperCase(),
    });
  }

  /**
   * Orders by updated_at so a consumer paging with `updatedSince` walks the
   * change stream in order and never skips a row between pages.
   */
  private async paginate<T extends ObjectLiteral & { updatedAt: Date }>(
    builder: SelectQueryBuilder<T>,
    alias: string,
    query: { page?: number; limit?: number; updatedSince?: string },
  ): Promise<PaginatedResult<T>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    if (query.updatedSince) {
      builder.andWhere(`${alias}.updatedAt > :updatedSince`, {
        updatedSince: new Date(query.updatedSince),
      });
    }

    const [data, total] = await builder
      .orderBy(`${alias}.updatedAt`, 'ASC')
      .addOrderBy(`${alias}.id`, 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const maxUpdatedAt = data.length
      ? data[data.length - 1].updatedAt.toISOString()
      : null;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        maxUpdatedAt,
      },
    };
  }
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((value ?? 0) * factor) / factor;
}

function percentage(part: number, whole: number): number {
  if (!whole) return 0;
  return round((part / whole) * 100);
}
