import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ENTITY_CODE_PREFIX } from '../clients.constants';

export type SequenceKind = keyof typeof ENTITY_CODE_PREFIX;

/** Table each entity code counts against, so codes stay dense per country. */
const SEQUENCE_TABLES: Partial<Record<SequenceKind, string>> = {
  CLIENT: 'clients',
  BUSINESS: 'businesses',
  LOAN: 'loans',
  REPAYMENT: 'loan_repayments',
  ADVISORY: 'advisory_sessions',
};

/**
 * Hands out the running numbers inside entity codes (SR-L-KEN-000417).
 * Counters are seeded from the database on first use and then kept in memory —
 * the simulator runs as a single writer, so no cross-instance locking is needed.
 */
@Injectable()
export class ClientsSequenceService {
  private readonly counters = new Map<string, number>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async next(kind: SequenceKind, countryIso3: string): Promise<number> {
    const key = `${kind}:${countryIso3}`;

    if (!this.counters.has(key)) {
      this.counters.set(key, await this.loadCurrentCount(kind, countryIso3));
    }

    const next = (this.counters.get(key) as number) + 1;
    this.counters.set(key, next);
    return next;
  }

  /** Reserves a contiguous block, for seeding many rows at once. */
  async nextBlock(
    kind: SequenceKind,
    countryIso3: string,
    size: number,
  ): Promise<number[]> {
    const sequences: number[] = [];
    for (let index = 0; index < size; index++) {
      sequences.push(await this.next(kind, countryIso3));
    }
    return sequences;
  }

  /** Drops cached counters; used after a database reset. */
  reset(): void {
    this.counters.clear();
  }

  private async loadCurrentCount(
    kind: SequenceKind,
    countryIso3: string,
  ): Promise<number> {
    const table = SEQUENCE_TABLES[kind];
    if (!table) return 0;

    const rows = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM ${table} WHERE country_iso3 = $1`,
      [countryIso3],
    );
    return rows[0]?.total ?? 0;
  }
}
