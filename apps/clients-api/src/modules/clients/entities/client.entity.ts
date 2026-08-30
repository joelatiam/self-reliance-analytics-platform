import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  ClientStatus,
  DisplacementStatus,
  EducationLevel,
  Gender,
  ProgramTrack,
} from '../clients.constants';
import { Business } from './business.entity';
import { Loan } from './loan.entity';
import { AdvisorySession } from './advisory-session.entity';

/** An entrepreneur enrolled in the program. */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'client_code', type: 'varchar', length: 32 })
  clientCode!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 80 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 80 })
  lastName!: string;

  @Column({ name: 'gender', type: 'varchar', length: 16 })
  gender!: Gender;

  @Column({ name: 'birth_year', type: 'int' })
  birthYear!: number;

  /** Youth (18-35) participation is a headline program metric. */
  @Column({ name: 'is_youth', type: 'boolean', default: false })
  isYouth!: boolean;

  @Index()
  @Column({ name: 'country_iso3', type: 'varchar', length: 3 })
  countryIso3!: string;

  @Column({ name: 'country_iso2', type: 'varchar', length: 2 })
  countryIso2!: string;

  @Column({ name: 'location_name', type: 'varchar', length: 120 })
  locationName!: string;

  @Column({ name: 'region', type: 'varchar', length: 120 })
  region!: string;

  /** True when the client lives in a camp or formal settlement. */
  @Column({ name: 'in_camp', type: 'boolean', default: false })
  inCamp!: boolean;

  @Index()
  @Column({ name: 'displacement_status', type: 'varchar', length: 32 })
  displacementStatus!: DisplacementStatus;

  /** Null for host-community clients, who have not been displaced. */
  @Column({
    name: 'origin_country_iso3',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  originCountryIso3!: string | null;

  /** Year the client arrived in the host country; null for host community. */
  @Column({ name: 'arrival_year', type: 'int', nullable: true })
  arrivalYear!: number | null;

  @Column({ name: 'household_size', type: 'int' })
  householdSize!: number;

  @Column({ name: 'dependents', type: 'int' })
  dependents!: number;

  @Column({ name: 'education_level', type: 'varchar', length: 32 })
  educationLevel!: EducationLevel;

  @Column({ name: 'primary_language', type: 'varchar', length: 60 })
  primaryLanguage!: string;

  /** Masked so the simulator never emits anything resembling a real number. */
  @Column({ name: 'phone_masked', type: 'varchar', length: 32 })
  phoneMasked!: string;

  @Column({ name: 'program_track', type: 'varchar', length: 32 })
  programTrack!: ProgramTrack;

  /** Enrolment cohort, e.g. 2026-Q1. */
  @Column({ name: 'cohort', type: 'varchar', length: 16 })
  cohort!: string;

  @Column({ name: 'enrolled_on', type: 'date' })
  enrolledOn!: string;

  @Column({ name: 'advisor_code', type: 'varchar', length: 32 })
  advisorCode!: string;

  @Index()
  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: ClientStatus;

  @OneToMany(() => Business, (business) => business.client)
  businesses?: Business[];

  @OneToMany(() => Loan, (loan) => loan.client)
  loans?: Loan[];

  @OneToMany(() => AdvisorySession, (session) => session.client)
  advisorySessions?: AdvisorySession[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Watermark column the pipeline polls with ?updatedSince=. */
  @Index()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
