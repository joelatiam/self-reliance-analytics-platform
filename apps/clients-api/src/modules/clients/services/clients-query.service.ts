import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { resolveCountry } from '../constants/countries';
import {
  KeysetQuery,
  KeysetRow,
  paginateByKeyset,
} from '../helpers/keyset-pagination.helper';
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
import { PaginatedResult } from '../types/client.types';

/** List and single-record reads. Aggregate rollups live in ClientsSummaryService. */
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

  /** Walks rows in (updated_at, id) order; see paginateByKeyset for why. */
  private paginate<T extends KeysetRow>(
    builder: SelectQueryBuilder<T>,
    alias: string,
    query: KeysetQuery,
  ): Promise<PaginatedResult<T>> {
    return paginateByKeyset(builder, alias, query);
  }
}
