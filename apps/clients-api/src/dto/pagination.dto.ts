import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;

/**
 * Shared paging and watermark parameters. The pipeline pages through each
 * resource with `updatedSince` set to the highest `updated_at` it has already
 * ingested, which keeps every pull incremental.
 */
export class PaginationQueryDto {
  @ApiProperty({
    description: '1-based page number',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number.parseInt(value, 10) || 1)
  page?: number = 1;

  @ApiProperty({
    description: `Rows per page (max ${MAX_PAGE_SIZE})`,
    example: DEFAULT_PAGE_SIZE,
    required: false,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @Transform(({ value }) => Number.parseInt(value, 10) || DEFAULT_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiProperty({
    description:
      'Return only rows whose updated_at is strictly greater than this ISO-8601 timestamp',
    example: '2026-08-30T10:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  updatedSince?: string;
}
