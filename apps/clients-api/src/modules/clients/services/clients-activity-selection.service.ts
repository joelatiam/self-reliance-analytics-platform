import { Injectable } from '@nestjs/common';
import { In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import {
  ClientStatus,
  LoanStatus,
  OUTSTANDING_LOAN_STATUSES,
} from '../clients.constants';
import { ProgramCountry } from '../constants/countries';
import { Business } from '../entities/business.entity';
import { Client } from '../entities/client.entity';
import { Loan } from '../entities/loan.entity';

/**
 * Picks which rows a tick should act on. Kept apart from the tick itself
 * because "what changes" and "what to change it on" are different questions,
 * and these are the queries most likely to need tuning as the caseload grows.
 *
 * Selection is randomised rather than ordered so activity spreads across the
 * whole caseload instead of repeatedly hitting the same rows.
 */
@Injectable()
export class ClientsActivitySelectionService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
  ) {}

  async pickBusinessesWithoutOpenLoan(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Business[]> {
    if (limit <= 0) return [];

    return this.businessRepository
      .createQueryBuilder('business')
      .where('business.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('business.status = :status', { status: 'ACTIVE' })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM loans loan
          WHERE loan.business_code = business.business_code
            AND loan.status IN (:...openStatuses)
        )`,
        {
          openStatuses: [
            LoanStatus.PENDING,
            LoanStatus.APPROVED,
            ...OUTSTANDING_LOAN_STATUSES,
          ],
        },
      )
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  async pickLoansByStatus(
    scope: ProgramCountry[],
    statuses: LoanStatus[],
    limit: number,
  ): Promise<Loan[]> {
    if (limit <= 0) return [];

    return this.loanRepository
      .createQueryBuilder('loan')
      .where('loan.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('loan.status IN (:...statuses)', { statuses })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  async pickActiveClients(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Client[]> {
    if (limit <= 0) return [];

    return this.clientRepository
      .createQueryBuilder('client')
      .where('client.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('client.status IN (:...statuses)', {
        statuses: [ClientStatus.ACTIVE, ClientStatus.ENROLLED],
      })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  async pickActiveBusinesses(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Business[]> {
    if (limit <= 0) return [];

    return this.businessRepository
      .createQueryBuilder('business')
      .where('business.countryIso3 IN (:...countries)', {
        countries: scope.map((country) => country.isoAlpha3),
      })
      .andWhere('business.status = :status', { status: 'ACTIVE' })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  async pickClientsForReview(
    scope: ProgramCountry[],
    limit: number,
  ): Promise<Client[]> {
    if (limit <= 0) return [];

    return this.clientRepository.find({
      where: {
        countryIso3: In(scope.map((country) => country.isoAlpha3)),
        status: Not(In([ClientStatus.EXITED, ClientStatus.GRADUATED])),
      },
      order: { updatedAt: 'ASC' },
      take: limit,
    });
  }
}
