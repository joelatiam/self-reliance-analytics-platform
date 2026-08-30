import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { DEFAULT_PAGE_SIZE } from 'src/dto/pagination.dto';
import { PaginatedResult } from '../types/client.types';

/** Every list endpoint pages over rows carrying these two columns. */
export interface KeysetRow extends ObjectLiteral {
  id: number;
  updatedAt: Date;
}

export interface KeysetQuery {
  page?: number;
  limit?: number;
  updatedSince?: string;
  cursor?: string;
}

interface CursorPosition {
  updatedAt: Date;
  id: number;
}

/**
 * A cursor is just the sort key of the last row handed out, base64'd so callers
 * treat it as opaque and we stay free to change what goes in it.
 */
export function encodeCursor(row: KeysetRow): string {
  return Buffer.from(`${row.updatedAt.toISOString()}|${row.id}`).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string): CursorPosition | null {
  const [timestamp, id] = Buffer.from(cursor, 'base64url')
    .toString('utf8')
    .split('|');

  const updatedAt = new Date(timestamp);
  const parsedId = Number.parseInt(id, 10);

  if (Number.isNaN(updatedAt.getTime()) || Number.isNaN(parsedId)) return null;
  return { updatedAt, id: parsedId };
}

/**
 * Pages a query in (updated_at, id) order.
 *
 * With a `cursor` this is a keyset walk, which is what the pipeline uses: the
 * next page is defined by the last row's sort key rather than by an offset, so
 * a row updated mid-walk moving to the end of the ordering cannot shift an
 * unread row backwards into a page already consumed. Under OFFSET that row is
 * skipped, and because the watermark advances past its timestamp it is never
 * collected again — silent data loss on exactly the fast-moving source this
 * API exists to simulate.
 *
 * Without a cursor it falls back to OFFSET paging, which keeps `page` working
 * for Swagger and for anyone browsing by hand.
 */
export async function paginateByKeyset<T extends KeysetRow>(
  builder: SelectQueryBuilder<T>,
  alias: string,
  query: KeysetQuery,
): Promise<PaginatedResult<T>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;

  if (query.updatedSince) {
    builder.andWhere(`${alias}.updatedAt > :updatedSince`, {
      updatedSince: new Date(query.updatedSince),
    });
  }

  const position = query.cursor ? decodeCursor(query.cursor) : null;

  // Counted before the cursor narrows the query. Counting after it would make
  // `total` mean "rows still ahead of the cursor", so it would shrink on every
  // page of a walk and read like rows were disappearing from the source.
  const countBuilder = builder.clone();

  if (position) {
    // Row-value comparison, so rows sharing a timestamp are split by id
    // instead of being re-read or skipped at the page boundary.
    builder.andWhere(
      `(${alias}.updatedAt, ${alias}.id) > (:cursorUpdatedAt, :cursorId)`,
      { cursorUpdatedAt: position.updatedAt, cursorId: position.id },
    );
  }

  builder.orderBy(`${alias}.updatedAt`, 'ASC').addOrderBy(`${alias}.id`, 'ASC');

  if (!position) {
    builder.skip((page - 1) * limit);
  }

  const [data, total] = await Promise.all([
    builder.take(limit).getMany(),
    countBuilder.getCount(),
  ]);
  const last = data.length ? data[data.length - 1] : null;

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      maxUpdatedAt: last ? last.updatedAt.toISOString() : null,
      // A short page means the walk is done; null stops the caller cleanly.
      nextCursor: last && data.length === limit ? encodeCursor(last) : null,
    },
  };
}
