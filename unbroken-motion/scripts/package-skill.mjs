#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILL_ROOT, parseArgs, resolveWorkspaceDir } from './common.mjs';
import { copySkillClean } from './install.mjs';

export function packageSkillZip(outZipPath) {
  const resolvedZip = path.resolve(outZipPath);
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-pkg-'));
  const stagedSkill = path.join(stagingRoot, 'unbroken-motion');

  try {
    copySkillClean(SKILL_ROOT, stagedSkill);
    if (fs.existsSync(resolvedZip)) {
      fs.unlinkSync(resolvedZip);
    }
    fs.mkdirSync(path.dirname(resolvedZip), { recursive: true });

    if (process.platform === 'win32') {
      const psScript = `
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$src = '${stagedSkill.replace(/'/g, "''")}'
$zipPath = '${resolvedZip.replace(/'/g, "''")}'
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
Get-ChildItem -LiteralPath $src -Recurse -File -Force | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length).TrimStart('\\','/') -replace '\\\\','/'
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, 'unbroken-motion/' + $rel, 'Optimal')
}
$zip.Dispose()
`;
      execFileSync('powershell', ['-NoProfile', '-Command', psScript], {
        stdio: 'inherit',
        windowsHide: true,
      });
    } else {
      execFileSync('zip', ['-r', '-q', resolvedZip, 'unbroken-motion'], {
        cwd: stagingRoot,
        stdio: 'inherit',
      });
    }

    let fileCount = 0;
    function countFiles(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) countFiles(p);
        else fileCount++;
      }
    }
    countFiles(stagedSkill);
    const sizeKb = Math.round((fs.statSync(resolvedZip).size / 1024) * 10) / 10;
    return { zipPath: resolvedZip, fileCount, sizeKb };
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const { flags } = parseArgs(process.argv.slice(2));
  const defaultOut = path.join(path.dirname(resolveWorkspaceDir()), 'unbroken-motion.zip');
  const outPath = flags.out ? path.resolve(String(flags.out)) : defaultOut;
  const res = packageSkillZip(outPath);
  console.log(
    `Packaged skill archive: ${res.zipPath} (${res.fileCount} files, ${res.sizeKb} KB)`
  );
}
