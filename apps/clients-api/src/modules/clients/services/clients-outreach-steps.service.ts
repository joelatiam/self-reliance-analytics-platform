import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { OUTSTANDING_LOAN_STATUSES } from '../clients.constants';
import { findCountryByIso3, ProgramCountry } from '../constants/countries';
import { Business } from '../entities/business.entity';
import { BusinessMonthlyMetric } from '../entities/business-monthly-metric.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';
import { generateBusinessMetric } from '../helpers/business-metric-generator.helper';
import { nextClientStatus } from '../helpers/client-generator.helper';
import { toPeriod } from '../helpers/simulation-format.helper';
import { ClientsActivitySelectionService } from './clients-activity-selection.service';
import { ClientsGeneratorService } from './clients-generator.service';

/**
 * The program path of a tick: coaching delivered, monthly business results
 * recorded, and clients moved through their lifecycle.
 */
@Injectable()
export class ClientsOutreachStepsService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(BusinessMonthlyMetric)
    private readonly metricRepository: Repository<BusinessMonthlyMetric>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    private readonly selectionService: ClientsActivitySelectionService,
    private readonly generatorService: ClientsGeneratorService,
  ) {}

  /** Logs coaching and training touchpoints. */
  async logAdvisorySessions(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<number> {
    let logged = 0;

    for (const client of await this.selectionService.pickActiveClients(
      scope,
      limit,
    )) {
      const country = findCountryByIso3(client.countryIso3);
      if (!country) continue;

      const business = await this.businessRepository.findOne({
        where: { clientCode: client.clientCode },
      });
      await this.generatorService.logAdvisorySession(
        client,
        country,
        business?.businessCode ?? null,
      );
      logged += 1;
    }

    return logged;
  }

  /** Posts monthly business results, which also move the business's revenue on. */
  async recordBusinessMetrics(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<number> {
    const period = toPeriod(new Date());
    let recorded = 0;

    for (const business of await this.selectionService.pickActiveBusinesses(
      scope,
      limit,
    )) {
      const country = findCountryByIso3(business.countryIso3);
      if (!country) continue;

      const hasActiveLoan = await this.loanRepository.exists({
        where: {
          businessCode: business.businessCode,
          status: In([...OUTSTANDING_LOAN_STATUSES]),
        },
      });

      const { metric, businessUpdate } = generateBusinessMetric({
        business,
        country,
        hasActiveLoan,
        period,
      });

      // One row per business per month: later ticks in the month refine it.
      await this.metricRepository.upsert(this.metricRepository.create(metric), {
        conflictPaths: ['businessCode', 'period'],
      });
      Object.assign(business, businessUpdate);
      await this.businessRepository.save(business);
      recorded += 1;
    }

    return recorded;
  }

  /** Moves a slice of the caseload through its lifecycle. */
  async advanceClientStatuses(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<number> {
    let updated = 0;

    for (const client of await this.selectionService.pickClientsForReview(
      scope,
      limit,
    )) {
      const status = nextClientStatus(client.status, client.enrolledOn);
      if (status === client.status) continue;

      client.status = status;
      await this.clientRepository.save(client);
      updated += 1;
    }

    return updated;
  }
}
