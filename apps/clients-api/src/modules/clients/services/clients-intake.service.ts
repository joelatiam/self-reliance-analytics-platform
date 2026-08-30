import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LoanStatus } from '../clients.constants';
import { findSector } from '../constants/sectors';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Business } from '../entities/business.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { CreateAdvisorySessionDto } from '../dto/advisory-session.dto';
import { CreateBusinessDto } from '../dto/business.dto';
import { CreateClientDto } from '../dto/client.dto';
import { CreateLoanDto } from '../dto/loan.dto';
import { disburseLoan } from '../helpers/loan-generator.helper';
import { toMoney, usdToLocal } from '../helpers/simulation-format.helper';
import {
  ClientsGeneratorService,
  EnrolClientResult,
} from './clients-generator.service';

/**
 * Records added by hand through the API. Everything the caller leaves out is
 * filled in by the generator from that country's distributions, so a one-field
 * request still produces a coherent client.
 */
@Injectable()
export class ClientsIntakeService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(AdvisorySession)
    private readonly advisorySessionRepository: Repository<AdvisorySession>,
    private readonly generatorService: ClientsGeneratorService,
  ) {}

  /** Manual enrolment from the API; unset fields fall back to the generator. */
  async createClientFromDto(dto: CreateClientDto): Promise<EnrolClientResult> {
    const country = this.generatorService.resolveConfiguredCountry(dto.country);

    const overrides: Partial<Client> = {};
    if (dto.firstName) overrides.firstName = dto.firstName;
    if (dto.lastName) overrides.lastName = dto.lastName;
    if (dto.gender) overrides.gender = dto.gender;
    if (dto.educationLevel) overrides.educationLevel = dto.educationLevel;
    if (dto.programTrack) overrides.programTrack = dto.programTrack;
    if (dto.householdSize !== undefined) {
      overrides.householdSize = dto.householdSize;
      overrides.dependents = Math.max(0, dto.householdSize - 1);
    }
    if (dto.birthYear !== undefined) {
      overrides.birthYear = dto.birthYear;
      overrides.isYouth = new Date().getFullYear() - dto.birthYear <= 35;
    }
    if (dto.originCountryIso3) {
      overrides.originCountryIso3 = dto.originCountryIso3;
    }
    if (dto.locationName) {
      const location = country.locations.find(
        (entry) => entry.name.toLowerCase() === dto.locationName?.toLowerCase(),
      );
      if (!location) {
        throw new BadRequestException(
          `Unknown location for ${country.isoAlpha3}: ${dto.locationName}. Known locations: ${country.locations
            .map((entry) => entry.name)
            .join(', ')}`,
        );
      }
      overrides.locationName = location.name;
      overrides.region = location.region;
      overrides.inCamp = location.isCamp;
    }
    if (dto.sector && !findSector(dto.sector)) {
      throw new BadRequestException(`Unknown sector: ${dto.sector}`);
    }

    return this.generatorService.enrolClient({
      country,
      displacementStatus: dto.displacementStatus,
      overrides,
      withBusiness: dto.withBusiness,
      sector: dto.sector,
    });
  }

  async createBusinessFromDto(dto: CreateBusinessDto): Promise<Business> {
    const client = await this.clientRepository.findOne({
      where: { clientCode: dto.clientCode },
    });
    if (!client) {
      throw new NotFoundException(`Client not found: ${dto.clientCode}`);
    }
    if (dto.sector && !findSector(dto.sector)) {
      throw new BadRequestException(`Unknown sector: ${dto.sector}`);
    }

    const country = this.generatorService.countryOfClient(client);
    const business = await this.generatorService.createBusinessForClient(
      client,
      country,
      dto.sector,
    );

    const overrides: Partial<Business> = {};
    if (dto.name) overrides.name = dto.name;
    if (dto.stage) overrides.stage = dto.stage;
    if (dto.registrationStatus) {
      overrides.registrationStatus = dto.registrationStatus;
    }
    if (dto.marketAccess) overrides.marketAccess = dto.marketAccess;
    if (dto.startedYear !== undefined) overrides.startedYear = dto.startedYear;
    if (dto.monthlyRevenueUsd !== undefined) {
      overrides.monthlyRevenueUsd = toMoney(dto.monthlyRevenueUsd);
      overrides.baselineMonthlyRevenueUsd = toMoney(dto.monthlyRevenueUsd);
      overrides.monthlyRevenueLocal = toMoney(
        usdToLocal(dto.monthlyRevenueUsd, country.fxRatePerUsd),
      );
      overrides.monthlyProfitUsd = toMoney(dto.monthlyRevenueUsd * 0.2);
    }

    if (Object.keys(overrides).length === 0) return business;

    Object.assign(business, overrides);
    return this.businessRepository.save(business);
  }

  async createLoanFromDto(dto: CreateLoanDto): Promise<Loan> {
    const business = await this.businessRepository.findOne({
      where: { businessCode: dto.businessCode },
    });
    if (!business) {
      throw new NotFoundException(`Business not found: ${dto.businessCode}`);
    }

    const loan = await this.generatorService.applyForLoan(business, {
      principalUsd: dto.principalUsd,
      purpose: dto.purpose,
      termMonths: dto.termMonths,
    });

    if (!dto.disburse) return loan;

    Object.assign(loan, { status: LoanStatus.APPROVED });
    Object.assign(loan, disburseLoan(loan));
    return this.loanRepository.save(loan);
  }

  async createAdvisorySessionFromDto(
    dto: CreateAdvisorySessionDto,
  ): Promise<AdvisorySession> {
    const client = await this.clientRepository.findOne({
      where: { clientCode: dto.clientCode },
    });
    if (!client) {
      throw new NotFoundException(`Client not found: ${dto.clientCode}`);
    }

    const business = await this.businessRepository.findOne({
      where: { clientCode: client.clientCode },
    });

    const session = await this.generatorService.logAdvisorySession(
      client,
      this.generatorService.countryOfClient(client),
      business?.businessCode ?? null,
    );

    const overrides: Partial<AdvisorySession> = {};
    if (dto.sessionType) overrides.sessionType = dto.sessionType;
    if (dto.topic) overrides.topic = dto.topic;
    if (dto.durationMinutes !== undefined) {
      overrides.durationMinutes = dto.durationMinutes;
    }

    if (Object.keys(overrides).length === 0) return session;

    Object.assign(session, overrides);
    return this.advisorySessionRepository.save(session);
  }

  /** Files a new loan application against a business. */
}
