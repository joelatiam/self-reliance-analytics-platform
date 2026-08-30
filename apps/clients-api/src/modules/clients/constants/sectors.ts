import { LoanPurpose } from '../clients.constants';

export interface BusinessSectorDefinition {
  name: string;
  subSectors: string[];
  /** Typical loan sizes in USD for this sector, before loan-cycle scaling. */
  loanRangeUsd: { min: number; max: number };
  /** Typical monthly revenue in USD for an established business. */
  monthlyRevenueUsd: { min: number; max: number };
  /** Net margin applied to revenue when deriving profit. */
  marginRange: { min: number; max: number };
  commonLoanPurposes: LoanPurpose[];
}

/**
 * Sectors observed across the program's caseload. Retail and agriculture dominate
 * camp economies; ICT and energy skew smaller and younger.
 */
const businessSectors: BusinessSectorDefinition[] = [
  {
    name: 'Retail & Trade',
    subSectors: [
      'General shop',
      'Kiosk',
      'Second-hand clothing',
      'Wholesale distribution',
      'Cosmetics stall',
    ],
    loanRangeUsd: { min: 200, max: 3500 },
    monthlyRevenueUsd: { min: 180, max: 2600 },
    marginRange: { min: 0.1, max: 0.25 },
    commonLoanPurposes: [LoanPurpose.INVENTORY, LoanPurpose.WORKING_CAPITAL],
  },
  {
    name: 'Agriculture',
    subSectors: [
      'Vegetable farming',
      'Maize & sorghum',
      'Horticulture',
      'Seed & input supply',
      'Agro-processing',
    ],
    loanRangeUsd: { min: 150, max: 2800 },
    monthlyRevenueUsd: { min: 120, max: 1800 },
    marginRange: { min: 0.12, max: 0.3 },
    commonLoanPurposes: [LoanPurpose.INPUTS, LoanPurpose.EQUIPMENT],
  },
  {
    name: 'Livestock',
    subSectors: ['Goat rearing', 'Poultry', 'Dairy', 'Animal feed', 'Butchery'],
    loanRangeUsd: { min: 200, max: 3000 },
    monthlyRevenueUsd: { min: 150, max: 2000 },
    marginRange: { min: 0.15, max: 0.32 },
    commonLoanPurposes: [LoanPurpose.INPUTS, LoanPurpose.EXPANSION],
  },
  {
    name: 'Food & Beverage',
    subSectors: [
      'Restaurant',
      'Tea shop',
      'Bakery',
      'Milling',
      'Juice & water vending',
    ],
    loanRangeUsd: { min: 150, max: 2500 },
    monthlyRevenueUsd: { min: 130, max: 1900 },
    marginRange: { min: 0.14, max: 0.3 },
    commonLoanPurposes: [LoanPurpose.EQUIPMENT, LoanPurpose.WORKING_CAPITAL],
  },
  {
    name: 'Tailoring & Textiles',
    subSectors: ['Tailoring', 'Fabric retail', 'Embroidery', 'Uniform supply'],
    loanRangeUsd: { min: 150, max: 2000 },
    monthlyRevenueUsd: { min: 100, max: 1400 },
    marginRange: { min: 0.18, max: 0.35 },
    commonLoanPurposes: [LoanPurpose.EQUIPMENT, LoanPurpose.INVENTORY],
  },
  {
    name: 'Construction & Materials',
    subSectors: [
      'Hardware shop',
      'Brick making',
      'Carpentry',
      'Metal fabrication',
    ],
    loanRangeUsd: { min: 400, max: 6000 },
    monthlyRevenueUsd: { min: 250, max: 3500 },
    marginRange: { min: 0.12, max: 0.26 },
    commonLoanPurposes: [LoanPurpose.EQUIPMENT, LoanPurpose.EXPANSION],
  },
  {
    name: 'Transport & Logistics',
    subSectors: [
      'Motorcycle taxi',
      'Tuk-tuk',
      'Cargo transport',
      'Bicycle repair',
    ],
    loanRangeUsd: { min: 300, max: 4000 },
    monthlyRevenueUsd: { min: 180, max: 1600 },
    marginRange: { min: 0.2, max: 0.4 },
    commonLoanPurposes: [LoanPurpose.EQUIPMENT, LoanPurpose.WORKING_CAPITAL],
  },
  {
    name: 'Personal Care',
    subSectors: ['Hair salon', 'Barbershop', 'Beauty products', 'Laundry'],
    loanRangeUsd: { min: 120, max: 1500 },
    monthlyRevenueUsd: { min: 90, max: 1100 },
    marginRange: { min: 0.22, max: 0.42 },
    commonLoanPurposes: [LoanPurpose.EQUIPMENT, LoanPurpose.PREMISES],
  },
  {
    name: 'ICT & Mobile Money',
    subSectors: [
      'Mobile money agency',
      'Phone repair',
      'Airtime & data retail',
      'Internet cafe',
      'Printing & photocopy',
    ],
    loanRangeUsd: { min: 200, max: 2500 },
    monthlyRevenueUsd: { min: 150, max: 1800 },
    marginRange: { min: 0.1, max: 0.28 },
    commonLoanPurposes: [LoanPurpose.WORKING_CAPITAL, LoanPurpose.EQUIPMENT],
  },
  {
    name: 'Energy',
    subSectors: [
      'Solar kits retail',
      'Cookstoves',
      'Charging kiosk',
      'Briquettes',
    ],
    loanRangeUsd: { min: 250, max: 3000 },
    monthlyRevenueUsd: { min: 140, max: 1500 },
    marginRange: { min: 0.16, max: 0.34 },
    commonLoanPurposes: [LoanPurpose.INVENTORY, LoanPurpose.EXPANSION],
  },
  {
    name: 'Handicrafts',
    subSectors: ['Basket weaving', 'Beadwork', 'Pottery', 'Leatherwork'],
    loanRangeUsd: { min: 100, max: 1200 },
    monthlyRevenueUsd: { min: 70, max: 900 },
    marginRange: { min: 0.25, max: 0.45 },
    commonLoanPurposes: [LoanPurpose.INPUTS, LoanPurpose.WORKING_CAPITAL],
  },
  {
    name: 'Education & Childcare',
    subSectors: ['Nursery school', 'Tutoring centre', 'Stationery shop'],
    loanRangeUsd: { min: 200, max: 2200 },
    monthlyRevenueUsd: { min: 120, max: 1300 },
    marginRange: { min: 0.15, max: 0.33 },
    commonLoanPurposes: [LoanPurpose.PREMISES, LoanPurpose.EQUIPMENT],
  },
  {
    name: 'Health & Pharmacy',
    subSectors: ['Pharmacy', 'Clinic supplies', 'Hygiene products'],
    loanRangeUsd: { min: 350, max: 4500 },
    monthlyRevenueUsd: { min: 250, max: 2800 },
    marginRange: { min: 0.14, max: 0.3 },
    commonLoanPurposes: [LoanPurpose.INVENTORY, LoanPurpose.EXPANSION],
  },
  {
    name: 'Waste & Recycling',
    subSectors: ['Plastic collection', 'Scrap metal', 'Compost production'],
    loanRangeUsd: { min: 150, max: 1800 },
    monthlyRevenueUsd: { min: 90, max: 1000 },
    marginRange: { min: 0.18, max: 0.36 },
    commonLoanPurposes: [LoanPurpose.EQUIPMENT, LoanPurpose.WORKING_CAPITAL],
  },
];

export default businessSectors;

export const BUSINESS_SECTOR_NAMES = businessSectors.map(
  (sector) => sector.name,
);

export function findSector(name: string): BusinessSectorDefinition | undefined {
  return businessSectors.find(
    (sector) => sector.name.toLowerCase() === name.trim().toLowerCase(),
  );
}

/** Word pairs used to name a business, e.g. "Amani Fresh Produce". */
export const BUSINESS_NAME_QUALIFIERS = [
  'Amani',
  'Baraka',
  'Tumaini',
  'Imani',
  'Jamii',
  'Neema',
  'Furaha',
  'Rahma',
  'Salam',
  'Nuru',
  'Ubuntu',
  'Sahara',
  'Nile',
  'Horizon',
  'Unity',
  'Bright',
  'New Hope',
  'Twiceyimana',
  'Hodari',
  'Sabaa',
];

export const BUSINESS_NAME_SUFFIXES = [
  'Enterprises',
  'Trading',
  'Ventures',
  'Supplies',
  'Traders',
  'Shop',
  'Services',
  'Cooperative',
  'Group',
  'Company',
];
