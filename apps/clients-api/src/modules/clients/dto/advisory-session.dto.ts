import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from 'src/dto/pagination.dto';
import { AdvisorySessionType } from '../clients.constants';

export class AdvisorySessionsQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'ETH', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({ enum: AdvisorySessionType, required: false })
  @IsOptional()
  @IsEnum(AdvisorySessionType)
  sessionType?: AdvisorySessionType;

  @ApiProperty({ example: 'SR-C-ETH-000042', required: false })
  @IsOptional()
  @IsString()
  clientCode?: string;
}

export class CreateAdvisorySessionDto {
  @ApiProperty({ example: 'SR-C-ETH-000042', required: true })
  @IsString()
  @IsNotEmpty()
  clientCode: string;

  @ApiProperty({ enum: AdvisorySessionType, required: false })
  @IsOptional()
  @IsEnum(AdvisorySessionType)
  sessionType?: AdvisorySessionType;

  @ApiProperty({ example: 'Cash flow forecasting', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  topic?: string;

  @ApiProperty({ example: 90, required: false })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;
}

export class BusinessMetricsQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'SSD', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({
    description: 'Reporting month as YYYY-MM',
    example: '2026-08',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(7, 7)
  period?: string;

  @ApiProperty({ example: 'SR-B-SSD-000042', required: false })
  @IsOptional()
  @IsString()
  businessCode?: string;
}
