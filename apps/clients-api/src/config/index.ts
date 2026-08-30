import appConfig, { AppConfigType } from './app.config';
import databaseConfig, { DatabaseConfigType } from './database.config';
import clientsConfig, {
  ClientsConfigType,
} from 'src/modules/clients/clients.config';

export type AllConfigType = {
  app: AppConfigType;
  database: DatabaseConfigType;
  clients: ClientsConfigType;
};

export const allConfig = [appConfig, databaseConfig, clientsConfig];
