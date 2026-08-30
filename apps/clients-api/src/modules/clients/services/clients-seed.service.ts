import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AllConfigType } from 'src/config';
import { ClientStatus, LoanStatus } from '../clients.constants';
import { allocateByPopulation } from '../constants/refugee-populations';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { backdatedEnrolmentDate } from '../helpers/client-generator.helper';
import { disburseLoan } from '../helpers/loan-generator.helper';
import { RecordBudget, SimulationMode } from '../helpers/record-budget.helper';
import { randomInt } from '../helpers/simulation-random.helper';
import { ClientsGeneratorService } from './clients-generator.service';

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

/** Bulk enrolment. The API path for volume; the script is the path for scale. */
@Injectable()
export class ClientsSeedService {
  private readonly logger = new Logger(ClientsSeedService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    private readonly generatorService: ClientsGeneratorService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

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
      ? [this.generatorService.resolveConfiguredCountry(options.country)]
      : this.generatorService.configuredCountries;

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
        const { client, business } = await this.generatorService.enrolClient({
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
          const loan = await this.generatorService.applyForLoan(business, {
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
}
