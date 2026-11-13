#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  BRANDS_DIR,
  EXAMPLES_DIR,
  MIN_NODE_MAJOR,
  MIN_NODE_MINOR,
  MIN_NODE_VERSION,
  SCHEMA_DIR,
  SKILL_ROOT,
  STARTER_TEMPLATE_DIR,
  ensureDir,
  parseArgs,
  resolveFfmpegBinaries,
  resolveWorkspaceDir,
} from './common.mjs';

export async function runDoctor(options = {}) {
  const checks = [];
  const workspaceDir = resolveWorkspaceDir(options.workspace);

  // 1. Node.js Version Check
  const [maj, min] = process.versions.node.split('.').map((n) => parseInt(n, 10));
  const nodeOk = maj > MIN_NODE_MAJOR || (maj === MIN_NODE_MAJOR && min >= MIN_NODE_MINOR);
  checks.push({
    id: 'node-version',
    name: 'Node.js Runtime Version',
    status: nodeOk ? 'PASS' : 'FAIL',
    detail: `v${process.versions.node} (requires >= v${MIN_NODE_VERSION})`,
    fix: nodeOk ? null : `Upgrade Node.js to >= v${MIN_NODE_VERSION} (LTS v22.18+ or v24+ recommended).`,
  });

  // 2. Native TypeScript Type-Stripping Support
  let tsOk = false;
  let tsDetail = '';
  try {
    const easingUrl = pathToFileURL(path.join(STARTER_TEMPLATE_DIR, 'src', 'lib', 'easing.ts')).href;
    const mod = await import(easingUrl);
    tsOk = typeof mod.smoothstep === 'function';
    tsDetail = 'Native .ts module import active';
  } catch (err) {
    tsDetail = err.message;
  }
  checks.push({
    id: 'typescript-import',
    name: 'Native TypeScript Execution',
    status: tsOk ? 'PASS' : 'FAIL',
    detail: tsDetail,
    fix: tsOk
      ? null
      : 'Use Node.js >= 22.6.0 with --experimental-strip-types (enabled by default in Node 22.18+ / 24+).',
  });

  // 3. Skill Package Integrity
  const requiredPaths = [
    path.join(SKILL_ROOT, 'SKILL.md'),
    path.join(SCHEMA_DIR, 'beats.schema.json'),
    path.join(SCHEMA_DIR, 'brand.schema.json'),
    path.join(BRANDS_DIR, 'obsidian-tech.md'),
    path.join(BRANDS_DIR, 'warm-editorial.md'),
    path.join(STARTER_TEMPLATE_DIR, 'package.json'),
    path.join(STARTER_TEMPLATE_DIR, 'src', 'scene.ts'),
    path.join(EXAMPLES_DIR, '01-single-seed', 'beats.json'),
  ];
  const missingFiles = requiredPaths.filter((p) => !fs.existsSync(p));
  checks.push({
    id: 'skill-integrity',
    name: 'Skill Package Completeness',
    status: missingFiles.length === 0 ? 'PASS' : 'FAIL',
    detail:
      missingFiles.length === 0
        ? `All core skill files present at ${SKILL_ROOT}`
        : `Missing: ${missingFiles.map((p) => path.relative(SKILL_ROOT, p)).join(', ')}`,
    fix: missingFiles.length === 0 ? null : 'Re-install the unbroken-motion skill package.',
  });

  // 4. Writable Workspace & Disk Space
  let wsWritable = false;
  let freeMb = null;
  let wsErr = null;
  try {
    ensureDir(workspaceDir);
    const probe = path.join(workspaceDir, `.doctor-write-probe-${process.pid}`);
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
    wsWritable = true;
    if (typeof fs.statfsSync === 'function') {
      const st = fs.statfsSync(workspaceDir);
      freeMb = Math.round((Number(st.bavail) * Number(st.bsize)) / (1024 * 1024));
    }
  } catch (err) {
    wsErr = err.message;
  }
  const spaceOk = freeMb === null || freeMb >= 500;
  checks.push({
    id: 'workspace-writable',
    name: 'Workspace Directory & Disk Space',
    status: wsWritable && spaceOk ? 'PASS' : wsWritable ? 'WARN' : 'FAIL',
    detail: wsWritable
      ? `${workspaceDir} (writable${freeMb !== null ? `, ${(freeMb / 1024).toFixed(1)} GB free` : ''})`
      : `Cannot write to ${workspaceDir}: ${wsErr}`,
    fix: !wsWritable
      ? 'Set UNBROKEN_MOTION_WORKSPACE to a writable directory.'
      : !spaceOk
      ? 'Free at least 500 MB of disk space before rendering 4K60 video.'
      : null,
  });

  // 5. Remotion Renderer Dependencies in Workspace
  let remotionOk = false;
  let remotionDetail = '';
  try {
    const pkgAnchor = fs.existsSync(path.join(workspaceDir, 'package.json'))
      ? path.join(workspaceDir, 'package.json')
      : path.join(STARTER_TEMPLATE_DIR, 'package.json');
    const req = createRequire(pkgAnchor);
    const bundlerPath = req.resolve('@remotion/bundler');
    const rendererPath = req.resolve('@remotion/renderer');
    if (bundlerPath && rendererPath) {
      remotionOk = true;
      remotionDetail = `Resolved @remotion/bundler & @remotion/renderer`;
    }
  } catch {
    remotionDetail = `Not yet installed in ${workspaceDir}`;
  }
  checks.push({
    id: 'remotion-deps',
    name: 'Remotion Bundler & Renderer',
    status: remotionOk ? 'PASS' : options.strict ? 'FAIL' : 'WARN',
    detail: remotionDetail,
    fix: remotionOk
      ? null
      : `Run "node ${path.join(SKILL_ROOT, 'scripts', 'scaffold.mjs')} --name demo --install" or run "npm install" inside "${workspaceDir}". (If no network/browser is available, use Tier-2 author-only mode.)`,
  });

  // 6. FFmpeg & FFprobe Binaries
  const { ffmpeg, ffprobe } = resolveFfmpegBinaries(workspaceDir);
  const ffOk = Boolean(ffmpeg && ffprobe);
  checks.push({
    id: 'ffmpeg',
    name: 'FFmpeg & FFprobe Binaries',
    status: ffOk ? 'PASS' : options.strict ? 'FAIL' : 'WARN',
    detail: ffOk
      ? `ffmpeg=${ffmpeg}`
      : 'Not found on PATH or in workspace node_modules/@remotion',
    fix: ffOk
      ? null
      : `Install Remotion dependencies in "${workspaceDir}" ("npm install") or install ffmpeg on system PATH / set FFMPEG_PATH.`,
  });

  const failed = checks.filter((c) => c.status === 'FAIL');
  const warned = checks.filter((c) => c.status === 'WARN');
  return {
    passed: failed.length === 0,
    tier: failed.length === 0 && warned.length === 0 ? 1 : failed.length === 0 ? 2 : 0,
    workspaceDir,
    checks,
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { flags } = parseArgs(process.argv.slice(2));
  const report = await runDoctor({
    workspace: typeof flags.workspace === 'string' ? flags.workspace : null,
    strict: Boolean(flags.strict),
  });

  console.log(`=== UNBROKEN MOTION DOCTOR ===`);
  console.log(`Skill Root : ${SKILL_ROOT}`);
  console.log(`Workspace  : ${report.workspaceDir}`);
  console.log(`Platform   : ${process.platform}-${process.arch}\n`);

  for (const c of report.checks) {
    console.log(`  [${c.status}] ${c.name}: ${c.detail}`);
    if (c.fix) {
      console.log(`         Fix: ${c.fix}`);
    }
  }

  console.log(
    `\nTier Status: ${
      report.tier === 1
        ? 'Tier 1 (Full Pipeline: scaffold, manifest, verify, draft & 4K60 rendering ready)'
        : report.tier === 2
        ? 'Tier 2 (Schema, manifest & G1-G5/G7 verification ready; run "npm install" in workspace for video rendering)'
        : 'Blocked (Fix [FAIL] items above before proceeding)'
    }`
  );

  if (!report.passed) {
    process.exit(1);
  }
}
