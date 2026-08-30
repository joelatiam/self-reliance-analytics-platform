import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllConfigType } from './config';
import { API_KEY_HEADER } from './modules/auth/guards/api-key.guard';
import { ACTIVITY_TICK_CRON } from './modules/clients/helpers/clients-activity-schedule.helper';
import validationOptions from './utils/validation-options';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.use(helmet());
  app.use(compression());

  const configService = app.get(ConfigService<AllConfigType>);
  const appConfig = configService.getOrThrow('app', { infer: true });

  app.enableShutdownHooks();
  app.setGlobalPrefix(appConfig.apiPrefix, { exclude: ['/health'] });
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new ValidationPipe(validationOptions));

  const options = new DocumentBuilder()
    .setTitle('Self-Reliance Clients API')
    .setDescription(
      'Simulated source system for self-reliance program client activity: refugee and ' +
        'host-community entrepreneurs in Rwanda, Kenya, Ethiopia, South Sudan ' +
        'and Chad, the businesses they run, the loans they take and repay, and ' +
        'the advisory they receive.\n\n' +
        `Activity is generated automatically on the schedule \`${ACTIVITY_TICK_CRON}\` ` +
        '(minutes 5, 15, 25, 35, 45, 55). The analytics pipeline pulls on the ' +
        'ten-minute boundary, so every fetch reads data that settled five ' +
        'minutes earlier.\n\n' +
        'Use **Simulation → tick** to generate activity on demand, ' +
        '**Simulation → seed** to bulk-enrol a caseload, and the `POST` ' +
        'endpoints under Clients, Businesses, Loans and Advisory to add ' +
        'specific records by hand.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: API_KEY_HEADER, in: 'header' },
      API_KEY_HEADER,
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);
  ['docs', `${appConfig.apiPrefix}/docs`].forEach((path) =>
    SwaggerModule.setup(path, app, document),
  );

  await app.listen(appConfig.port, '0.0.0.0');
}
void bootstrap();
