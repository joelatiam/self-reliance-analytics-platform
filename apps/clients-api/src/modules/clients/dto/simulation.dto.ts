import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class SeedSimulationDto {
  @ApiProperty({
    description:
      'How many clients to enrol, spread across the configured countries',
    example: 100,
    required: false,
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  clients?: number = 100;

  @ApiProperty({
    description: 'Restrict the seed to a single country (ISO3 or ISO2)',
    example: 'RWA',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({
    description:
      'Backdate enrolments and loan history so the seed has trading history to report on',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined
      ? true
      : !['false', '0', 'no'].includes(String(value).toLowerCase()),
  )
  withHistory?: boolean = true;
}

export class TriggerActivityTickDto {
  @ApiProperty({
    description: 'Restrict the tick to one country (ISO3 or ISO2)',
    example: 'KEN',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({
    description:
      'Multiplier on the configured per-tick volumes; 2 produces roughly twice the activity',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(20)
  intensity?: number = 1;

  @ApiProperty({
    description:
      'Wait for the tick to finish and return its counts, instead of running it in the background',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined
      ? true
      : !['false', '0', 'no'].includes(String(value).toLowerCase()),
  )
  wait?: boolean = true;
}

export class SummaryQueryDto {
  @ApiProperty({
    description: 'Restrict the rollup to one country (ISO3 or ISO2)',
    example: 'RWA',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;
}
