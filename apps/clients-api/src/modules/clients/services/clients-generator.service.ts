import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AllConfigType } from 'src/config';
import {
  ClientStatus,
  DisplacementStatus,
  LoanStatus,
} from '../clients.constants';
import {
  ProgramCountry,
  findCountryByIso3,
  resolveCountry,
} from '../constants/countries';
import { allocateByPopulation } from '../constants/refugee-populations';
import { findSector } from '../constants/sectors';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Business } from '../entities/business.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { CreateAdvisorySessionDto } from '../dto/advisory-session.dto';
import { CreateBusinessDto } from '../dto/business.dto';
import { CreateClientDto } from '../dto/client.dto';
import { CreateLoanDto } from '../dto/loan.dto';
import { generateAdvisorySession } from '../helpers/advisory-generator.helper';
import {
  backdatedEnrolmentDate,
  generateClient,
} from '../helpers/client-generator.helper';
import { generateBusiness } from '../helpers/business-generator.helper';
import {
  disburseLoan,
  generateLoan,
  nextLoanCycle,
} from '../helpers/loan-generator.helper';
import {
  parseMoney,
  toMoney,
  usdToLocal,
} from '../helpers/simulation-format.helper';
import { RecordBudget, SimulationMode } from '../helpers/record-budget.helper';
import { pickOne, randomInt } from '../helpers/simulation-random.helper';
import { ClientsSequenceService } from './clients-sequence.service';

export interface EnrolClientOptions {
  country: ProgramCountry;
  enrolledOn?: Date;
  displacementStatus?: DisplacementStatus;
  overrides?: Partial<Client>;
  withBusiness?: boolean;
  sector?: string;
}

export interface EnrolClientResult {
  client: Client;
  business: Business | null;
}

export interface SeedCaseloadResult {
  mode: SimulationMode;
  /** Clients asked for, before any test-mode cap. */
  requested: number;
  /** Clients allotted to each country by hosted-population share. */
  allocation: Record<string, number>;
  clients: number;
  businesses: number;
  loans: number;
  /** Rows actually written. */
  records: number;
}

/**
 * Creates the domain objects — clients, businesses, loans, advisory sessions.
 * The activity service calls it on a schedule; the controller calls it directly
 * when someone adds a record by hand through Swagger.
 */
@Injectable()
export class ClientsGeneratorService {
  private readonly logger = new Logger(ClientsGeneratorService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(AdvisorySession)
    private readonly advisorySessionRepository: Repository<AdvisorySession>,
    private readonly sequenceService: ClientsSequenceService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /** ISO3 codes the simulator is configured to produce activity for. */
  get configuredCountries(): ProgramCountry[] {
    const codes = this.configService.getOrThrow('clients', {
      infer: true,
    }).countries;
    return codes
      .map((code) => findCountryByIso3(code))
      .filter((country): country is ProgramCountry => Boolean(country));
  }

  resolveConfiguredCountry(code?: string): ProgramCountry {
    if (!code) return pickOne(this.configuredCountries);

    const country = resolveCountry(code);
    if (!country) {
      throw new BadRequestException(`Unknown country code: ${code}`);
    }
    if (
      !this.configuredCountries.some((c) => c.isoAlpha3 === country.isoAlpha3)
    ) {
      throw new BadRequestException(
        `Country ${country.isoAlpha3} is not enabled; configured countries are ${this.configuredCountries
          .map((c) => c.isoAlpha3)
          .join(', ')}`,
      );
    }
    return country;
  }

  async enrolClient(options: EnrolClientOptions): Promise<EnrolClientResult> {
    const { country } = options;
    const enrolledOn = options.enrolledOn ?? new Date();

    const sequence = await this.sequenceService.next(
      'CLIENT',
      country.isoAlpha3,
    );
    const generated = generateClient({
      country,
      sequence,
      enrolledOn,
      displacementStatus: options.displacementStatus,
    });

    const client = await this.clientRepository.save(
      this.clientRepository.create({ ...generated, ...options.overrides }),
    );

    const business =
      options.withBusiness === false
        ? null
        : await this.createBusinessForClient(client, country, options.sector);

    return { client, business };
  }

  /** Manual enrolment from the API; unset fields fall back to the generator. */
  async createClientFromDto(dto: CreateClientDto): Promise<EnrolClientResult> {
    const country = this.resolveConfiguredCountry(dto.country);

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

    return this.enrolClient({
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

    const country = this.countryOfClient(client);
    const business = await this.createBusinessForClient(
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

    const loan = await this.applyForLoan(business, {
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

    const session = await this.logAdvisorySession(
      client,
      this.countryOfClient(client),
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
  async applyForLoan(
    business: Business,
    options: {
      principalUsd?: number;
      purpose?: CreateLoanDto['purpose'];
      termMonths?: number;
      appliedOn?: Date;
    } = {},
  ): Promise<Loan> {
    const country = findCountryByIso3(business.countryIso3);
    if (!country) {
      throw new BadRequestException(
        `Business ${business.businessCode} has an unsupported country: ${business.countryIso3}`,
      );
    }

    const previousLoans = await this.loanRepository.count({
      where: { clientCode: business.clientCode },
    });
    const sequence = await this.sequenceService.next('LOAN', country.isoAlpha3);

    const generated = generateLoan({
      business,
      country,
      sequence,
      loanCycle: nextLoanCycle(previousLoans),
      appliedOn: options.appliedOn,
      principalUsd: options.principalUsd,
      purpose: options.purpose,
    });

    if (options.termMonths !== undefined) {
      const principal = parseMoney(generated.principalUsd);
      const rate = parseMoney(generated.interestRateAnnual);
      generated.termMonths = options.termMonths;
      generated.installmentsTotal = options.termMonths;
      generated.totalRepayableUsd = toMoney(
        principal * (1 + (rate / 100) * (options.termMonths / 12)),
      );
    }

    return this.loanRepository.save(this.loanRepository.create(generated));
  }

  async logAdvisorySession(
    client: Client,
    country: ProgramCountry,
    businessCode: string | null,
    deliveredAt: Date = new Date(),
  ): Promise<AdvisorySession> {
    const sequence = await this.sequenceService.next(
      'ADVISORY',
      country.isoAlpha3,
    );

    return this.advisorySessionRepository.save(
      this.advisorySessionRepository.create(
        generateAdvisorySession({
          client,
          country,
          sequence,
          businessCode,
          deliveredAt,
        }),
      ),
    );
  }

  /**
   * Backfills a caseload with trading history so the pipeline has something
   * meaningful to aggregate the first time it runs.
   *
   * Clients are split across countries in proportion to the displaced
   * population each one hosts, so Chad and Ethiopia dominate the dataset the
   * way they dominate the real caseload. In test mode the whole run is capped
   * at a hundred rows.
   */
  async seedCaseload(options: {
    clients: number;
    country?: string;
    withHistory: boolean;
  }): Promise<SeedCaseloadResult> {
    const clientsConfig = this.configService.getOrThrow('clients', {
      infer: true,
    });
    const budget = RecordBudget.forMode(clientsConfig.mode);

    const countries = options.country
      ? [this.resolveConfiguredCountry(options.country)]
      : this.configuredCountries;

    const allocation = allocateByPopulation(
      options.clients,
      countries.map((country) => country.isoAlpha3),
    );

    let clientsCreated = 0;
    let businessesCreated = 0;
    let loansCreated = 0;

    for (const country of countries) {
      const target = allocation[country.isoAlpha3] ?? 0;

      for (let index = 0; index < target; index++) {
        // A client is worth at least two rows (the person and their business).
        if (budget.remaining < 2) break;

        const enrolledOn = options.withHistory
          ? backdatedEnrolmentDate()
          : new Date();

        budget.take(2);
        const { client, business } = await this.enrolClient({
          country,
          enrolledOn,
        });
        clientsCreated += 1;
        if (business) businessesCreated += 1;

        if (!options.withHistory || !business) continue;

        // Roughly two thirds of the caseload has borrowed at least once.
        const loanCount = Math.min(randomInt(0, 2), budget.remaining);
        for (let cycle = 0; cycle < loanCount; cycle++) {
          budget.take(1);
          const loan = await this.applyForLoan(business, {
            appliedOn: enrolledOn,
          });
          Object.assign(loan, { status: LoanStatus.APPROVED });
          Object.assign(loan, disburseLoan(loan, enrolledOn));
          await this.loanRepository.save(loan);
          loansCreated += 1;
        }

        await this.clientRepository.update(
          { clientCode: client.clientCode },
          { status: ClientStatus.ACTIVE },
        );
      }

      if (budget.exhausted) break;
    }

    const result: SeedCaseloadResult = {
      mode: clientsConfig.mode,
      requested: options.clients,
      allocation,
      clients: clientsCreated,
      businesses: businessesCreated,
      loans: loansCreated,
      records: budget.spent,
    };

    this.logger.log(
      `Seeded caseload (${clientsConfig.mode} mode, ${budget.describe()}): ` +
        `${clientsCreated} clients, ${businessesCreated} businesses, ${loansCreated} loans`,
    );

    if (
      clientsConfig.mode === SimulationMode.TEST &&
      clientsCreated < options.clients
    ) {
      this.logger.warn(
        `Test mode capped this run at ${clientsConfig.testModeMaxRecords} rows; ` +
          `requested ${options.clients} clients, created ${clientsCreated}`,
      );
    }

    return result;
  }

  countryOfClient(client: Client): ProgramCountry {
    const country = findCountryByIso3(client.countryIso3);
    if (!country) {
      throw new BadRequestException(
        `Client ${client.clientCode} has an unsupported country: ${client.countryIso3}`,
      );
    }
    return country;
  }

  private async createBusinessForClient(
    client: Client,
    country: ProgramCountry,
    sectorName?: string,
  ): Promise<Business> {
    const sequence = await this.sequenceService.next(
      'BUSINESS',
      country.isoAlpha3,
    );

    return this.businessRepository.save(
      this.businessRepository.create(
        generateBusiness({
          client,
          country,
          sequence,
          sectorName,
          earliestYear: client.arrivalYear ?? undefined,
        }),
      ),
    );
  }
}
