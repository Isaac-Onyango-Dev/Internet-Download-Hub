/**
 * Builds the body of a GitHub Release from CHANGELOG.md.
 *
 * CHANGELOG.md is the hand-written record; package.json is the single source
 * of truth for the version number. The release workflow calls this so the
 * published release notes, the README badges and the site's "What's new"
 * section all describe the same thing without anyone editing three files.
 *
 *   npx tsx scripts/release-notes.ts <version> [--out <file>] [--check]
 *
 * --check   exit non-zero if CHANGELOG.md has no section for <version>,
 *           without writing anything. Used as a release pre-flight gate.
 *
 * The version may be given with or without a leading "v". With no argument
 * the version is read from package.json.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const REPO = 'Isaac-Onyango-Dev/Internet-Download-Hub';

const stripV = (v: string) => v.replace(/^v/i, '').trim();

function currentVersion(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
  return pkg.version;
}

/**
 * Pulls the body of a `## [1.2.3] - date` section, stopping at the next
 * `## ` heading. Returns null when the version has no section yet.
 */
export function sectionFor(changelog: string, version: string): string | null {
  const want = stripV(version);
  const lines = changelog.split(/\r?\n/);

  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const heading = lines[i].match(/^##\s+\[?([^\]\s]+)\]?/);
    if (heading && stripV(heading[1]) === want) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n').trim() || null;
}

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const outIndex = args.indexOf('--out');
  const out = outIndex === -1 ? null : args[outIndex + 1];
  const positional = args.filter(
    (a, i) => !a.startsWith('--') && !(outIndex !== -1 && i === outIndex + 1),
  );

  const version = stripV(positional[0] || currentVersion());
  const changelog = readFileSync(CHANGELOG, 'utf8');
  const section = sectionFor(changelog, version);

  if (!section) {
    const message =
      `CHANGELOG.md has no "## [${version}]" section. Add one (move the ` +
      `Unreleased entries under it) before tagging v${version}.`;
    if (check) {
      console.error(`::error file=CHANGELOG.md::${message}`);
      process.exit(1);
    }
    console.error(`Warning: ${message}`);
  }

  if (check) {
    console.log(`CHANGELOG.md has a section for ${version}.`);
    return;
  }

  const body = section
    ? `${section}\n\n---\n\n[Full changelog](https://github.com/${REPO}/blob/main/CHANGELOG.md)`
    : `See the [changelog](https://github.com/${REPO}/blob/main/CHANGELOG.md) for details.`;

  if (out) {
    writeFileSync(out, `${body}\n`, 'utf8');
    console.log(`Wrote ${body.length} characters of release notes to ${out}`);
  } else {
    process.stdout.write(`${body}\n`);
  }
}

// Only run when invoked directly, so the extractor stays importable by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
