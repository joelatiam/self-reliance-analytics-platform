import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 100 })
  limit: number;

  @ApiProperty({ example: 2431 })
  total: number;

  @ApiProperty({ example: 25 })
  totalPages: number;

  @ApiProperty({
    description:
      'Highest updated_at in this page; pass it back as updatedSince on the next pull',
    example: '2026-08-30T10:25:00.412Z',
    nullable: true,
  })
  maxUpdatedAt: string | null;
}
