import { useEffect, useRef, useState } from 'react';

export default function Code({ children, label = 'JavaScript' }: { children: string; label?: string }) {
  const [status, setStatus] = useState('Copy');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setStatus('Copied');
    } catch {
      setStatus('Select and copy manually');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('Copy'), 2500);
  }
  return <div className="code-block">
    <div className="code-heading"><span>{label}</span><button onClick={copy} aria-label={`Copy ${label}`}><span role="status">{status}</span></button></div>
    <pre><code>{children}</code></pre>
  </div>;
}
