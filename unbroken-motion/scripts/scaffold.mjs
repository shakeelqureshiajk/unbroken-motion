#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  CASES_DIR,
  STARTER_TEMPLATE_DIR,
  ensureDir,
  parseArgs,
  readJson,
  resolutionForAspect,
  syncFilmBrandJson,
  writeJson,
} from './common.mjs';

function copyTemplateRecursive(srcDir, destDir) {
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'out' ||
      entry.name === '.remotion' ||
      entry.name === 'stills'
    ) {
      continue;
    }
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTemplateRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const name = flags.name;
  if (!name || typeof name !== 'string') {
    console.error('Usage: node scripts/scaffold.mjs --name <film-slug> [--out <dir>] [--brand <brand-id>] [--aspect 16:9|9:16|1:1] [--force]');
    process.exit(1);
  }

  const targetDir = flags.out
    ? path.resolve(String(flags.out))
    : path.join(CASES_DIR, name);

  if (fs.existsSync(targetDir) && !flags.force) {
    console.error(`Target directory already exists: ${targetDir} (pass --force to overwrite)`);
    process.exit(1);
  }

  copyTemplateRecursive(STARTER_TEMPLATE_DIR, targetDir);

  const beatsPath = path.join(targetDir, 'beats.json');
  const beats = readJson(beatsPath);
  beats.film = name;
  if (flags.brand) beats.brand = String(flags.brand);
  if (flags.aspect) {
    const aspect = String(flags.aspect);
    if (!['16:9', '9:16', '1:1'].includes(aspect)) {
      throw new Error(`Invalid --aspect "${aspect}". Expected 16:9, 9:16, or 1:1.`);
    }
    beats.aspectRatio = aspect;
    beats.resolution = resolutionForAspect(aspect, false);
  }
  writeJson(beatsPath, beats);

  // Sync brand.json from references/brands/<brand>.md
  syncFilmBrandJson(targetDir, beats.brand);

  // Update package.json name
  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = readJson(pkgPath);
  pkg.name = `unbroken-motion-${name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}`;
  writeJson(pkgPath, pkg);

  // Link node_modules via directory junction on Windows / symlink on POSIX if available
  const starterModules = path.join(STARTER_TEMPLATE_DIR, 'node_modules');
  const filmModules = path.join(targetDir, 'node_modules');
  if (!flags['no-link-deps'] && fs.existsSync(starterModules) && !fs.existsSync(filmModules)) {
    fs.symlinkSync(
      starterModules,
      filmModules,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  }

  console.log(`Scaffolded film "${name}" at: ${targetDir}`);
  console.log(`Brand synced: ${beats.brand} | Aspect: ${beats.aspectRatio} (${beats.resolution.width}x${beats.resolution.height})`);
}

main();

