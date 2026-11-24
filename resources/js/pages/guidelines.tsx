import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { api, explain } from '@/lib/api';
import { parseGuidelineSections } from '@/lib/content/guidelines';

export function Guidelines() {
  const [content, setContent] = useState<{ body: string; publishedAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    setError('');
    return api<{ body: string; publishedAt: string | null }>('/guidelines')
      .then(result => setContent(result))
      .catch(e => setError(explain(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { void load(); }, []);
  const sections = content ? parseGuidelineSections(content.body) : [];

  return <div className="guidelines-page">
    <nav className="guidelines-breadcrumb" aria-label="Breadcrumb">
      <Link to="/">Home</Link><Icon name="chevronRight" size={15} /><span aria-current="page">Guidelines</span>
    </nav>

    <header className="guidelines-hero">
      <span className="guidelines-eyebrow"><Icon name="book" size={16} /> CPSU Market guide</span>
      <h1>Marketplace guidelines</h1>
      <p className="guidelines-intro">A simple guide to buying, selling, and connecting respectfully within the CPSU community.</p>
      {content && <p className="guidelines-version"><Icon name="shield" size={16} />
        {content.publishedAt
          ? <>Published <time dateTime={content.publishedAt}>{new Date(content.publishedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</time></>
          : 'Pre-launch guidance · Final rules are set by CPSU before launch'}
      </p>}
    </header>

    {loading && !content && <div className="guidelines-state" role="status" aria-live="polite">
      <span className="guidelines-loading-icon" aria-hidden="true"><Icon name="book" size={22} /></span>
      <div><strong>Loading guidelines</strong><p>Getting the community guide ready.</p></div>
    </div>}

    {error && <div className="guidelines-state guidelines-state-error" role="alert">
      <span className="guidelines-state-icon" aria-hidden="true"><Icon name="refresh" size={22} /></span>
      <div><strong>Guidelines couldn't be loaded</strong><p>{error}</p>
        <LegacyButton className="ghost" type="button" onClick={() => void load()} disabled={loading}>
          <Icon name="refresh" size={17} /> {loading ? 'Trying again…' : 'Try again'}
        </LegacyButton>
      </div>
    </div>}

    {content && <div className="guidelines-layout">
      {sections.length > 1 && <nav className="guidelines-toc" aria-label="Guidelines sections">
        <h2>On this page</h2>
        <ol>{sections.map((section, index) => <li key={section.id}>
          <a href={`#${section.id}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.title}</a>
        </li>)}</ol>
      </nav>}
      <article className="guidelines-article" aria-label="Community guidelines">
        {sections.map((section, index) => <section className="guidelines-section" id={section.id} key={section.id}
          aria-labelledby={`${section.id}-title`}>
          <span className="guidelines-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div className="guidelines-section-body">
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          </div>
        </section>)}
      </article>
    </div>}
  </div>;
}
