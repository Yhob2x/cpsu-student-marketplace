import { Link } from 'react-router-dom';

export function NotFound() {
  return <section className="not-found-page">
    <h1>Page not found</h1>
    <p>The address may have changed, or the page may no longer be available.</p>
    <div className="row"><Link className="btn" to="/">Go home</Link><Link className="btn ghost" to="/explore">Explore listings</Link></div>
  </section>;
}
