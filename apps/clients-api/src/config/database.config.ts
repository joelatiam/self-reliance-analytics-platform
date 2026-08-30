import { registerAs } from '@nestjs/config';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

export type DatabaseConfigType = {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  /** Entities are the source of truth for this simulator; no migrations to maintain. */
  synchronize: boolean;
  logging: boolean;
};

class EnvironmentVariablesValidator {
  @IsOptional()
  @IsString()
  DATABASE_HOST: string;

  @IsOptional()
  @IsString()
  DATABASE_USERNAME: string;

  @IsOptional()
  @IsString()
  DATABASE_PASSWORD: string;

  @IsOptional()
  @IsString()
  DATABASE_NAME: string;

  @IsOptional()
  @IsBoolean()
  DATABASE_LOGGING: boolean;
}

export default registerAs<DatabaseConfigType>('database', () => {
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
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: process.env.DATABASE_PORT
      ? parseInt(process.env.DATABASE_PORT, 10)
      : 5432,
    username: process.env.DATABASE_USERNAME ?? 'sr_app',
    password: process.env.DATABASE_PASSWORD ?? 'sr_app_pw',
    name: process.env.DATABASE_NAME ?? 'self_reliance_ops',
    synchronize: process.env.DATABASE_SYNCHRONIZE !== 'false',
    logging: process.env.DATABASE_LOGGING === 'true',
  };
});
