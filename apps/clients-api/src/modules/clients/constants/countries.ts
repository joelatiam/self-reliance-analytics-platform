import { DisplacementStatus } from '../clients.constants';

export interface ProgramLocation {
  /** Camp, settlement or urban hub where the program runs operations. */
  name: string;
  /** Administrative region the location sits in. */
  region: string;
  /** Camps are closed settlements; urban hubs mix displaced and host traders. */
  isCamp: boolean;
}

export interface ProgramCountry {
  isoAlpha2: string;
  isoAlpha3: string;
  countryName: string;
  currency: string;
  /** Indicative local-currency units per USD; used to price loans locally. */
  fxRatePerUsd: number;
  /** E.164 country calling code, without the leading '+'. */
  phonePrefix: string;
  locations: ProgramLocation[];
  /** ISO3 codes of the main origin countries of the displaced population hosted here. */
  originCountries: string[];
  languages: string[];
  /** Displacement mix seen in the caseload, ordered by prevalence. */
  displacementMix: DisplacementStatus[];
}

/** The program's five countries of operation (mirrors UNHCR_COUNTRIES in the pipeline). */
const programCountries: ProgramCountry[] = [
  {
    isoAlpha2: 'RW',
    isoAlpha3: 'RWA',
    countryName: 'Rwanda',
    currency: 'RWF',
    fxRatePerUsd: 1355,
    phonePrefix: '250',
    locations: [
      { name: 'Mahama Camp', region: 'Kirehe', isCamp: true },
      { name: 'Kigeme Camp', region: 'Nyamagabe', isCamp: true },
      { name: 'Kiziba Camp', region: 'Karongi', isCamp: true },
      { name: 'Nyabiheke Camp', region: 'Gatsibo', isCamp: true },
      { name: 'Mugombwa Camp', region: 'Gisagara', isCamp: true },
      { name: 'Kigali', region: 'Kigali City', isCamp: false },
      { name: 'Huye', region: 'Southern Province', isCamp: false },
    ],
    originCountries: ['BDI', 'COD'],
    languages: ['Kinyarwanda', 'Kirundi', 'Swahili', 'French', 'English'],
    displacementMix: [
      DisplacementStatus.REFUGEE,
      DisplacementStatus.HOST_COMMUNITY,
      DisplacementStatus.ASYLUM_SEEKER,
      DisplacementStatus.RETURNED_REFUGEE,
    ],
  },
  {
    isoAlpha2: 'KE',
    isoAlpha3: 'KEN',
    countryName: 'Kenya',
    currency: 'KES',
    fxRatePerUsd: 129,
    phonePrefix: '254',
    locations: [
      { name: 'Kakuma Camp', region: 'Turkana', isCamp: true },
      { name: 'Kalobeyei Settlement', region: 'Turkana', isCamp: true },
      { name: 'Dagahaley Camp', region: 'Garissa', isCamp: true },
      { name: 'Ifo Camp', region: 'Garissa', isCamp: true },
      { name: 'Hagadera Camp', region: 'Garissa', isCamp: true },
      { name: 'Eastleigh, Nairobi', region: 'Nairobi', isCamp: false },
      { name: 'Lodwar', region: 'Turkana', isCamp: false },
    ],
    originCountries: ['SOM', 'SSD', 'COD', 'ETH', 'BDI'],
    languages: ['Swahili', 'Somali', 'English', 'Turkana', 'Arabic'],
    displacementMix: [
      DisplacementStatus.REFUGEE,
      DisplacementStatus.HOST_COMMUNITY,
      DisplacementStatus.ASYLUM_SEEKER,
      DisplacementStatus.STATELESS,
    ],
  },
  {
    isoAlpha2: 'ET',
    isoAlpha3: 'ETH',
    countryName: 'Ethiopia',
    currency: 'ETB',
    fxRatePerUsd: 127,
    phonePrefix: '251',
    locations: [
      { name: 'Melkadida Camp', region: 'Somali Region', isCamp: true },
      { name: 'Bokolmayo Camp', region: 'Somali Region', isCamp: true },
      { name: 'Jewi Camp', region: 'Gambella', isCamp: true },
      { name: 'Kule Camp', region: 'Gambella', isCamp: true },
      { name: 'Sherkole Camp', region: 'Benishangul-Gumuz', isCamp: true },
      { name: 'Addis Ababa', region: 'Addis Ababa', isCamp: false },
      { name: 'Jijiga', region: 'Somali Region', isCamp: false },
    ],
    originCountries: ['SOM', 'SSD', 'ERI', 'SDN'],
    languages: ['Amharic', 'Somali', 'Oromo', 'Nuer', 'Arabic', 'English'],
    displacementMix: [
      DisplacementStatus.REFUGEE,
      DisplacementStatus.HOST_COMMUNITY,
      DisplacementStatus.IDP,
      DisplacementStatus.RETURNED_IDP,
    ],
  },
  {
    isoAlpha2: 'SS',
    isoAlpha3: 'SSD',
    countryName: 'South Sudan',
    currency: 'SSP',
    fxRatePerUsd: 4600,
    phonePrefix: '211',
    locations: [
      { name: 'Juba', region: 'Central Equatoria', isCamp: false },
      { name: 'Maban (Doro Camp)', region: 'Upper Nile', isCamp: true },
      { name: 'Bentiu IDP Camp', region: 'Unity', isCamp: true },
      { name: 'Malakal PoC', region: 'Upper Nile', isCamp: true },
      { name: 'Yei', region: 'Central Equatoria', isCamp: false },
      { name: 'Wau', region: 'Western Bahr el Ghazal', isCamp: false },
    ],
    originCountries: ['SDN', 'COD', 'ETH', 'CAF'],
    languages: ['Juba Arabic', 'English', 'Dinka', 'Nuer', 'Bari'],
    displacementMix: [
      DisplacementStatus.IDP,
      DisplacementStatus.RETURNED_REFUGEE,
      DisplacementStatus.HOST_COMMUNITY,
      DisplacementStatus.REFUGEE,
      DisplacementStatus.RETURNED_IDP,
    ],
  },
  {
    isoAlpha2: 'TD',
    isoAlpha3: 'TCD',
    countryName: 'Chad',
    currency: 'XAF',
    fxRatePerUsd: 605,
    phonePrefix: '235',
    locations: [
      { name: 'Farchana Camp', region: 'Ouaddaï', isCamp: true },
      { name: 'Adré Transit Site', region: 'Ouaddaï', isCamp: true },
      { name: 'Kounoungou Camp', region: 'Wadi Fira', isCamp: true },
      { name: 'Goz Beida (Djabal Camp)', region: 'Sila', isCamp: true },
      { name: 'Iriba', region: 'Wadi Fira', isCamp: false },
      { name: "N'Djamena", region: "N'Djamena", isCamp: false },
    ],
    originCountries: ['SDN', 'CAF', 'NGA', 'CMR'],
    languages: ['Chadian Arabic', 'French', 'Sudanese Arabic', 'Zaghawa'],
    displacementMix: [
      DisplacementStatus.REFUGEE,
      DisplacementStatus.HOST_COMMUNITY,
      DisplacementStatus.ASYLUM_SEEKER,
      DisplacementStatus.IDP,
    ],
  },
];

export default programCountries;

export const PROGRAM_COUNTRY_ISO3 = programCountries.map((c) => c.isoAlpha3);

export function findCountryByIso3(iso3: string): ProgramCountry | undefined {
  return programCountries.find(
    (country) => country.isoAlpha3 === iso3.toUpperCase(),
  );
}

export function findCountryByIso2(iso2: string): ProgramCountry | undefined {
  return programCountries.find(
    (country) => country.isoAlpha2 === iso2.toUpperCase(),
  );
}

/** Accepts either ISO2 or ISO3 so API callers can use whichever they have. */
export function resolveCountry(code: string): ProgramCountry | undefined {
  const value = code.trim().toUpperCase();
  return value.length === 2
    ? findCountryByIso2(value)
    : findCountryByIso3(value);
}
