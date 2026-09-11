import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sectionFor } from './release-notes.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SAMPLE = `# Changelog

## [Unreleased]

- something not released yet

## [1.2.0] - 2026-05-01

### Added

- a thing

## [1.1.9] - 2026-04-01

### Fixed

- an older thing
`;

describe('sectionFor', () => {
  it('returns only the requested version section', () => {
    const out = sectionFor(SAMPLE, '1.2.0');
    expect(out).toContain('- a thing');
    expect(out).not.toContain('an older thing');
    expect(out).not.toContain('not released yet');
  });

  it('accepts a tag with or without its leading v', () => {
    expect(sectionFor(SAMPLE, 'v1.2.0')).toBe(sectionFor(SAMPLE, '1.2.0'));
  });

  it('reads the last section in the file', () => {
    expect(sectionFor(SAMPLE, '1.1.9')).toContain('an older thing');
  });

  it('returns null for a version that has no section', () => {
    expect(sectionFor(SAMPLE, '9.9.9')).toBeNull();
  });

  // The release workflow refuses to publish without this, so a missing
  // section for the version in package.json is a broken release waiting
  // to happen rather than a test being fussy.
  it('has a section for the version currently in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
    const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
    expect(sectionFor(changelog, pkg.version)).not.toBeNull();
  });
});
