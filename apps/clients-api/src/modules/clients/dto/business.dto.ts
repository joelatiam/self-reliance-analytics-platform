import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from 'src/dto/pagination.dto';
import {
  BusinessStage,
  BusinessStatus,
  MarketAccess,
  RegistrationStatus,
} from '../clients.constants';

export class BusinessesQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'KEN', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({ example: 'Retail & Trade', required: false })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiProperty({ enum: BusinessStage, required: false })
  @IsOptional()
  @IsEnum(BusinessStage)
  stage?: BusinessStage;

  @ApiProperty({ enum: BusinessStatus, required: false })
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;

  @ApiProperty({
    description: 'Return only businesses belonging to this client',
    example: 'SR-C-KEN-000042',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientCode?: string;
}

export class BusinessCodeParamDto {
  @ApiProperty({ example: 'SR-B-KEN-000042', required: true })
  @IsString()
  @IsNotEmpty()
  businessCode: string;
}

export class CreateBusinessDto {
  @ApiProperty({
    description: 'Owner of the business',
    example: 'SR-C-KEN-000042',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  clientCode: string;

  @ApiProperty({ example: 'Amani General Supplies', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiProperty({
    description: 'One of the supported sectors; random when omitted',
    example: 'Retail & Trade',
    required: false,
  })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiProperty({ enum: BusinessStage, required: false })
  @IsOptional()
  @IsEnum(BusinessStage)
  stage?: BusinessStage;

  @ApiProperty({ enum: RegistrationStatus, required: false })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  registrationStatus?: RegistrationStatus;

  @ApiProperty({ enum: MarketAccess, required: false })
  @IsOptional()
  @IsEnum(MarketAccess)
  marketAccess?: MarketAccess;

  @ApiProperty({
    description:
      'Monthly revenue in USD; generated from the sector when omitted',
    example: 850,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyRevenueUsd?: number;

  @ApiProperty({ example: 2023, required: false })
  @IsOptional()
  @IsInt()
  @Min(1990)
  startedYear?: number;
}
