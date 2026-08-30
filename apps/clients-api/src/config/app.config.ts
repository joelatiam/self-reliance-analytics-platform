import { registerAs } from '@nestjs/config';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Dev = 'dev',
  Test = 'test',
  Production = 'production',
}

export type AppConfigType = {
  env: Environment;
  name: string;
  port: number;
  apiPrefix: string;
  /** Shared secret expected in the x-api-key header. Auth is disabled when empty. */
  apiKey: string;
};

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  APP_PORT: number;

  @IsOptional()
  @IsString()
  API_PREFIX: string;

  @IsOptional()
  @IsString()
  API_KEY: string;
}

export default registerAs<AppConfigType>('app', () => {
  const validatedConfig = plainToClass(
    EnvironmentVariablesValidator,
    process.env,
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return {
    env: (process.env.NODE_ENV as Environment) ?? Environment.Development,
    name: process.env.APP_NAME ?? 'Self-Reliance Clients API',
    port: process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 4000,
    apiPrefix: process.env.API_PREFIX ?? 'api',
    apiKey: process.env.API_KEY ?? '',
  };
});
