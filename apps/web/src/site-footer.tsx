import { Link } from 'react-router-dom';
import { Icon } from './icons';

export type FooterAudience = 'checking' | 'guest' | 'student' | 'staff';

type FooterProps = {
  audience: FooterAudience;
  canReview?: boolean;
};

export function SiteFooter({ audience, canReview = false }: FooterProps) {
  return <footer className="site-foot site-foot--refined" aria-label="CPSU Market footer">
    <div className="wrap footer-main">
      <div className="footer-about">
        <Link className="footer-identity" to="/" aria-label="CPSU Student Marketplace home">
          <span className="footer-symbol" aria-hidden="true"><Icon name="store" size={20} /></span>
          <span>CPSU Student Marketplace</span>
        </Link>
        <p>A campus marketplace for students to buy, sell and offer services to one another.</p>
        <p className="footer-safety"><Icon name="shield" size={16} /> Listings are reviewed. Students arrange payment and handoff directly.</p>
      </div>

      <nav className="footer-links footer-links--browse" aria-label="Explore the marketplace">
        <h2>Explore</h2>
        <Link to="/explore">All listings</Link>
        <Link to="/explore?type=physical_product">Products</Link>
        <Link to="/explore?type=service">Student services</Link>
      </nav>

      <nav className="footer-links footer-links--account" aria-label="Account shortcuts">
        <h2>{audience === 'staff' ? 'Workspace' : 'Account'}</h2>
        {audience === 'guest' && <>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Create account</Link>
        </>}
        {audience === 'student' && <>
          <Link to="/dashboard">My listings</Link>
          <Link to="/saved">Saved items</Link>
          <Link to="/transactions">Transactions</Link>
          <Link to="/notifications">Notifications</Link>
        </>}
        {audience === 'staff' && <>
          {canReview && <Link to="/admin">Review workspace</Link>}
          <Link to="/notifications">Notifications</Link>
          <Link to="/profile">My profile</Link>
        </>}
        {audience === 'checking' && <span className="footer-session-pending" aria-live="polite">Checking session…</span>}
      </nav>

      <nav className="footer-links footer-links--help" aria-label="Marketplace help">
        <h2>Help & safety</h2>
        <Link to="/guidelines">Marketplace guidelines</Link>
        <p>Signed-in students can report a listing from its detail page.</p>
      </nav>
    </div>

    <nav className="wrap footer-mobile-links" aria-label="Footer quick links">
      <Link to="/guidelines">Guidelines</Link>
      {audience === 'guest' && <>
        <Link to="/login">Sign in</Link>
        <Link to="/register">Create account</Link>
      </>}
      {audience === 'student' && <>
        <Link to="/saved">Saved items</Link>
        <Link to="/transactions">Transactions</Link>
      </>}
      {audience === 'staff' && <>
        {canReview && <Link to="/admin">Review workspace</Link>}
        <Link to="/notifications">Notifications</Link>
      </>}
    </nav>

    <div className="wrap footer-base">
      <span>© {new Date().getFullYear()} CPSU Student Marketplace</span>
      <span>Student-built marketplace · Central Philippines State University</span>
    </div>
  </footer>;
}
