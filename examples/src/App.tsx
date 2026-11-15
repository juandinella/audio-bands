import { Hardware } from './landing/kit/ui/hardware';
import Analyser from './landing/Analyser';
import Docs from './docs/Docs';
import { ExampleDetail, ExamplesIndex } from './examples/Examples';
import SiteNav from './SiteNav';
import { examples } from './content';

// The brand orange, as the kit's key colour: keys, lamps and the high band.
const brand = { l: 0.68, c: 0.21, h: 40 };

function NotFound() {
  return (
    <div className="d-page">
      <header className="d-head">
        <SiteNav current="docs" />
        <h1>This page is silent.</h1>
        <p className="d-lede">That address does not match a page.</p>
      </header>
      <main id="main">
        <p>
          Start from the <a href="/">analyser</a>, read the <a href="/docs/">documentation</a> or try the{' '}
          <a href="/examples/">examples</a>.
        </p>
      </main>
    </div>
  );
}

// One app, prerendered per path: the AB-1 landing, the docs, the examples.
export default function App({ path = '/' }: { path?: string }) {
  const example = examples.find((e) => path === `/examples/${e.slug}/`);
  let page;
  if (path === '/')
    page = (
      <Hardware keyColor={brand} className="ab-root">
        <Analyser />
      </Hardware>
    );
  else if (path === '/docs/') page = <Docs />;
  else if (path === '/examples/') page = <ExamplesIndex />;
  else if (example) page = <ExampleDetail slug={example.slug} />;
  else page = <NotFound />;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {page}
    </>
  );
}
