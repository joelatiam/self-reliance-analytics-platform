import { ApiProperty } from '@nestjs/swagger';

/** Envelope used by write and action endpoints. */
export default class HttpResponseDto<T = unknown> {
  @ApiProperty({ description: 'HTTP status code', example: 200 })
  status: number;

  @ApiProperty({ description: 'Human-readable outcome', example: 'Success' })
  message: string;

  @ApiProperty({ description: 'Response payload', required: false })
  data?: T;
}
