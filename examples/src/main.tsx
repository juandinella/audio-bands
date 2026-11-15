import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './docs/docs.css';
import './examples/examples.css';
import './landing/analyser.css';
import './landing/theme.css';
import App from './App';

const path = `${window.location.pathname.replace(/\/+$/, '')}/`;
const app = (
  <StrictMode>
    <App path={path} />
    <Analytics />
  </StrictMode>
);
const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
