/** Envelope every list endpoint returns, so the pipeline can page predictably. */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    /** Highest updated_at in this page; the pipeline stores it as its watermark. */
    maxUpdatedAt: string | null;
  };
}

/** Portfolio rollup mirroring the impact numbers these programs report publicly. */
export interface PortfolioSummary {
  countryIso3: string | null;
  clients: {
    total: number;
    active: number;
    displaced: number;
    women: number;
    youth: number;
    hostCommunity: number;
  };
  businesses: {
    total: number;
    active: number;
    jobsSupported: number;
    jobsHeldByDisplaced: number;
    averageRevenueGrowthPct: number;
  };
  loans: {
    total: number;
    disbursedUsd: number;
    outstandingUsd: number;
    repaidUsd: number;
    onTimeRepaymentRatePct: number;
    portfolioAtRiskPct: number;
    averageLoanSizeUsd: number;
  };
  advisory: {
    sessions: number;
    attendanceRatePct: number;
    averageSatisfaction: number;
  };
}
