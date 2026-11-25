import type { AnalyticsRangeKey, CountValue } from '@/types/analytics';

type PeriodMetric = 'newOrders' | 'completedOrders' | 'inquiries' | 'listingsApproved' | 'studentsVerified';

export type UniversityDashboardData = {
  period: AnalyticsRangeKey;
  previousPeriodLabel: string;
  generatedAt: string;
  reviewQueue: {
    listings: CountValue;
    verifications: CountValue;
  };
  kpis: Record<PeriodMetric | 'liveListings', CountValue> & {
    changes: Record<PeriodMetric, number | null>;
  };
  funnel: {
    liveListings: CountValue;
    inquiries: CountValue;
    orders: CountValue;
    completed: CountValue;
  };
  ordersInProgress: {
    awaitingSeller: CountValue;
    accepted: CountValue;
    arrangingMeetup: CountValue;
    meetupAgreed: CountValue;
  };
  series: {
    granularity: 'day' | 'week' | 'month';
    points: { label: string; completed: CountValue }[];
  };
  quality: {
    reportedSales: number;
    cancellationRatePct: number | null;
    avgDaysToComplete: number | null;
  } | null;
  categories: { name: string; liveListings: CountValue }[];
  campuses: {
    name: string;
    storefronts: CountValue;
    liveListings: CountValue;
    newOrders: CountValue;
    completed: CountValue;
    reportedSales: number | null;
  }[];
  inactiveCampusCount: CountValue;
};
