import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Admin } from '@/pages/admin';
import { Login } from '@/pages/auth/login';
import { Dashboard } from '@/pages/dashboard';
import { Discover } from '@/pages/explore';
import { Guidelines } from '@/pages/guidelines';
import { Home } from '@/pages/home';
import { Inquiries } from '@/pages/inquiries';
import { Thread } from '@/pages/inquiries/show';
import { ListingDetail } from '@/pages/listings/show';
import { NotFound } from '@/pages/not-found';
import { Notifications } from '@/pages/notifications';
import { Profile } from '@/pages/profile';
import { Saved } from '@/pages/saved';
import { StoreInsights } from '@/pages/seller/insights';
import { StorePage } from '@/pages/stores/show';
import { Transactions } from '@/pages/transactions';
import { TransactionDetail } from '@/pages/transactions/show';
import { useMe } from '@/providers/session-provider';

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
  return (
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
  );
}
