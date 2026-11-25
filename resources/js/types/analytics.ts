import type { TransactionStatus } from '@/lib/transactions/transaction-flow';

export type AnalyticsRangeKey = '7d' | '30d' | '90d' | '12m';

/** Admin analytics hide small student-activity counts as "<5". */
export type CountValue = number | '<5';

export type AnalyticsRange = { key: AnalyticsRangeKey; bucket: 'day' | 'week' | 'month'; timezone: string; start: string; end: string };

export type ActiveStatus = Extract<TransactionStatus, 'pending' | 'accepted' | 'negotiating' | 'for_meetup'>;

export type SellerSummary = {
  reportedSales: number; completedOrders: number; averageOrderValue: number | null; averageHoursToComplete: number | null;
  ordersCreated: number; cancelledOrders: number; cancellationRate: number | null; inquiries: number; views: number;
};

export type SellerTrendBucket = { key: string; label: string; ordersCreated: number; ordersCompleted: number; reportedSales: number; inquiries: number; views: number };

export type SellerOrderAction = 'decide' | 'confirm_meetup' | 'confirm_completion';

export type SellerActionItem = {
  id: number; listingId: number; listingTitle: string; buyerName: string; status: ActiveStatus;
  price: number; action: SellerOrderAction; createdAt: string; updatedAt: string;
};

export type SellerListingPerformance = {
  id: number; title: string; type: 'physical_product' | 'service'; status: string; availabilityState: string;
  price: number; stock: number | null; lowStock: boolean; views: number; totalViews: number; inquiries: number;
  orders: number; completedOrders: number; reportedSales: number; saves: number; likes: number;
};

export type SellerAnalytics = {
  range: AnalyticsRange; note: string;
  summary: { current: SellerSummary; previous: SellerSummary };
  trend: SellerTrendBucket[];
  pipeline: Record<ActiveStatus, number>;
  needsAction: SellerActionItem[];
  waitingOnBuyer: number;
  listings: SellerListingPerformance[];
  lowStock: SellerListingPerformance[];
  rating: { average: number | null; count: number; distribution: Record<'1' | '2' | '3' | '4' | '5', number> };
  viewsTrackedSince: string | null;
};

export type MarketplaceSummary = {
  ordersCreated: CountValue; completedOrders: CountValue; cancelledOrders: CountValue; cancellationRate: number | null;
  reportedSales: number | null; averageOrderValue: number | null; averageHoursToComplete: number | null;
  listingsApproved: CountValue; studentsVerified: CountValue; inquiries: CountValue;
};

export type MarketplaceTrendBucket = { key: string; label: string; ordersCreated: CountValue; ordersCompleted: CountValue; listingsApproved: CountValue };

export type MarketplaceAnalytics = {
  range: AnalyticsRange; note: string; privacyNote: string;
  summary: { current: MarketplaceSummary; previous: MarketplaceSummary };
  trend: MarketplaceTrendBucket[];
  pipeline: Record<ActiveStatus, CountValue>;
  workload: { pendingListings: number; oldestPendingListingHours: number | null; pendingAffiliations: number; openReports: number; pendingStoreReviews: number };
  categories: { id: number; name: string; completedOrders: CountValue; publishedListings: CountValue; reportedSales: number | null }[];
  campuses: { campus: string; name: string; activeStorefronts: CountValue; publishedListings: CountValue; ordersCreated: CountValue; completedOrders: CountValue; reportedSales: number | null }[];
};
