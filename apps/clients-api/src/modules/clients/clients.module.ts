import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AllConfigType } from 'src/config';
import { AuthModule } from '../auth/auth.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ActivityTick } from './entities/activity-tick.entity';
import { AdvisorySession } from './entities/advisory-session.entity';
import { Business } from './entities/business.entity';
import { BusinessMonthlyMetric } from './entities/business-monthly-metric.entity';
import { Client } from './entities/client.entity';
import { Loan } from './entities/loan.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { seedSimulation } from './helpers/simulation-random.helper';
import { ClientsActivityService } from './services/clients-activity.service';
import { ClientsGeneratorService } from './services/clients-generator.service';
import { ClientsQueryService } from './services/clients-query.service';
import { ClientsSequenceService } from './services/clients-sequence.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([
      Client,
      Business,
      Loan,
      LoanRepayment,
      AdvisorySession,
      BusinessMonthlyMetric,
      ActivityTick,
    ]),
  ],
  controllers: [ClientsController],
  providers: [
    ClientsService,
    ClientsQueryService,
    ClientsGeneratorService,
    ClientsActivityService,
    ClientsSequenceService,
  ],
  exports: [ClientsService, ClientsActivityService],
})
export class ClientsModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClientsModule.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly generatorService: ClientsGeneratorService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * A brand new database has nothing to report on, so the first boot seeds a
   * starting caseload with backdated history. Later boots leave it alone.
   */
  async onApplicationBootstrap(): Promise<void> {
    const clientsConfig = this.configService.getOrThrow('clients', {
      infer: true,
    });

    seedSimulation(clientsConfig.simulationSeed);

    if (!clientsConfig.seedOnBoot) {
      this.logger.log('Boot seeding disabled (SIMULATION_SEED_ON_BOOT=false)');
      return;
    }

    const existing = await this.clientRepository.count();
    if (existing > 0) {
      this.logger.log(
        `Database already holds ${existing} clients; skipping boot seed`,
      );
      return;
    }

    this.logger.log(
      `Seeding ${clientsConfig.seedClientCount} clients across ${clientsConfig.countries.join(', ')}`,
    );
    const seeded = await this.generatorService.seedCaseload({
      clients: clientsConfig.seedClientCount,
      withHistory: true,
    });
    this.logger.log(
      `Boot seed complete: ${seeded.clients} clients, ${seeded.businesses} businesses, ${seeded.loans} loans`,
    );
  }
}
