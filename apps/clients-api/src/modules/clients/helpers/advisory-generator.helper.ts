import { AdvisorySessionType, ENTITY_CODE_PREFIX } from '../clients.constants';
import { ProgramCountry } from '../constants/countries';
import { ADVISORY_TOPICS } from '../constants/names';
import { AdvisorySession } from '../entities/advisory-session.entity';
import { Client } from '../entities/client.entity';
import { buildEntityCode } from './simulation-format.helper';
import {
  chance,
  pickOne,
  pickWeighted,
  randomInt,
} from './simulation-random.helper';

export interface GenerateAdvisorySessionOptions {
  client: Pick<
    Client,
    'clientCode' | 'countryIso3' | 'advisorCode' | 'primaryLanguage'
  >;
  country: ProgramCountry;
  sequence: number;
  businessCode?: string | null;
  deliveredAt?: Date;
}

/** Attendance is high but not perfect; travel and market days get in the way. */
const ATTENDANCE_RATE = 0.89;

export function generateAdvisorySession(
  options: GenerateAdvisorySessionOptions,
): Partial<AdvisorySession> {
  const { client, country, sequence } = options;
  const attended = chance(ATTENDANCE_RATE);

  return {
    sessionCode: buildEntityCode(
      ENTITY_CODE_PREFIX.ADVISORY,
      country.isoAlpha3,
      sequence,
    ),
    clientCode: client.clientCode,
    businessCode: options.businessCode ?? null,
    countryIso3: client.countryIso3,
    advisorCode: client.advisorCode,
    sessionType: pickWeighted([
      AdvisorySessionType.GROUP_TRAINING,
      AdvisorySessionType.ONE_ON_ONE_COACHING,
      AdvisorySessionType.BOOKKEEPING,
      AdvisorySessionType.FINANCIAL_LITERACY,
      AdvisorySessionType.LOAN_READINESS,
      AdvisorySessionType.MARKET_LINKAGE,
    ]),
    topic: pickOne(ADVISORY_TOPICS),
    // Sessions are run in the client's own language, not a program lingua franca.
    language: client.primaryLanguage,
    deliveredAt: options.deliveredAt ?? new Date(),
    durationMinutes: pickWeighted([60, 90, 45, 120, 30]),
    attended,
    satisfactionScore: attended ? randomInt(3, 5) : null,
  };
}
