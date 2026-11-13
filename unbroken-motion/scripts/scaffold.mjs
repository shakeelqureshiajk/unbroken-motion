#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  STARTER_TEMPLATE_DIR,
  copyStarterTemplate,
  isPathInside,
  materializeExampleToDir,
  parseArgs,
  readJson,
  resolutionForAspect,
  resolveWorkspaceDir,
  SKILL_ROOT,
  syncFilmBrandJson,
  writeJson,
} from './common.mjs';

function hasParentNodeModules(dir) {
  let curr = path.resolve(dir);
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(curr, 'node_modules', 'remotion'))) return true;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return false;
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const name = flags.name;
  if (!name || typeof name !== 'string') {
    console.error(
      'Usage: node scripts/scaffold.mjs --name <film-slug> [--out <dir>] [--workspace <dir>] [--brand <brand-id>] [--aspect 16:9|9:16|1:1] [--from-example <slug>] [--install] [--force]'
    );
    process.exit(1);
  }

  const workspaceDir = resolveWorkspaceDir(
    typeof flags.workspace === 'string' ? flags.workspace : null
  );
  const targetDir = flags.out
    ? path.resolve(String(flags.out))
    : path.join(workspaceDir, name);

  if (isPathInside(targetDir, SKILL_ROOT)) {
    console.error(`Refusing to scaffold inside skill folder (${targetDir}). Use a workspace path outside ${SKILL_ROOT}.`);
    process.exit(1);
  }

  if (fs.existsSync(targetDir) && !flags.force) {
    console.error(`Target directory already exists: ${targetDir} (pass --force to overwrite)`);
    process.exit(1);
  }

  // Ensure workspace root has package.json so a single `npm install` at the workspace root serves all films
  const parentDir = path.dirname(targetDir);
  if (!fs.existsSync(path.join(parentDir, 'package.json'))) {
    fs.mkdirSync(parentDir, { recursive: true });
    fs.copyFileSync(
      path.join(STARTER_TEMPLATE_DIR, 'package.json'),
      path.join(parentDir, 'package.json')
    );
    const lockSrc = path.join(STARTER_TEMPLATE_DIR, 'package-lock.json');
    if (fs.existsSync(lockSrc)) {
      fs.copyFileSync(lockSrc, path.join(parentDir, 'package-lock.json'));
    }
  }

  if (flags['from-example']) {
    materializeExampleToDir(String(flags['from-example']), targetDir);
  } else {
    copyStarterTemplate(targetDir);
  }

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

  if (flags.install && !hasParentNodeModules(targetDir)) {
    console.log(`Installing Remotion dependencies in ${parentDir}...`);
    execSync('npm install', { cwd: parentDir, stdio: 'inherit' });
  }

  console.log(`Scaffolded film "${name}" at: ${targetDir}`);
  console.log(
    `Brand synced: ${beats.brand} | Aspect: ${beats.aspectRatio} (${beats.resolution.width}x${beats.resolution.height})`
  );
  if (!hasParentNodeModules(targetDir)) {
    console.log(
      `Note: Run "npm install" inside "${parentDir}" (or "${targetDir}") before rendering video.`
    );
  }
}

main();
