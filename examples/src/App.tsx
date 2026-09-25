import Code from './Code';
import Demo from './Demo';
import Docs from './Docs';
import { examples, faqs, install, repo } from './content';

function ExampleList({ compact = false }: { compact?: boolean }) {
  return <div className="example-list">{examples.map((example, index) => <article className="example-row" key={example.slug}>
    <span className="example-number">0{index + 1}</span><div><p className="eyebrow">{example.tech} · {example.level.split(' / ')[1]}</p><h3><a href={`/examples/${example.slug}/`}>{example.title}<span aria-hidden="true"> ↗</span></a></h3>{!compact && <p>{example.description}</p>}</div><span className={`example-glyph glyph-${example.slug}`} aria-hidden="true">{['◉', '▂▅▇', '▁▃▆▇▅▂', '∿', '✳'][index]}</span>
  </article>)}</div>;
}

function Home() {
  return <>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">A small library for audio-reactive ideas</p><h1>Audio in.<br /><span>Numbers out.</span></h1><p className="hero-description">Turn music or a microphone into <strong>bass</strong>, <strong>mid</strong> and <strong>high</strong> values. Connect them to anything you can build.</p><div className="hero-actions"><a className="button primary" href="#try">Try it live <span aria-hidden="true">↓</span></a><a className="text-link" href="/docs/">Read the docs ↗</a></div><p className="hero-meta">Vanilla JavaScript · Optional React hook · MIT</p></div>
      <div className="hero-diagram" aria-label="Music or microphone becomes bass, mid and high values for CSS, Canvas or Three.js"><div className="diagram-input">music / microphone <span>↓</span></div><div className="diagram-core"><span className="wordmark-bars" aria-hidden="true"><i /><i /><i /></span><strong>audio-bands</strong></div><div className="diagram-values"><span>bass <b>0–1</b></span><span>mid <b>0–1</b></span><span>high <b>0–1</b></span></div><div className="diagram-output"><span>↓</span>CSS / Canvas / Three.js / your idea</div></div>
    </section>
    <section className="demo-section" id="try"><div className="section-heading"><div><p className="eyebrow">01 / Hear it. See it.</p><h2>Three values. Real possibilities.</h2></div><p>Play a track and watch its energy change.<br />The library gives you the numbers; you choose the visuals.</p></div><Demo /><div className="demo-footnote"><span>Normalized values, from 0 to 1. No simulated input.</span><a href="/examples/pulse/">See the simplest example →</a></div></section>
    <section className="explain-section"><div><p className="eyebrow">02 / The small part between</p><h2>Bring the sound.<br />Keep your renderer.</h2><p>audio-bands handles browser audio analysis and playback. Read simple energy bands, custom regions, raw FFT bins or waveform data.</p><p>Use a value to scale a button. Draw a spectrum on a canvas. Deform a 3D scene. No rendering framework comes with the package.</p><a className="text-link" href="/docs/#frames">Understand the data →</a></div><div><Code label="Terminal">{install}</Code><Code label="Inside your animation loop">{`const { bands } = audio.snapshot();

const { bass, mid, high } = bands;

// A number becomes a design decision.
circle.style.transform = \`scale(\${0.6 + bass})\`;`}</Code><a className="code-caption" href="/docs/#start">Get the complete setup, including playback and cleanup →</a></div></section>
    <section className="examples-section"><div className="section-heading"><div><p className="eyebrow">03 / Start small. Go somewhere strange.</p><h2>One API, five experiments.</h2></div><a className="text-link" href="/examples/">Explore all examples ↗</a></div><ExampleList compact /></section>
    <section className="faq-section"><div><p className="eyebrow">A few useful answers</p><h2>Before you build.</h2></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="closing"><h2>Your first idea only<br />needs one number.</h2><a className="button primary" href="/docs/">Start building ↗</a></section>
  </>;
}

export default function App({ path = '/' }: { path?: string }) {
  const example = examples.find(item => path === `/examples/${item.slug}/`);
  const index = example ? examples.indexOf(example) : -1;
  const known = path === '/' || path === '/docs/' || path === '/examples/' || Boolean(example);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><a href="/" className="brand" aria-label="audio-bands home"><span className="wordmark-bars" aria-hidden="true"><i /><i /><i /></span>audio-bands</a><nav aria-label="Main navigation"><a aria-current={path === '/docs/' ? 'page' : undefined} href="/docs/">Docs</a><a aria-current={path.startsWith('/examples/') ? 'page' : undefined} href="/examples/">Examples</a><a href={repo}>GitHub <span aria-hidden="true">↗</span></a></nav></header>
    <main id="main">
      {path === '/' && <Home />}
      {path === '/docs/' && <Docs />}
      {path === '/examples/' && <><div className="page-intro"><p className="eyebrow">The example collection</p><h1>A little pulse.<br />A whole new world.</h1><p>Five working examples, each adding one idea. Start with a single value and work up to a Three.js sound sculpture.</p></div><ExampleList /></>}
      {example && <><div className="page-intro example-intro"><a href="/examples/">← All examples</a><p className="eyebrow">{example.level} · {example.tech}</p><h1>{example.title}</h1><p>{example.description}</p></div><Demo mode={example.slug} /><div className="example-explanation"><div><p className="eyebrow">What you’ll learn</p><h2>{example.tech === 'Three.js' ? 'Same data. Another dimension.' : 'A small step, explained.'}</h2><p>{example.learn}</p><a href="/docs/#start">Start with the complete integration →</a>{example.slug === 'three' && <p>Install <code>three</code> separately. This example loads it on demand and disposes its geometry, material and renderer on unmount.</p>}</div><div><Code label="The key idea · excerpt">{example.code}</Code><a className="code-caption" href={example.slug === 'three' ? '/source/three-scene.ts' : '/source/Demo.tsx'} download>Download the working {example.slug === 'three' ? 'Three.js renderer' : 'demo component'} ↓</a></div></div><nav className="example-pagination" aria-label="Example progression">{index > 0 ? <a href={`/examples/${examples[index - 1].slug}/`}>← {examples[index - 1].title}</a> : <a href="/docs/">← Quick start</a>}{index < examples.length - 1 ? <a href={`/examples/${examples[index + 1].slug}/`}>{examples[index + 1].title} →</a> : <a href="/docs/#api">Explore the API →</a>}</nav></>}
      {!known && <div className="page-intro"><p className="eyebrow">404</p><h1>This page is silent.</h1><p>That address does not match a page. Find a working example or return to the documentation.</p><a href="/examples/">Explore examples →</a></div>}
    </main>
    <footer className="site-footer"><div><a className="brand" href="/">audio-bands</a><p>Made by <a href="https://juandinella.com">Juan Dinella</a>. Open source, MIT.</p></div><nav aria-label="Footer navigation"><a href="/docs/">Documentation</a><a href="https://www.npmjs.com/package/@juandinella/audio-bands">npm ↗</a><a href="/llms.txt">llms.txt</a></nav></footer>
  </>;
}
