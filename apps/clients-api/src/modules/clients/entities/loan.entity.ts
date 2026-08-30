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

import { LoanPurpose, LoanStatus, RiskGrade } from '../clients.constants';
import { Client } from './client.entity';
import { LoanRepayment } from './loan-repayment.entity';

/** A below-market loan issued to a client's business. */
@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'loan_code', type: 'varchar', length: 32 })
  loanCode!: string;

  @Index()
  @Column({ name: 'client_code', type: 'varchar', length: 32 })
  clientCode!: string;

  @ManyToOne(() => Client, (client) => client.loans)
  @JoinColumn({ name: 'client_code', referencedColumnName: 'clientCode' })
  client?: Client;

  @Index()
  @Column({ name: 'business_code', type: 'varchar', length: 32 })
  businessCode!: string;

  @Index()
  @Column({ name: 'country_iso3', type: 'varchar', length: 3 })
  countryIso3!: string;

  /** 1 for a first-time borrower; repeat cycles unlock larger principals. */
  @Column({ name: 'loan_cycle', type: 'int', default: 1 })
  loanCycle!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3 })
  currency!: string;

  @Column({
    name: 'principal_local',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  principalLocal!: string;

  @Column({ name: 'principal_usd', type: 'numeric', precision: 18, scale: 2 })
  principalUsd!: string;

  /** Below-market annual rate, in percent. */
  @Column({
    name: 'interest_rate_annual',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  interestRateAnnual!: string;

  @Column({ name: 'term_months', type: 'int' })
  termMonths!: number;

  @Column({ name: 'purpose', type: 'varchar', length: 32 })
  purpose!: LoanPurpose;

  @Column({ name: 'risk_grade', type: 'varchar', length: 2 })
  riskGrade!: RiskGrade;

  @Column({ name: 'applied_on', type: 'date' })
  appliedOn!: string;

  @Column({ name: 'disbursed_on', type: 'date', nullable: true })
  disbursedOn!: string | null;

  @Column({ name: 'maturity_on', type: 'date', nullable: true })
  maturityOn!: string | null;

  @Column({ name: 'installments_total', type: 'int' })
  installmentsTotal!: number;

  @Column({ name: 'installments_paid', type: 'int', default: 0 })
  installmentsPaid!: number;

  @Column({
    name: 'total_repayable_usd',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  totalRepayableUsd!: string;

  @Column({
    name: 'amount_repaid_usd',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  amountRepaidUsd!: string;

  @Column({
    name: 'outstanding_usd',
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  outstandingUsd!: string;

  /** Days past due on the oldest unpaid installment; drives portfolio-at-risk. */
  @Column({ name: 'days_past_due', type: 'int', default: 0 })
  daysPastDue!: number;

  @Index()
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: LoanStatus;

  @OneToMany(() => LoanRepayment, (repayment) => repayment.loan)
  repayments?: LoanRepayment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
