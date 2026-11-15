import { renderToString } from 'react-dom/server';
import App from './App';
import { renderHead } from './metadata';

export { pages } from './content';

export function render(path: string) {
  return { html: renderToString(<App path={path} />), head: renderHead(path) };
}
