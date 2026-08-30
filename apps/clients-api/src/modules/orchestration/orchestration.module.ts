import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ClientsModule } from 'src/modules/clients/clients.module';
import { OrchestrationTasksService } from './orchestration-tasks.service';

@Module({
  imports: [ConfigModule, ClientsModule],
  providers: [OrchestrationTasksService],
})
export class OrchestrationModule {}
