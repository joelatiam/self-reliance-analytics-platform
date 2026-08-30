import { Injectable } from '@nestjs/common';

import { ActivityTickSource } from './clients.constants';
import programCountries from './constants/countries';
import businessSectors from './constants/sectors';
import { AdvisorySession } from './entities/advisory-session.entity';
import { Business } from './entities/business.entity';
import { BusinessMonthlyMetric } from './entities/business-monthly-metric.entity';
import { Client } from './entities/client.entity';
import { Loan } from './entities/loan.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import {
  AdvisorySessionsQueryDto,
  BusinessMetricsQueryDto,
  CreateAdvisorySessionDto,
} from './dto/advisory-session.dto';
import { BusinessesQueryDto, CreateBusinessDto } from './dto/business.dto';
import { ClientsQueryDto, CreateClientDto } from './dto/client.dto';
import {
  CreateLoanDto,
  LoansQueryDto,
  RepaymentsQueryDto,
} from './dto/loan.dto';
import {
  SeedSimulationDto,
  TriggerActivityTickDto,
} from './dto/simulation.dto';
import { ClientsActivityService } from './services/clients-activity.service';
import {
  ClientsGeneratorService,
  EnrolClientResult,
} from './services/clients-generator.service';
import { ClientsQueryService } from './services/clients-query.service';
import {
  ActivityTickResult,
  SimulationStatus,
  TriggerActivityTickResult,
} from './types/activity.types';
import { PaginatedResult, PortfolioSummary } from './types/client.types';

/**
 * Facade the controller talks to, so route handlers stay thin and the
 * read/generate/simulate concerns keep their own services.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly queryService: ClientsQueryService,
    private readonly generatorService: ClientsGeneratorService,
    private readonly activityService: ClientsActivityService,
  ) {}

  home(): string {
    return 'Self-Reliance Clients API — simulated client, business and loan activity';
  }

  /** Reference data so an API consumer can discover valid filter values. */
  reference() {
    return {
      countries: programCountries.map((country) => ({
        isoAlpha3: country.isoAlpha3,
        isoAlpha2: country.isoAlpha2,
        name: country.countryName,
        currency: country.currency,
        locations: country.locations.map((location) => location.name),
        originCountries: country.originCountries,
        languages: country.languages,
      })),
      sectors: businessSectors.map((sector) => ({
        name: sector.name,
        subSectors: sector.subSectors,
        typicalLoanRangeUsd: sector.loanRangeUsd,
      })),
    };
  }

  listClients(query: ClientsQueryDto): Promise<PaginatedResult<Client>> {
    return this.queryService.listClients(query);
  }

  getClient(clientCode: string): Promise<Client> {
    return this.queryService.getClient(clientCode);
  }

  createClient(dto: CreateClientDto): Promise<EnrolClientResult> {
    return this.generatorService.createClientFromDto(dto);
  }

  listBusinesses(
    query: BusinessesQueryDto,
  ): Promise<PaginatedResult<Business>> {
    return this.queryService.listBusinesses(query);
  }

  getBusiness(businessCode: string): Promise<Business> {
    return this.queryService.getBusiness(businessCode);
  }

  createBusiness(dto: CreateBusinessDto): Promise<Business> {
    return this.generatorService.createBusinessFromDto(dto);
  }

  listLoans(query: LoansQueryDto): Promise<PaginatedResult<Loan>> {
    return this.queryService.listLoans(query);
  }

  getLoan(loanCode: string): Promise<Loan> {
    return this.queryService.getLoan(loanCode);
  }

  createLoan(dto: CreateLoanDto): Promise<Loan> {
    return this.generatorService.createLoanFromDto(dto);
  }

  listRepayments(
    query: RepaymentsQueryDto,
  ): Promise<PaginatedResult<LoanRepayment>> {
    return this.queryService.listRepayments(query);
  }

  listAdvisorySessions(
    query: AdvisorySessionsQueryDto,
  ): Promise<PaginatedResult<AdvisorySession>> {
    return this.queryService.listAdvisorySessions(query);
  }

  createAdvisorySession(
    dto: CreateAdvisorySessionDto,
  ): Promise<AdvisorySession> {
    return this.generatorService.createAdvisorySessionFromDto(dto);
  }

  listBusinessMetrics(
    query: BusinessMetricsQueryDto,
  ): Promise<PaginatedResult<BusinessMonthlyMetric>> {
    return this.queryService.listBusinessMetrics(query);
  }

  getPortfolioSummary(country?: string): Promise<PortfolioSummary> {
    return this.queryService.getPortfolioSummary(country);
  }

  seed(dto: SeedSimulationDto) {
    return this.generatorService.seedCaseload({
      clients: dto.clients ?? 100,
      country: dto.country,
      withHistory: dto.withHistory ?? true,
    });
  }

  async triggerTick(
    dto: TriggerActivityTickDto,
  ): Promise<TriggerActivityTickResult | ActivityTickResult> {
    const options = {
      source: ActivityTickSource.API,
      countryIso3: dto.country,
      intensity: dto.intensity ?? 1,
    };

    if (dto.wait === false) {
      return this.activityService.triggerTickInBackground(options);
    }
    return this.activityService.runTick(options);
  }

  getSimulationStatus(): Promise<SimulationStatus> {
    return this.activityService.getStatus();
  }
}
