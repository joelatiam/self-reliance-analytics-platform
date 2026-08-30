import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Business } from './business.entity';

/** Monthly performance snapshot; the basis for revenue-growth impact reporting. */
@Entity('business_monthly_metrics')
@Unique('uq_business_monthly_metrics_business_period', [
  'businessCode',
  'period',
])
export class BusinessMonthlyMetric {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'business_code', type: 'varchar', length: 32 })
  businessCode!: string;

  @ManyToOne(() => Business, (business) => business.monthlyMetrics)
  @JoinColumn({ name: 'business_code', referencedColumnName: 'businessCode' })
  business?: Business;

  @Index()
  @Column({ name: 'client_code', type: 'varchar', length: 32 })
  clientCode!: string;

  @Index()
  @Column({ name: 'country_iso3', type: 'varchar', length: 3 })
  countryIso3!: string;

  /** Reporting month as YYYY-MM. */
  @Index()
  @Column({ name: 'period', type: 'varchar', length: 7 })
  period!: string;

  @Column({ name: 'currency', type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'revenue_local', type: 'numeric', precision: 18, scale: 2 })
  revenueLocal!: string;

  @Column({ name: 'revenue_usd', type: 'numeric', precision: 18, scale: 2 })
  revenueUsd!: string;

  @Column({ name: 'profit_usd', type: 'numeric', precision: 18, scale: 2 })
  profitUsd!: string;

  @Column({ name: 'employees_total', type: 'int', default: 0 })
  employeesTotal!: number;

  @Column({ name: 'customers_served', type: 'int', default: 0 })
  customersServed!: number;

  /** Percent change against the business's baseline revenue at enrolment. */
  @Column({
    name: 'revenue_growth_pct',
    type: 'numeric',
    precision: 8,
    scale: 2,
  })
  revenueGrowthPct!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
