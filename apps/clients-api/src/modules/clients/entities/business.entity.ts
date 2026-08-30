import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  BusinessStage,
  BusinessStatus,
  MarketAccess,
  RegistrationStatus,
} from '../clients.constants';
import { Client } from './client.entity';
import { BusinessMonthlyMetric } from './business-monthly-metric.entity';

/** The enterprise a client runs; the unit loans and advisory attach to. */
@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'business_code', type: 'varchar', length: 32 })
  businessCode!: string;

  @Index()
  @Column({ name: 'client_code', type: 'varchar', length: 32 })
  clientCode!: string;

  @ManyToOne(() => Client, (client) => client.businesses)
  @JoinColumn({ name: 'client_code', referencedColumnName: 'clientCode' })
  client?: Client;

  @Column({ name: 'name', type: 'varchar', length: 160 })
  name!: string;

  @Index()
  @Column({ name: 'sector', type: 'varchar', length: 80 })
  sector!: string;

  @Column({ name: 'sub_sector', type: 'varchar', length: 80 })
  subSector!: string;

  @Column({ name: 'stage', type: 'varchar', length: 32 })
  stage!: BusinessStage;

  @Column({ name: 'registration_status', type: 'varchar', length: 32 })
  registrationStatus!: RegistrationStatus;

  @Column({ name: 'market_access', type: 'varchar', length: 32 })
  marketAccess!: MarketAccess;

  @Index()
  @Column({ name: 'country_iso3', type: 'varchar', length: 3 })
  countryIso3!: string;

  @Column({ name: 'location_name', type: 'varchar', length: 120 })
  locationName!: string;

  @Column({ name: 'started_year', type: 'int' })
  startedYear!: number;

  @Column({ name: 'employees_full_time', type: 'int', default: 0 })
  employeesFullTime!: number;

  @Column({ name: 'employees_part_time', type: 'int', default: 0 })
  employeesPartTime!: number;

  @Column({ name: 'employees_female', type: 'int', default: 0 })
  employeesFemale!: number;

  /** Jobs held by displaced people — the metric behind the program's jobs target. */
  @Column({ name: 'employees_displaced', type: 'int', default: 0 })
  employeesDisplaced!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3 })
  currency!: string;

  @Column({
    name: 'monthly_revenue_local',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  monthlyRevenueLocal!: string;

  @Column({
    name: 'monthly_revenue_usd',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  monthlyRevenueUsd!: string;

  @Column({
    name: 'monthly_profit_usd',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  monthlyProfitUsd!: string;

  /** Revenue at enrolment, kept to compute growth since program support began. */
  @Column({
    name: 'baseline_monthly_revenue_usd',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  baselineMonthlyRevenueUsd!: string;

  @Index()
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: BusinessStatus;

  @OneToMany(() => BusinessMonthlyMetric, (metric) => metric.business)
  monthlyMetrics?: BusinessMonthlyMetric[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
