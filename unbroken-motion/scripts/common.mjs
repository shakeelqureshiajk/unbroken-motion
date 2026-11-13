import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SKILL_ROOT = path.resolve(__dirname, '..');
export const REFERENCES_DIR = path.join(SKILL_ROOT, 'references');
export const BRANDS_DIR = path.join(REFERENCES_DIR, 'brands');
export const SCHEMA_DIR = path.join(SKILL_ROOT, 'schema');
export const TEMPLATES_DIR = path.join(SKILL_ROOT, 'templates');
export const STARTER_TEMPLATE_DIR = path.join(TEMPLATES_DIR, 'starter');
export const EXAMPLES_DIR = path.join(SKILL_ROOT, 'examples');
export const AGENTS_CONFIG_PATH = path.join(SKILL_ROOT, 'agents.config.json');
export const MIN_NODE_MAJOR = 22;
export const MIN_NODE_MINOR = 6;
export const MIN_NODE_VERSION = `${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0`;

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function isPathInside(childPath, parentPath) {
  const rel = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

/**
 * Resolves the writable film workspace directory outside SKILL_ROOT:
 * 1. Explicit directory argument (--workspace / --out)
 * 2. UNBROKEN_MOTION_WORKSPACE environment variable
 * 3. <cwd>/unbroken-motion-films (or project root above .agents/.claude/.codex if cwd is inside SKILL_ROOT)
 */
export function resolveWorkspaceDir(explicitWorkspace = null) {
  if (explicitWorkspace && typeof explicitWorkspace === 'string') {
    const resolved = path.resolve(explicitWorkspace);
    if (isPathInside(resolved, SKILL_ROOT)) {
      throw new Error(
        `Refusing to use workspace inside skill directory (${resolved}). Choose a path outside ${SKILL_ROOT}.`
      );
    }
    return resolved;
  }

  if (process.env.UNBROKEN_MOTION_WORKSPACE) {
    const envWs = path.resolve(process.env.UNBROKEN_MOTION_WORKSPACE);
    if (!isPathInside(envWs, SKILL_ROOT)) {
      return envWs;
    }
  }

  const cwd = process.cwd();
  if (!isPathInside(cwd, SKILL_ROOT)) {
    return path.join(cwd, 'unbroken-motion-films');
  }

  // If invoked while cwd is inside SKILL_ROOT, climb out of <project>/.<agent>/skills/unbroken-motion
  const maybeSkillsDir = path.dirname(SKILL_ROOT);
  const maybeAgentDir = path.dirname(maybeSkillsDir);
  const maybeProjectRoot = path.dirname(maybeAgentDir);
  const home = os.homedir();

  if (
    path.basename(maybeSkillsDir) === 'skills' &&
    path.resolve(maybeProjectRoot) !== path.resolve(home) &&
    !isPathInside(maybeProjectRoot, SKILL_ROOT)
  ) {
    return path.join(maybeProjectRoot, 'unbroken-motion-films');
  }

  return path.join(home, 'unbroken-motion-films');
}

export function ensureWorkingDirOutsideSkill(filmDir = null) {
  if (isPathInside(process.cwd(), SKILL_ROOT)) {
    const safeDir =
      filmDir && !isPathInside(filmDir, SKILL_ROOT)
        ? path.dirname(path.resolve(filmDir))
        : resolveWorkspaceDir();
    ensureDir(safeDir);
    process.chdir(safeDir);
  }
}

export function copyStarterTemplate(destDir) {
  ensureDir(destDir);
  const skipNames = new Set([
    'node_modules',
    'out',
    '.remotion',
    'stills',
    'audio',
    'manifest.json',
    '.final-passes',
    '.tmp',
  ]);

  function copyRecursive(src, dst) {
    ensureDir(dst);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (skipNames.has(entry.name)) continue;
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) copyRecursive(s, d);
      else fs.copyFileSync(s, d);
    }
  }

  copyRecursive(STARTER_TEMPLATE_DIR, destDir);
}

export function materializeExampleToDir(exampleSlug, targetDir) {
  const exampleDir = path.join(EXAMPLES_DIR, exampleSlug);
  if (!fs.existsSync(exampleDir)) {
    throw new Error(`Example "${exampleSlug}" not found in ${EXAMPLES_DIR}`);
  }
  copyStarterTemplate(targetDir);
  for (const rel of ['beats.json', path.join('src', 'scene.ts'), path.join('src', 'brand.json')]) {
    const srcFile = path.join(exampleDir, rel);
    if (fs.existsSync(srcFile)) {
      const dstFile = path.join(targetDir, rel);
      ensureDir(path.dirname(dstFile));
      fs.copyFileSync(srcFile, dstFile);
    }
  }
  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = readJson(pkgPath);
    pkg.name = `unbroken-motion-${exampleSlug.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}`;
    writeJson(pkgPath, pkg);
  }
  return targetDir;
}

export function resolveFilmDir(filmArg, options = {}) {
  if (!filmArg || typeof filmArg !== 'string') {
    throw new Error('Missing --film <name-or-path> argument.');
  }

  const workspaceDir = resolveWorkspaceDir(options.workspace);

  if (
    path.isAbsolute(filmArg) ||
    filmArg.includes('/') ||
    filmArg.includes('\\') ||
    fs.existsSync(filmArg)
  ) {
    const resolved = path.resolve(filmArg);
    if (isPathInside(resolved, EXAMPLES_DIR)) {
      const slug = path.basename(resolved);
      const target = path.join(workspaceDir, slug);
      if (!fs.existsSync(path.join(target, 'src', 'index.ts'))) {
        materializeExampleToDir(slug, target);
      }
      return target;
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`Film directory not found: ${resolved}`);
    }
    return resolved;
  }

  const wsFilmPath = path.join(workspaceDir, filmArg);
  if (fs.existsSync(wsFilmPath)) {
    if (!fs.existsSync(path.join(wsFilmPath, 'src', 'index.ts')) && fs.existsSync(path.join(EXAMPLES_DIR, filmArg))) {
      materializeExampleToDir(filmArg, wsFilmPath);
    }
    return wsFilmPath;
  }

  const examplePath = path.join(EXAMPLES_DIR, filmArg);
  if (fs.existsSync(examplePath)) {
    return materializeExampleToDir(filmArg, wsFilmPath);
  }

  throw new Error(
    `Film "${filmArg}" not found at ${wsFilmPath} (and no matching example in ${EXAMPLES_DIR}).`
  );
}

export function resolveSfxDir(filmDir = null) {
  if (process.env.UNBROKEN_MOTION_SFX_DIR) {
    const custom = path.resolve(process.env.UNBROKEN_MOTION_SFX_DIR);
    if (!isPathInside(custom, SKILL_ROOT)) return custom;
  }
  if (filmDir && !isPathInside(filmDir, SKILL_ROOT)) {
    return path.join(path.dirname(path.resolve(filmDir)), '.cache', 'sfx');
  }
  return path.join(resolveWorkspaceDir(), '.cache', 'sfx');
}

export function parseBrandFile(brandId) {
  const brandPath = path.join(BRANDS_DIR, `${brandId}.md`);
  if (!fs.existsSync(brandPath)) {
    throw new Error(`Brand manifest not found: ${brandPath}`);
  }
  const md = fs.readFileSync(brandPath, 'utf8').replace(/^\uFEFF/, '');
  const match = md.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`Brand file missing JSON frontmatter (--- ... ---): ${brandPath}`);
  }
  const tokens = JSON.parse(match[1]);
  return { tokens, brandPath };
}

export function syncFilmBrandJson(filmDir, brandId) {
  const { tokens, brandPath } = parseBrandFile(brandId);
  const targetPath = path.join(filmDir, 'src', 'brand.json');
  writeJson(targetPath, tokens);
  return { tokens, brandPath, targetPath };
}

/**
 * Pure-Node JSON Schema Draft 2020-12 validator for beats.schema.json & brand.schema.json.
 */
export function validateAgainstSchema(data, schema, instancePath = '$') {
  const errors = [];

  if (schema.type !== undefined) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType =
      data === null
        ? 'null'
        : Array.isArray(data)
        ? 'array'
        : typeof data === 'number'
        ? Number.isInteger(data)
          ? 'integer'
          : 'number'
        : typeof data;

    const typeMatches = allowedTypes.some((t) => {
      if (t === 'number') return actualType === 'number' || actualType === 'integer';
      return t === actualType;
    });

    if (!typeMatches) {
      errors.push(`${instancePath}: expected type ${allowedTypes.join('|')}, got ${actualType}`);
      return errors;
    }
  }

  if (schema.enum !== undefined) {
    if (!schema.enum.includes(data)) {
      errors.push(`${instancePath}: value ${JSON.stringify(data)} not in enum [${schema.enum.join(', ')}]`);
    }
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${instancePath}: string length ${data.length} < minLength ${schema.minLength}`);
    }
    if (schema.pattern !== undefined) {
      const re = new RegExp(schema.pattern);
      if (!re.test(data)) {
        errors.push(`${instancePath}: "${data}" does not match pattern ${schema.pattern}`);
      }
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${instancePath}: ${data} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${instancePath}: ${data} > maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${instancePath}: array length ${data.length} < minItems ${schema.minItems}`);
    }
    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        errors.push(...validateAgainstSchema(data[i], schema.items, `${instancePath}[${i}]`));
      }
    }
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (!(reqKey in data) || data[reqKey] === undefined) {
          errors.push(`${instancePath}: missing required property "${reqKey}"`);
        }
      }
    }

    const props = schema.properties ?? {};
    for (const [key, val] of Object.entries(data)) {
      if (key in props) {
        errors.push(...validateAgainstSchema(val, props[key], `${instancePath}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${instancePath}: unexpected property "${key}"`);
      }
    }
  }

  return errors;
}

function getCandidateCompositorNames() {
  const plat = process.platform;
  const arch = process.arch;
  const preferred = [
    `compositor-${plat}-${arch}`,
    `compositor-${plat}-${arch}-gnu`,
    `compositor-${plat}-${arch}-musl`,
  ];
  return preferred;
}

function findExecutableInDir(rootDir, exeName) {
  if (!fs.existsSync(rootDir)) return null;
  const direct = path.join(rootDir, exeName);
  if (fs.existsSync(direct)) return direct;

  try {
    const preferredNames = getCandidateCompositorNames();
    for (const pref of preferredNames) {
      const candidate = path.join(rootDir, pref, exeName);
      if (fs.existsSync(candidate)) return candidate;
    }

    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(rootDir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === exeName.toLowerCase()) {
        return full;
      }
      if (entry.isDirectory() && (entry.name.includes('compositor') || entry.name.includes('ffmpeg'))) {
        const nested = findExecutableInDir(full, exeName);
        if (nested) return nested;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function checkOnPath(cmd) {
  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const out = execFileSync(locator, [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

function collectNodeModulesSearchDirs(startDir) {
  const dirs = [];
  if (!startDir) return dirs;
  let curr = path.resolve(startDir);
  for (let depth = 0; depth < 5; depth++) {
    dirs.push(path.join(curr, 'node_modules', '@remotion'));
    dirs.push(path.join(curr, 'node_modules', 'ffmpeg-static'));
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return dirs;
}

/**
 * Resolves ffmpeg and ffprobe binaries from env vars, system PATH, or bundled Remotion compositor
 * across Windows, macOS, and Linux (x64 & arm64).
 */
export function resolveFfmpegBinaries(filmDir = null) {
  const isWin = process.platform === 'win32';
  const ffmpegExe = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const ffprobeExe = isWin ? 'ffprobe.exe' : 'ffprobe';

  const searchDirs = [
    ...collectNodeModulesSearchDirs(filmDir),
    ...collectNodeModulesSearchDirs(resolveWorkspaceDir()),
    ...collectNodeModulesSearchDirs(process.cwd()),
  ];

  let ffmpeg = process.env.FFMPEG_PATH || checkOnPath('ffmpeg');
  if (!ffmpeg) {
    for (const dir of searchDirs) {
      ffmpeg = findExecutableInDir(dir, ffmpegExe);
      if (ffmpeg) break;
    }
  }

  let ffprobe = process.env.FFPROBE_PATH || checkOnPath('ffprobe');
  if (!ffprobe && ffmpeg) {
    const sibling = path.join(path.dirname(ffmpeg), ffprobeExe);
    if (fs.existsSync(sibling)) ffprobe = sibling;
  }
  if (!ffprobe) {
    for (const dir of searchDirs) {
      ffprobe = findExecutableInDir(dir, ffprobeExe);
      if (ffprobe) break;
    }
  }

  return { ffmpeg, ffprobe };
}

export function runBin(binPath, args, options = {}) {
  return execFileSync(binPath, args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}

export function resolutionForAspect(aspectRatio, final4K = false) {
  if (final4K) {
    switch (aspectRatio) {
      case '9:16':
        return { width: 2160, height: 3840 };
      case '1:1':
        return { width: 2160, height: 2160 };
      case '16:9':
      default:
        return { width: 3840, height: 2160 };
    }
  }
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
    default:
      return { width: 1920, height: 1080 };
  }
}
