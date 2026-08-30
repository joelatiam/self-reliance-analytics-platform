import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AllConfigType } from 'src/config';
import { DisplacementStatus } from '../clients.constants';
import {
  ProgramCountry,
  findCountryByIso3,
  resolveCountry,
} from '../constants/countries';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Business } from '../entities/business.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { CreateLoanDto } from '../dto/loan.dto';
import { generateAdvisorySession } from '../helpers/advisory-generator.helper';
import { generateClient } from '../helpers/client-generator.helper';
import { generateBusiness } from '../helpers/business-generator.helper';
import { pickOne } from '../helpers/simulation-random.helper';
import { generateLoan, nextLoanCycle } from '../helpers/loan-generator.helper';
import { parseMoney, toMoney } from '../helpers/simulation-format.helper';
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

  countryOfClient(client: Client): ProgramCountry {
    const country = findCountryByIso3(client.countryIso3);
    if (!country) {
      throw new BadRequestException(
        `Client ${client.clientCode} has an unsupported country: ${client.countryIso3}`,
      );
    }
    return country;
  }

  async createBusinessForClient(
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
