import {
  decodeCursor,
  encodeCursor,
  paginateByKeyset,
} from './keyset-pagination.helper';

const row = (id: number, iso: string) => ({ id, updatedAt: new Date(iso) });

describe('cursor encoding', () => {
  it('round-trips the sort key', () => {
    const source = row(14922, '2026-08-30T10:25:00.412Z');
    const decoded = decodeCursor(encodeCursor(source));

    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(14922);
    expect(decoded!.updatedAt.toISOString()).toBe('2026-08-30T10:25:00.412Z');
  });

  it('is opaque rather than a readable timestamp', () => {
    const cursor = encodeCursor(row(1, '2026-08-30T10:25:00.412Z'));
    expect(cursor).not.toContain('2026-08-30');
  });

  it('is URL-safe', () => {
    const cursor = encodeCursor(row(987654, '2026-08-30T10:25:00.412Z'));
    expect(cursor).toBe(encodeURIComponent(cursor));
  });

  it('rejects a malformed cursor instead of throwing', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(
      decodeCursor(Buffer.from('nope|nope').toString('base64url')),
    ).toBeNull();
  });
});

describe('paginateByKeyset', () => {
  interface BuilderStub {
    calls: { sql: string; params: Record<string, unknown> }[];
    andWhere(sql: string, params: Record<string, unknown>): BuilderStub;
    orderBy(): BuilderStub;
    addOrderBy(): BuilderStub;
    skip: jest.Mock<BuilderStub, [number]>;
    take(): BuilderStub;
    getManyAndCount(): Promise<[{ id: number; updatedAt: Date }[], number]>;
  }

  const builder = (
    rows: { id: number; updatedAt: Date }[],
    total = rows.length,
  ): BuilderStub => {
    const calls: { sql: string; params: Record<string, unknown> }[] = [];
    const stub: BuilderStub = {
      calls,
      andWhere(sql, params) {
        calls.push({ sql, params });
        return stub;
      },
      orderBy: () => stub,
      addOrderBy: () => stub,
      skip: jest.fn((offset: number) => (void offset, stub)),
      take: () => stub,
      getManyAndCount: () => Promise.resolve([rows, total]),
    };
    return stub;
  };

  it('uses a row-value comparison and no OFFSET when given a cursor', async () => {
    const stub = builder([row(9, '2026-08-30T10:00:02.000Z')]);
    const cursor = encodeCursor(row(8, '2026-08-30T10:00:01.000Z'));

    await paginateByKeyset(stub as never, 'loan', { cursor, limit: 1 });

    expect(stub.skip).not.toHaveBeenCalled();
    expect(stub.calls[0].sql).toContain('(loan.updatedAt, loan.id) >');
    expect(stub.calls[0].params.cursorId).toBe(8);
  });

  it('falls back to OFFSET paging when no cursor is supplied', async () => {
    const stub = builder([row(1, '2026-08-30T10:00:00.000Z')]);

    await paginateByKeyset(stub as never, 'loan', { page: 3, limit: 50 });

    expect(stub.skip).toHaveBeenCalledWith(100);
  });

  it('hands back a cursor only while a full page came out', async () => {
    const full = builder([row(1, '2026-08-30T10:00:00.000Z')], 10);
    const fullPage = await paginateByKeyset(full as never, 'loan', {
      limit: 1,
    });
    expect(fullPage.meta.nextCursor).not.toBeNull();

    const short = builder([row(1, '2026-08-30T10:00:00.000Z')], 10);
    const shortPage = await paginateByKeyset(short as never, 'loan', {
      limit: 50,
    });
    expect(shortPage.meta.nextCursor).toBeNull();
  });

  it('reports the last row as the watermark', async () => {
    const stub = builder([
      row(1, '2026-08-30T10:00:00.000Z'),
      row(2, '2026-08-30T10:00:09.000Z'),
    ]);

    const result = await paginateByKeyset(stub as never, 'loan', {});

    expect(result.meta.maxUpdatedAt).toBe('2026-08-30T10:00:09.000Z');
  });

  it('walks rows sharing a timestamp without repeating or skipping one', async () => {
    // The case OFFSET paging gets wrong: a batch written in one transaction
    // shares an updated_at, so the id half of the key does the splitting.
    const sameTs = '2026-08-30T10:00:00.000Z';
    const first = builder([row(1, sameTs), row(2, sameTs)], 4);
    const page1 = await paginateByKeyset(first as never, 'loan', { limit: 2 });

    const second = builder([row(3, sameTs), row(4, sameTs)], 4);
    await paginateByKeyset(second as never, 'loan', {
      cursor: page1.meta.nextCursor!,
      limit: 2,
    });

    expect(second.calls[0].params.cursorId).toBe(2);
    expect(second.calls[0].params.cursorUpdatedAt).toEqual(new Date(sameTs));
  });
});
