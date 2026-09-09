#!/usr/bin/env node
/**
 * Symlink the repo-root .env into each app workspace so Prisma / Nest / Next
 * (and any CLI run from the package cwd) can discover env vars automatically.
 */
import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootEnv = join(root, '.env');
const targets = [join(root, 'apps/server/.env'), join(root, 'apps/web/.env')];

if (!existsSync(rootEnv)) {
  console.warn(
    '[link-workspace-env] Root .env not found; skip (run: cp .env.example .env)',
  );
  process.exit(0);
}

for (const target of targets) {
  const rel = relative(dirname(target), rootEnv);
  try {
    const existing = lstatSync(target);
    if (existing.isSymbolicLink()) {
      unlinkSync(target);
    } else {
      console.warn(
        `[link-workspace-env] ${relative(root, target)} exists as a real file; leave untouched`,
      );
      continue;
    }
  } catch {
    // target does not exist
  }

  symlinkSync(rel, target);
  console.log(`[link-workspace-env] ${relative(root, target)} -> ${rel}`);
}
