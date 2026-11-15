import { repo } from './content';

// The few links every reading page needs, the current section marked.
export default function SiteNav({ current }: { current: 'docs' | 'examples' }) {
  return (
    <nav className="d-nav" aria-label="Main navigation">
      <a className="d-brand" href="/">
        audio-bands
      </a>
      <a href="/docs/" aria-current={current === 'docs' ? 'page' : undefined}>
        Docs
      </a>
      <a href="/examples/" aria-current={current === 'examples' ? 'page' : undefined}>
        Examples
      </a>
      <a href={repo}>GitHub ↗</a>
    </nav>
  );
}
