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

  @ApiProperty({
    description:
      'Sort key of the last row in this page. Pass it back as `cursor` to read ' +
      'the next page without OFFSET, which is the only way to page a table ' +
      'that is being written to without skipping rows. Null when the walk is done.',
    example: 'MjAyNi0wOC0zMFQxMDoyNTowMC40MTJafDE0OTIy',
    nullable: true,
  })
  nextCursor: string | null;
}
