import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from 'src/dto/pagination.dto';
import { LoanPurpose, LoanStatus } from '../clients.constants';

export class LoansQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'RWA', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({ enum: LoanStatus, required: false })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiProperty({ example: 'SR-C-RWA-000042', required: false })
  @IsOptional()
  @IsString()
  clientCode?: string;

  @ApiProperty({
    description: 'Only loans in this cycle (1 = first-time borrower)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number.parseInt(value, 10))
  loanCycle?: number;
}

export class LoanCodeParamDto {
  @ApiProperty({ example: 'SR-L-RWA-000042', required: true })
  @IsString()
  @IsNotEmpty()
  loanCode: string;
}

export class CreateLoanDto {
  @ApiProperty({
    description: 'Business the loan finances',
    example: 'SR-B-RWA-000042',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  businessCode: string;

  @ApiProperty({
    description: 'Principal in USD; sized from the sector when omitted',
    example: 750,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(50000)
  principalUsd?: number;

  @ApiProperty({ enum: LoanPurpose, required: false })
  @IsOptional()
  @IsEnum(LoanPurpose)
  purpose?: LoanPurpose;

  @ApiProperty({
    description: 'Repayment term in months',
    example: 12,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(36)
  termMonths?: number;

  @ApiProperty({
    description: 'Disburse immediately instead of leaving the loan PENDING',
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined
      ? false
      : !['false', '0', 'no'].includes(String(value).toLowerCase()),
  )
  disburse?: boolean = false;
}

export class RepaymentsQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'RWA', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 3)
  @Transform(({ value }) => value?.toUpperCase())
  country?: string;

  @ApiProperty({ example: 'SR-L-RWA-000042', required: false })
  @IsOptional()
  @IsString()
  loanCode?: string;

  @ApiProperty({ example: 'SR-C-RWA-000042', required: false })
  @IsOptional()
  @IsString()
  clientCode?: string;
}

export class RecordRepaymentDto {
  @ApiProperty({
    description: 'Loan to record the next installment against',
    example: 'SR-L-RWA-000042',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  loanCode: string;

  @ApiProperty({
    description:
      'Force the payment to be recorded as late by this many days; otherwise decided by the configured on-time rate',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  daysLate?: number;
}
