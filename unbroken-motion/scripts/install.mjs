#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENTS_CONFIG_PATH,
  SKILL_ROOT,
  ensureDir,
  isPathInside,
  parseArgs,
  readJson,
} from './common.mjs';

const EXCLUDE_NAMES = new Set([
  'node_modules',
  'out',
  'stills',
  'audio',
  '.remotion',
  '.final-passes',
  '.tmp',
  '.git',
  'manifest.json',
  'render.log',
  '.DS_Store',
  'Thumbs.db',
]);

function expandHome(p) {
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function hasBinaryOnPath(binName) {
  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    execFileSync(locator, [binName], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function isAgentDetected(agent, projectRoot) {
  for (const d of agent.detectDirs || []) {
    const resolved = d.startsWith('~') ? expandHome(d) : path.join(projectRoot, d);
    if (fs.existsSync(resolved)) return true;
  }
  for (const b of agent.detectBins || []) {
    if (hasBinaryOnPath(b)) return true;
  }
  return false;
}

export function copySkillClean(srcDir, destDir) {
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (EXCLUDE_NAMES.has(entry.name)) continue;
    if (entry.name.endsWith('.zip') || entry.name.endsWith('.mp4')) continue;
    if (entry.isSymbolicLink()) continue;
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copySkillClean(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(
      'Usage: node scripts/install.mjs [--agent claude|antigravity|codex|cursor|opencode|amp|all] [--scope user|project] [--project-dir <dir>] [--update] [--uninstall] [--dry-run]'
    );
    process.exit(0);
  }

  const config = readJson(AGENTS_CONFIG_PATH);
  const scope = flags.scope === 'project' ? 'project' : 'user';
  const projectRoot = flags['project-dir']
    ? path.resolve(String(flags['project-dir']))
    : process.cwd();
  const agentFilter = flags.agent ? String(flags.agent).toLowerCase() : null;
  const dryRun = Boolean(flags['dry-run']);
  const uninstall = Boolean(flags.uninstall);

  const selectedAgents = config.agents.filter((a) => {
    if (!agentFilter) return isAgentDetected(a, projectRoot);
    if (agentFilter === 'all') return true;
    return agentFilter.split(',').map((s) => s.trim()).includes(a.id);
  });

  if (selectedAgents.length === 0) {
    console.log(
      'No matching or auto-detected agents found. Pass --agent claude|antigravity|codex|cursor|all to specify targets explicitly.'
    );
    process.exit(0);
  }

  console.log(`=== UNBROKEN MOTION INSTALLER (${scope} scope${dryRun ? ', DRY RUN' : ''}) ===`);
  for (const agent of selectedAgents) {
    const relTarget = scope === 'project' ? agent.projectDir : agent.userDir;
    const targetDir = relTarget.startsWith('~')
      ? expandHome(relTarget)
      : path.resolve(projectRoot, relTarget);

    if (path.resolve(targetDir) === path.resolve(SKILL_ROOT)) {
      console.log(`  [SKIP] ${agent.name}: target is already the active skill source (${targetDir})`);
      continue;
    }

    if (isPathInside(targetDir, SKILL_ROOT)) {
      console.log(`  [SKIP] ${agent.name}: target (${targetDir}) is inside SKILL_ROOT`);
      continue;
    }

    if (uninstall) {
      if (fs.existsSync(targetDir)) {
        if (!dryRun) fs.rmSync(targetDir, { recursive: true, force: true });
        console.log(`  [REMOVED] ${agent.name}: ${targetDir}`);
      } else {
        console.log(`  [NOT INSTALLED] ${agent.name}: ${targetDir}`);
      }
      continue;
    }

    if (fs.existsSync(targetDir) && !flags.update && !flags.force) {
      console.log(
        `  [EXISTS] ${agent.name}: ${targetDir} (pass --update to refresh installed copy)`
      );
      continue;
    }

    if (!dryRun) {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      copySkillClean(SKILL_ROOT, targetDir);
    }
    console.log(`  [INSTALLED] ${agent.name} -> ${targetDir}`);
  }

  console.log('\nNote: Restart your agent session (or reload window) so it picks up the updated skill.');
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  main();
}
