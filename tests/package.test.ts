// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('package exports', () => {
  it('exposes root, core and react subpath exports', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      exports: Record<string, unknown>;
    };

    expect(pkg.exports['.']).toBeTruthy();
    expect(pkg.exports['./core']).toBeTruthy();
    expect(pkg.exports['./react']).toBeTruthy();
  });

  it('keeps the root and core bundles free of react imports', () => {
    const rootBundle = readFileSync(resolve(process.cwd(), 'dist/index.js'), 'utf8');
    const coreBundle = readFileSync(
      resolve(process.cwd(), 'dist/core-entry.js'),
      'utf8',
    );
    const reactBundle = readFileSync(
      resolve(process.cwd(), 'dist/react-entry.js'),
      'utf8',
    );

    expect(rootBundle).not.toContain('"react"');
    expect(coreBundle).not.toContain('"react"');
    expect(reactBundle).toContain('"react"');
  });
});
