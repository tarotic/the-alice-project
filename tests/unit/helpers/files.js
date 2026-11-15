import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export function readText(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

export function exists(relPath) {
  return existsSync(path.join(REPO_ROOT, relPath));
}

export function listFiles(relDir) {
  const out = [];
  function walk(rel) {
    const entries = readdirSync(path.join(REPO_ROOT, rel), { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(childRel);
      else out.push(childRel);
    }
  }
  walk(relDir.replace(/\/+$/, ''));
  return out;
}

export function deployableFiles() {
  return ['index.html', 'styles.css', ...listFiles('src')];
}
