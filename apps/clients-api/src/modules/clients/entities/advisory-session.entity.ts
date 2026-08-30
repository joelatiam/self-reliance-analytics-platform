import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AdvisorySessionType } from '../clients.constants';
import { Client } from './client.entity';

/** A training or coaching touchpoint delivered to a client. */
@Entity('advisory_sessions')
export class AdvisorySession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'session_code', type: 'varchar', length: 32 })
  sessionCode!: string;

  @Index()
  @Column({ name: 'client_code', type: 'varchar', length: 32 })
  clientCode!: string;

  @ManyToOne(() => Client, (client) => client.advisorySessions)
  @JoinColumn({ name: 'client_code', referencedColumnName: 'clientCode' })
  client?: Client;

  @Column({
    name: 'business_code',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  businessCode!: string | null;

  @Index()
  @Column({ name: 'country_iso3', type: 'varchar', length: 3 })
  countryIso3!: string;

  @Column({ name: 'advisor_code', type: 'varchar', length: 32 })
  advisorCode!: string;

  @Column({ name: 'session_type', type: 'varchar', length: 32 })
  sessionType!: AdvisorySessionType;

  @Column({ name: 'topic', type: 'varchar', length: 160 })
  topic!: string;

  /** Sessions are delivered in the client's own language, not English by default. */
  @Column({ name: 'language', type: 'varchar', length: 60 })
  language!: string;

  @Column({ name: 'delivered_at', type: 'timestamptz' })
  deliveredAt!: Date;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes!: number;

  @Column({ name: 'attended', type: 'boolean', default: true })
  attended!: boolean;

  /** 1-5, null when the client did not attend. */
  @Column({ name: 'satisfaction_score', type: 'int', nullable: true })
  satisfactionScore!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
