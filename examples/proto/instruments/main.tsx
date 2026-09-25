import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Compact from './Compact';
import Modular from './Modular';
import Patch from './patch/Patch';
import './style.css';
import './picker.css';

const names = ['Actual', 'Compacto', 'Modular', 'Patch'];

function Harness() {
  const [variant, setVariant] = useState(() => {
    const n = Number(new URLSearchParams(location.search).get('v'));
    return n >= 1 && n <= names.length ? n - 1 : 0;
  });
  const [replay, setReplay] = useState(0);
  const picker = useRef<HTMLElement>(null);

  function select(index: number) {
    setVariant(index);
    const url = new URL(location.href);
    url.searchParams.set('v', String(index + 1));
    history.replaceState(null, '', url);
  }

  useLayoutEffect(() => {
    function position() {
      const item = picker.current?.querySelector<HTMLElement>('[data-active]');
      const highlight = picker.current?.querySelector<HTMLElement>('.proto-picker-highlight');
      if (item && highlight) {
        highlight.style.width = `${item.offsetWidth}px`;
        highlight.style.transform = `translateX(${item.offsetLeft}px)`;
      }
    }
    position();
    const observer = new ResizeObserver(position);
    if (picker.current) observer.observe(picker.current);
    return () => observer.disconnect();
  }, [variant]);

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => picker.current?.setAttribute('data-ready', ''));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      // A focused hardware control owns its arrow keys.
      if (target.closest('[data-instrument-control]')) return;
      const n = Number(event.key);
      if (n >= 1 && n <= names.length) select(n - 1);
      else if (event.key === 'ArrowRight') { event.preventDefault(); select((variant + 1) % names.length); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); select((variant + names.length - 1) % names.length); }
      else if (event.key.toLowerCase() === 'r') setReplay(value => value + 1);
    }
    window.addEventListener('keydown', keyboard);
    const iframe = document.querySelector<HTMLIFrameElement>('.baseline');
    function wireFrame() { iframe?.contentWindow?.addEventListener('keydown', keyboard); }
    iframe?.addEventListener('load', wireFrame);
    wireFrame();
    return () => {
      window.removeEventListener('keydown', keyboard);
      iframe?.removeEventListener('load', wireFrame);
      iframe?.contentWindow?.removeEventListener('keydown', keyboard);
    };
  }, [variant]);

  return <>
    <div key={`${variant}-${replay}`}>
      {variant === 0 ? <iframe className="baseline" src="/" title="Current audio-bands landing page" /> : variant === 1 ? <Compact /> : variant === 2 ? <Modular /> : <Patch />}
    </div>
    <nav className="proto-picker" aria-label="Prototype variants" ref={picker}>
      <span className="proto-picker-highlight" aria-hidden="true" />
      {names.map((name, i) => <button key={name} className="proto-picker-item" data-active={i === variant ? '' : undefined} aria-current={i === variant ? 'true' : undefined} onClick={() => select(i)}>{name}</button>)}
    </nav>
  </>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
