import { useEffect, useState } from 'react';
import { sections } from './content';
import { Prose } from './Prose';
import SiteNav from '../SiteNav';

// The section being read: the last one whose top has passed the upper third of
// the viewport. At the very bottom the last section wins, however short it is.
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const update = () => {
      const line = innerHeight / 3;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = ids[ids.length - 1];
      setActive(current);
    };
    // Recompute only when a section crosses the viewport, not on every scroll event.
    const observer = new IntersectionObserver(update, { rootMargin: '0px 0px -66% 0px', threshold: [0, 1] });
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    const bottom = () => {
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) update();
    };
    addEventListener('scroll', bottom, { passive: true });
    update();
    return () => {
      observer.disconnect();
      removeEventListener('scroll', bottom);
    };
  }, [ids]);
  return [active, setActive] as const;
}

const ids = sections.map((s) => s.id);

// The docs page: the site's type and colour, none of the device.
export default function Docs() {
  const [active, setActive] = useActiveSection(ids);
  return (
    <div className="d-page">
      <header className="d-head">
        <SiteNav current="docs" />
        <h1>Documentation</h1>
        <p className="d-lede">Load a track or open the microphone, read bass, mid and high, and move anything you build.</p>
      </header>
      <div className="d-body">
        <nav className="d-index" aria-label="Sections">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active === s.id ? 'location' : undefined}
              onClick={() => setActive(s.id)}
            >
              <span className="d-num">{s.n}</span>
              {s.title}
            </a>
          ))}
          <a href="/docs.md" className="d-md">
            Read as Markdown
          </a>
        </nav>
        <main id="main" className="d-article">
          <Prose />
        </main>
      </div>
    </div>
  );
}
