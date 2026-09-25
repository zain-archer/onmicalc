import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static guardrails: these assertions keep the "free, private, safe" promises
 * honest as the codebase grows.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(full) && !/\.test\./.test(full) ? [full] : [];
  });
}

const files = sourceFiles(join(process.cwd(), 'src'));
const read = (file: string) => readFileSync(file, 'utf8');

describe('safety and privacy guardrails', () => {
  it('never uses eval or the Function constructor', () => {
    const offenders = files.filter((file) => /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"]/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('never injects raw HTML', () => {
    const offenders = files.filter((file) => /dangerouslySetInnerHTML|innerHTML\s*=|outerHTML\s*=/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('makes no network requests from the app itself', () => {
    const offenders = files.filter((file) => {
      const source = read(file);
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      return /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon/.test(withoutComments);
    });
    expect(offenders).toEqual([]);
  });

  it('links to no external origins in the shell', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const external = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
    expect(external).toEqual([]);
  });

  it('only touches localStorage inside the storage layer', () => {
    const offenders = files.filter(
      (file) => /localStorage\.(get|set|remove)Item|sessionStorage/.test(read(file)) && !/src\/storage\//.test(file),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the math engine free of React and DOM imports', () => {
    const engineFiles = [
      ...sourceFiles(join(process.cwd(), 'src/core')),
      ...sourceFiles(join(process.cwd(), 'src/math')),
      ...sourceFiles(join(process.cwd(), 'src/engineering')),
      ...sourceFiles(join(process.cwd(), 'src/finance')),
      ...sourceFiles(join(process.cwd(), 'src/graphing')),
      ...sourceFiles(join(process.cwd(), 'src/conversions')),
    ];
    const offenders = engineFiles.filter((file) =>
      /from '(react|react-dom|@testing-library[^']*)'|document\.|window\./.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it('declares no paid, tracking or remote dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    const suspicious = names.filter((name) => /analytics|track|sentry|stripe|paypal|ads|telemetry/i.test(name));
    expect(suspicious).toEqual([]);
  });

  it('ships the documentation the project promises', () => {
    const required = [
      'README.md',
      'PROJECT_STATUS.md',
      'DEPLOYMENT.md',
      'CONTRIBUTING.md',
      'CHANGELOG.md',
      'LICENSE',
      'docs/DESKTOP.md',
      'src-tauri/tauri.conf.json',
    ];
    const missing = required.filter((file) => {
      try {
        return readFileSync(join(process.cwd(), file), 'utf8').length === 0;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });

  it('keeps the licence free and open', () => {
    const licence = readFileSync(join(process.cwd(), 'LICENSE'), 'utf8');
    expect(licence).toMatch(/MIT License/i);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { license?: string };
    expect(pkg.license).toBe('MIT');
  });

  it('keeps every source file at a reviewable size', () => {
    const oversized = files
      .map((file) => ({ file, lines: read(file).split('\n').length }))
      .filter((entry) => entry.lines > 900);
    expect(oversized).toEqual([]);
  });
});
