import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  DISPLACED_STATUSES,
  LoanStatus,
  OUTSTANDING_LOAN_STATUSES,
} from '../clients.constants';
import { resolveCountry } from '../constants/countries';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Business } from '../entities/business.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import { PortfolioSummary } from '../types/client.types';

/**
 * Portfolio rollups. Kept apart from the list endpoints because these are hand
 * written aggregate SQL rather than query-builder reads, and they answer a
 * different question: not "which rows", but "how is the portfolio doing".
 */
@Injectable()
export class ClientsSummaryService {
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
  ) {}

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
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((value ?? 0) * factor) / factor;
}

function percentage(part: number, whole: number): number {
  if (!whole) return 0;
  return round((part / whole) * 100);
}
