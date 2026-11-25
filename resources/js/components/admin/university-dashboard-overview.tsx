import { useState } from 'react';

import { DashboardPage } from '@/components/admin/university-dashboard';
import { useAnalytics } from '@/hooks/use-analytics';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import type { AnalyticsRangeKey } from '@/types/analytics';
import type { UniversityDashboardData } from '@/types/university-dashboard';

export function UniversityDashboardOverview({ onOpenSection }: { onOpenSection: (section: string) => void }) {
  const [period, setPeriod] = useState<AnalyticsRangeKey>('30d');
  const { data, loading, error, retry } = useAnalytics<UniversityDashboardData>('/admin/dashboard', period, true, {
    queryKey: 'period',
    unversioned: true,
  });
  useForegroundRefresh(() => { if (!loading) return retry(); }, 60_000);

  return <DashboardPage data={data} period={period} loading={loading} error={error}
    onPeriodChange={setPeriod} onRetry={() => void retry()} onOpenSection={onOpenSection} />;
}
