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
import {
  ClientStatus,
  DisplacementStatus,
  EducationLevel,
  Gender,
  ProgramTrack,
} from '../clients.constants';

export class ClientsQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Host country as ISO3 (or ISO2), e.g. RWA or RW',
    example: 'RWA',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({
    description: 'Filter by displacement status',
    enum: DisplacementStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(DisplacementStatus)
  displacementStatus?: DisplacementStatus;

  @ApiProperty({ enum: ClientStatus, required: false })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}

export class ClientCodeParamDto {
  @ApiProperty({
    description: 'Client code',
    example: 'SR-C-RWA-000042',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  clientCode: string;
}

/**
 * Manual enrolment. Everything except country is optional — omitted fields are
 * filled in by the generator using that country's realistic distributions.
 */
export class CreateClientDto {
  @ApiProperty({
    description: 'Host country as ISO3 (or ISO2)',
    example: 'KEN',
    required: true,
  })
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country: string;

  @ApiProperty({ example: 'Amina', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @ApiProperty({ example: 'Warsame', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ enum: DisplacementStatus, required: false })
  @IsOptional()
  @IsEnum(DisplacementStatus)
  displacementStatus?: DisplacementStatus;

  @ApiProperty({
    description: 'ISO3 country the client was displaced from',
    example: 'SOM',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) => value?.toUpperCase())
  originCountryIso3?: string;

  @ApiProperty({ example: 'Kakuma Camp', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  locationName?: string;

  @ApiProperty({ example: 1994, required: false })
  @IsOptional()
  @IsInt()
  @Min(1940)
  @Max(2015)
  birthYear?: number;

  @ApiProperty({ enum: EducationLevel, required: false })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiProperty({ enum: ProgramTrack, required: false })
  @IsOptional()
  @IsEnum(ProgramTrack)
  programTrack?: ProgramTrack;

  @ApiProperty({
    description: 'Household size including the client',
    example: 6,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  householdSize?: number;

  @ApiProperty({
    description:
      'Also generate a business for this client (defaults to true, matching how enrolment works)',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined
      ? true
      : !['false', '0', 'no'].includes(String(value).toLowerCase()),
  )
  withBusiness?: boolean = true;

  @ApiProperty({
    description: 'Sector for the generated business, e.g. "Retail & Trade"',
    example: 'Retail & Trade',
    required: false,
  })
  @IsOptional()
  @IsString()
  sector?: string;
}
