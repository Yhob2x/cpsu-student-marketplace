/** Presentation only. Verification decisions remain reviewer-controlled on the API. */
export type CampusReviewState = 'verified' | 'pending' | 'rejected' | 'missing' | 'unknown';
export type AffiliationView = { status: string };

export type CampusStatusSummary = {
  state: CampusReviewState;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

export function campusStatusSummary(affiliations: readonly AffiliationView[], hasStore: boolean): CampusStatusSummary {
  if (affiliations.some(a => a.status === 'verified')) {
    return {
      state: 'verified',
      title: 'Campus verified',
      description: hasStore
        ? 'Your campus affiliation is verified. You can manage your store and listings.'
        : 'Your campus affiliation is verified. You can now open a student store.',
      actionLabel: hasStore ? 'Manage listings' : 'Open your store',
      actionHref: '/dashboard',
    };
  }
  if (affiliations.some(a => a.status === 'pending')) {
    return {
      state: 'pending',
      title: 'Awaiting campus review',
      description: 'A campus reviewer must verify your affiliation before you can sell. You can still browse and message sellers.',
      actionLabel: 'Check verification updates',
      actionHref: '/notifications',
    };
  }
  if (affiliations.some(a => a.status === 'rejected')) {
    return {
      state: 'rejected',
      title: 'Affiliation not approved',
      description: 'Check Notifications for the review decision and any recorded reason. If you need to correct your details, contact your campus reviewer through official CPSU channels.',
      actionLabel: 'Review verification update',
      actionHref: '/notifications',
    };
  }
  if (affiliations.length > 0) return {
    state: 'unknown',
    title: 'Campus review status unavailable',
    description: 'Your campus affiliation is on record, but its review status cannot be displayed. Check Notifications or contact your campus reviewer through official CPSU channels.',
    actionLabel: 'Check account updates',
    actionHref: '/notifications',
  };
  return {
    state: 'missing',
    title: 'No campus affiliation on record',
    description: 'Selling requires a verified CPSU affiliation. Contact your campus reviewer through official CPSU channels to check your registration details.',
    actionLabel: 'Read marketplace guidelines',
    actionHref: '/guidelines',
  };
}

export function affiliationLabel(status: string): string {
  if (status === 'verified') return 'Verified';
  if (status === 'pending') return 'Pending review';
  if (status === 'rejected') return 'Not approved';
  return 'Review status unavailable';
}

export function displayNameChange(value: string, savedName: string) {
  const trimmed = value.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 80;
  const changed = trimmed !== savedName.trim();
  return { trimmed, valid, changed, canSave: valid && changed };
}
