import { examples } from '../content';
import { tracks } from '../landing/deck';
import { Code } from '../docs/Prose';
import Stage from './Stage';
import SiteNav from '../SiteNav';

const href = (slug?: string) => (slug ? `/examples/${slug}/` : '/examples/');

function Credits() {
  return (
    <p className="x-credits">
      Music:{' '}
      {tracks.map((t, i) => (
        <span key={t.url}>
          <a href={t.page}>{t.name}</a> by {t.by}
          {i < tracks.length - 1 ? ' · ' : ''}
        </span>
      ))}
      . From ccMixter, under <a href={tracks[0].license}>CC BY 3.0</a>.
    </p>
  );
}

export function ExamplesIndex() {
  return (
    <div className="d-page x-page">
      <header className="d-head">
        <SiteNav current="examples" />
        <h1>Examples</h1>
        <p className="d-lede">Five working examples, each adding one idea. Start with one number and end with a Three.js sculpture.</p>
      </header>
      <main id="main">
      <ol className="x-list" aria-label="Examples">
        {examples.map((e) => (
          <li key={e.slug}>
            <a href={href(e.slug)}>
              <span className="d-num">{e.level.split(' / ')[0]}</span>
              <span className="x-list-main">
                <span className="x-list-title">{e.title}</span>
                <span className="x-list-desc">{e.description}</span>
              </span>
              <span className="x-list-meta">
                {e.tech} · {e.level.split(' / ')[1]}
              </span>
            </a>
          </li>
        ))}
      </ol>
        <p className="x-foot">
          Every example uses the same calls. The <a href="/docs/">documentation</a> explains them.
        </p>
      </main>
      <Credits />
    </div>
  );
}

export function ExampleDetail({ slug }: { slug: (typeof examples)[number]['slug'] }) {
  const i = examples.findIndex((e) => e.slug === slug);
  const e = examples[i];
  const prev = examples[i - 1];
  const next = examples[i + 1];
  return (
    <div className="d-page x-page">
      <header className="d-head x-head">
        <SiteNav current="examples" />
        <a className="d-home" href={href()}>
          ← All examples
        </a>
        <p className="x-kicker">
          <span className="d-num">{e.level.split(' / ')[0]}</span> {e.tech} · {e.level.split(' / ')[1]}
        </p>
        <h1 className="x-title">{e.title}</h1>
        <p className="d-lede">{e.description}</p>
      </header>

      <main id="main">
        <Stage key={slug} mode={slug} />

        <section className="x-explain">
          <div>
            <h2>What you’ll learn</h2>
            <p>{e.learn}</p>
            {slug === 'three' && (
              <p>
                Install <code>three</code> separately. This example loads it on demand and disposes its geometry, material
                and renderer when you leave.
              </p>
            )}
            <p>
              <a href="/docs/#start">The complete setup, with playback and cleanup →</a>
            </p>
            <p>
              <a href={slug === 'three' ? '/source/sculpture.ts' : '/source/Stage.tsx'} download>
                Download the working {slug === 'three' ? 'Three.js renderer' : 'example component'} ↓
              </a>
            </p>
          </div>
          <Code label="The key idea · excerpt">{e.code}</Code>
        </section>

        <nav className="x-pager" aria-label="More examples">
          {prev ? <a href={href(prev.slug)}>← {prev.title}</a> : <a href={href()}>← All examples</a>}
          {next ? <a href={href(next.slug)}>{next.title} →</a> : <a href="/docs/#api">API reference →</a>}
        </nav>
      </main>
      <Credits />
    </div>
  );
}
