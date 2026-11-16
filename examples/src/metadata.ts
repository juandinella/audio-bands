import { faqs, origin, pages, repo } from './content';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function renderHead(path: string) {
  const page = pages.find(page => page.path === path);
  const title = page?.title ?? 'Page not found — audio-bands';
  const description = page?.description ?? 'Find audio-bands documentation and audio visualization examples.';
  const url = `${origin}${path}`;
  const graph: Record<string, unknown>[] = [{
    '@type': 'WebPage', '@id': url, url, name: title, description, inLanguage: 'en',
    isPartOf: { '@id': `${origin}/#website` },
  }, {
    '@type': 'WebSite', '@id': `${origin}/#website`, name: 'audio-bands', url: `${origin}/`,
  }];
  if (path === '/') {
    graph.push({ '@type': 'SoftwareSourceCode', name: '@juandinella/audio-bands', description: faqs[0][1], codeRepository: repo, programmingLanguage: ['TypeScript', 'JavaScript'], runtimePlatform: 'Web browser', license: `${repo}/blob/main/LICENSE`, url: origin });
    graph.push({ '@type': 'FAQPage', mainEntity: faqs.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) });
  }
  if (page && path !== '/') {
    const items = [{ name: 'Home', item: `${origin}/` }];
    if (path.startsWith('/examples/') && path !== '/examples/') items.push({ name: 'Examples', item: `${origin}/examples/` });
    items.push({ name: title.replace(' — audio-bands', ''), item: url });
    graph.push({ '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })) });
  }
  const head = `<title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    ${page ? `<link rel="canonical" href="${url}" />` : '<meta name="robots" content="noindex" />'}
    <meta name="theme-color" content="#e9eaec" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="audio-bands" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${origin}/social.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="audio-bands. Audio in. Numbers out. Browser audio analysis for JavaScript and React." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(description)}" />
    <meta name="twitter:image" content="${origin}/social.png" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>`;
  return head;
}
