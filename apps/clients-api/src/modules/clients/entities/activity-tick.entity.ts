import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ActivityTickSource } from '../clients.constants';

/**
 * Audit row for every simulation run. Lets the API report what the last tick
 * did and gives the pipeline something to reconcile its pulls against.
 */
@Entity('activity_ticks')
export class ActivityTick {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'source', type: 'varchar', length: 16 })
  source!: ActivityTickSource;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamptz' })
  finishedAt!: Date;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number;

  @Column({ name: 'clients_enrolled', type: 'int', default: 0 })
  clientsEnrolled!: number;

  @Column({ name: 'businesses_created', type: 'int', default: 0 })
  businessesCreated!: number;

  @Column({ name: 'loans_applied', type: 'int', default: 0 })
  loansApplied!: number;

  @Column({ name: 'loans_disbursed', type: 'int', default: 0 })
  loansDisbursed!: number;

  @Column({ name: 'repayments_recorded', type: 'int', default: 0 })
  repaymentsRecorded!: number;

  @Column({ name: 'loans_closed', type: 'int', default: 0 })
  loansClosed!: number;

  @Column({ name: 'advisory_sessions_logged', type: 'int', default: 0 })
  advisorySessionsLogged!: number;

  @Column({ name: 'metrics_recorded', type: 'int', default: 0 })
  metricsRecorded!: number;

  @Column({ name: 'clients_updated', type: 'int', default: 0 })
  clientsUpdated!: number;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
