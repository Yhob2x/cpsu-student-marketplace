import { type ComponentType, lazy, type ReactNode, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Home } from '@/pages/home';
import { NotFound } from '@/pages/not-found';
import { useMe } from '@/providers/session-provider';

/**
 * Every page except Home is its own chunk, so the first visit downloads less.
 * Chunks are prefetched while the browser is idle, so later navigation is instant.
 */
const pages = {
  Admin: () => import('@/pages/admin').then(m => ({ default: m.Admin })),
  Login: () => import('@/pages/auth/login').then(m => ({ default: m.Login })),
  Dashboard: () => import('@/pages/dashboard').then(m => ({ default: m.Dashboard })),
  Discover: () => import('@/pages/explore').then(m => ({ default: m.Discover })),
  Guidelines: () => import('@/pages/guidelines').then(m => ({ default: m.Guidelines })),
  Inquiries: () => import('@/pages/inquiries').then(m => ({ default: m.Inquiries })),
  Thread: () => import('@/pages/inquiries/show').then(m => ({ default: m.Thread })),
  ListingDetail: () => import('@/pages/listings/show').then(m => ({ default: m.ListingDetail })),
  Notifications: () => import('@/pages/notifications').then(m => ({ default: m.Notifications })),
  Profile: () => import('@/pages/profile').then(m => ({ default: m.Profile })),
  Saved: () => import('@/pages/saved').then(m => ({ default: m.Saved })),
  StoreInsights: () => import('@/pages/seller/insights').then(m => ({ default: m.StoreInsights })),
  StorePage: () => import('@/pages/stores/show').then(m => ({ default: m.StorePage })),
  Transactions: () => import('@/pages/transactions').then(m => ({ default: m.Transactions })),
  TransactionDetail: () => import('@/pages/transactions/show').then(m => ({ default: m.TransactionDetail })),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>;

const Admin = lazy(pages.Admin);
const Login = lazy(pages.Login);
const Dashboard = lazy(pages.Dashboard);
const Discover = lazy(pages.Discover);
const Guidelines = lazy(pages.Guidelines);
const Inquiries = lazy(pages.Inquiries);
const Thread = lazy(pages.Thread);
const ListingDetail = lazy(pages.ListingDetail);
const Notifications = lazy(pages.Notifications);
const Profile = lazy(pages.Profile);
const Saved = lazy(pages.Saved);
const StoreInsights = lazy(pages.StoreInsights);
const StorePage = lazy(pages.StorePage);
const Transactions = lazy(pages.Transactions);
const TransactionDetail = lazy(pages.TransactionDetail);

/** Loads the remaining page chunks after the first page has settled. */
function usePrefetchPages() {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => { for (const load of Object.values(pages)) void load().catch(() => {}); });
    return () => cancel(handle);
  }, []);
}

/** Shown only while a page chunk is still downloading, with the shape of a page so nothing jumps. */
function PageLoading() {
  return <div className="page-loading" role="status" aria-label="Loading page">
    <span className="page-loading__bar" /><span className="page-loading__line" /><span className="page-loading__line page-loading__line--short" />
  </div>;
}

/**
 * Student-only pages wait for the session check, send guests to sign in and
 * send staff accounts to their profile. `next` defaults to the current path.
 */
function RequireStudent({ next, children }: { next?: string; children: ReactNode }) {
  const { ready, signedOut, isStaff } = useMe();
  if (!ready) return <p role="status">Checking session…</p>;
  if (signedOut) return <Navigate to={`/login?next=${next ?? encodeURIComponent(window.location.pathname)}`} replace />;
  if (isStaff) return <Navigate to="/profile" replace />;
  return children;
}

/** Account pages any signed-in user may open. */
function RequireSignedIn({ next, children }: { next: string; children: ReactNode }) {
  const { signedOut } = useMe();
  return signedOut ? <Navigate to={`/login?next=${next}`} /> : children;
}

/** Review workspace for campus reviewers and university admins. */
function RequireReviewer({ children }: { children: ReactNode }) {
  const { ready, isReviewer } = useMe();
  return ready && !isReviewer ? <Navigate to="/" /> : children;
}

export function AppRoutes() {
  usePrefetchPages();
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Discover />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/store/:slug" element={<StorePage />} />
        <Route path="/stores/:id" element={<StorePage />} />
        <Route path="/stores" element={<Navigate to="/explore" replace />} />
        <Route path="/guidelines" element={<Guidelines />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/dashboard" element={<RequireStudent next="%2Fdashboard"><Dashboard /></RequireStudent>} />
        <Route path="/dashboard/insights" element={<RequireStudent next="%2Fdashboard%2Finsights"><StoreInsights /></RequireStudent>} />
        <Route path="/inquiries" element={<RequireStudent next="%2Finquiries"><Inquiries /></RequireStudent>} />
        <Route path="/inquiries/:id" element={<RequireStudent><Thread /></RequireStudent>} />
        <Route path="/saved" element={<RequireStudent next="%2Fsaved"><Saved /></RequireStudent>} />
        <Route path="/transactions" element={<RequireStudent next="%2Ftransactions"><Transactions /></RequireStudent>} />
        <Route path="/transactions/:id" element={<RequireStudent><TransactionDetail /></RequireStudent>} />
        <Route path="/profile" element={<RequireSignedIn next="%2Fprofile"><Profile /></RequireSignedIn>} />
        <Route path="/notifications" element={<RequireSignedIn next="%2Fnotifications"><Notifications /></RequireSignedIn>} />
        <Route path="/admin" element={<RequireReviewer><Admin /></RequireReviewer>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
