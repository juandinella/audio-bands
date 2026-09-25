import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), 'audio-bands-release-'));
const sharedEnv = {
  ...process.env,
  npm_config_cache: join(tempRoot, '.npm-cache'),
};

function run(command, args, cwd = repoRoot) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: sharedEnv,
  });
}

function runJson(command, args, cwd = repoRoot) {
  return execFileSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    env: sharedEnv,
  });
}

try {
  run('npm', ['run', 'build']);
  const packOutput = runJson('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', tempRoot]);
  const [{ filename, files }] = Object.values(JSON.parse(packOutput));
  const tarballPath = join(tempRoot, filename);
  for (const required of ['LICENSE', 'README.md', 'dist/index.js', 'dist/core-entry.js', 'dist/react-entry.js']) {
    if (!files.some((file) => file.path === required)) {
      throw new Error(`Missing published file: ${required}`);
    }
  }

  const extractDir = join(tempRoot, 'package');
  mkdirSync(extractDir, { recursive: true });
  run('tar', ['-xzf', tarballPath, '-C', extractDir]);
  mkdirSync(join(extractDir, 'package/node_modules'), { recursive: true });
  symlinkSync(resolve(repoRoot, 'node_modules/react'), join(extractDir, 'package/node_modules/react'));
  symlinkSync(resolve(repoRoot, 'node_modules/react-dom'), join(extractDir, 'package/node_modules/react-dom'));

  const consumerDir = join(tempRoot, 'consumer');
  mkdirSync(join(consumerDir, 'node_modules'), { recursive: true });
  mkdirSync(join(consumerDir, 'node_modules/@juandinella'), { recursive: true });
  symlinkSync(join(extractDir, 'package'), join(consumerDir, 'node_modules/@juandinella/audio-bands'), 'dir');

  writeFileSync(
    join(consumerDir, 'esm.mjs'),
    [
      "import { AudioBands } from '@juandinella/audio-bands';",
      "import { AudioBands as CoreAudioBands } from '@juandinella/audio-bands/core';",
      "import { useAudioBands } from '@juandinella/audio-bands/react';",
      "if (typeof AudioBands !== 'function') throw new Error('Missing root AudioBands export');",
      "if (typeof CoreAudioBands !== 'function') throw new Error('Missing core AudioBands export');",
      "if (typeof useAudioBands !== 'function') throw new Error('Missing react hook export');",
    ].join('\n'),
  );

  writeFileSync(
    join(consumerDir, 'cjs.cjs'),
    [
      "const root = require('@juandinella/audio-bands');",
      "const core = require('@juandinella/audio-bands/core');",
      "const react = require('@juandinella/audio-bands/react');",
      "if (typeof root.AudioBands !== 'function') throw new Error('Missing CJS root AudioBands export');",
      "if (typeof core.AudioBands !== 'function') throw new Error('Missing CJS core AudioBands export');",
      "if (typeof react.useAudioBands !== 'function') throw new Error('Missing CJS react hook export');",
    ].join('\n'),
  );

  run('node', ['esm.mjs'], consumerDir);
  run('node', ['cjs.cjs'], consumerDir);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
