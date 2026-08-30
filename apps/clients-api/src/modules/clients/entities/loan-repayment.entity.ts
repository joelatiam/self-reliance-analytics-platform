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

import { RepaymentMethod } from '../clients.constants';
import { Loan } from './loan.entity';

/** One installment payment against a loan. */
@Entity('loan_repayments')
export class LoanRepayment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'repayment_code', type: 'varchar', length: 32 })
  repaymentCode!: string;

  @Index()
  @Column({ name: 'loan_code', type: 'varchar', length: 32 })
  loanCode!: string;

  @ManyToOne(() => Loan, (loan) => loan.repayments)
  @JoinColumn({ name: 'loan_code', referencedColumnName: 'loanCode' })
  loan?: Loan;

  @Index()
  @Column({ name: 'client_code', type: 'varchar', length: 32 })
  clientCode!: string;

  @Column({ name: 'country_iso3', type: 'varchar', length: 3 })
  countryIso3!: string;

  @Column({ name: 'installment_number', type: 'int' })
  installmentNumber!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'amount_local', type: 'numeric', precision: 18, scale: 2 })
  amountLocal!: string;

  @Column({ name: 'amount_usd', type: 'numeric', precision: 18, scale: 2 })
  amountUsd!: string;

  @Column({ name: 'due_on', type: 'date' })
  dueOn!: string;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt!: Date;

  /** Zero when paid on or before the due date. */
  @Column({ name: 'days_late', type: 'int', default: 0 })
  daysLate!: number;

  @Column({ name: 'on_time', type: 'boolean', default: true })
  onTime!: boolean;

  @Column({ name: 'method', type: 'varchar', length: 32 })
  method!: RepaymentMethod;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
