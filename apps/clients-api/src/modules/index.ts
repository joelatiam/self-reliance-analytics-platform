import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { OrchestrationModule } from './orchestration/orchestration.module';

export const modules = [AuthModule, ClientsModule, OrchestrationModule];
