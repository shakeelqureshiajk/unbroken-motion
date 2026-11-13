import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
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
export const CASES_DIR = path.join(SKILL_ROOT, 'cases');
export const ASSETS_DIR = path.join(SKILL_ROOT, 'assets');
export const SFX_DIR = path.join(ASSETS_DIR, 'sfx');

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
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

export function resolveFilmDir(filmArg) {
  if (!filmArg || typeof filmArg !== 'string') {
    throw new Error('Missing --film <name-or-path> argument.');
  }
  if (
    path.isAbsolute(filmArg) ||
    filmArg.includes('/') ||
    filmArg.includes('\\') ||
    fs.existsSync(filmArg)
  ) {
    const resolved = path.resolve(filmArg);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Film directory not found: ${resolved}`);
    }
    return resolved;
  }
  const casePath = path.join(CASES_DIR, filmArg);
  if (!fs.existsSync(casePath)) {
    throw new Error(`Film case not found: ${casePath}`);
  }
  return casePath;
}

export function parseBrandFile(brandId) {
  const brandPath = path.join(BRANDS_DIR, `${brandId}.md`);
  if (!fs.existsSync(brandPath)) {
    throw new Error(`Brand manifest not found: ${brandPath}`);
  }
  const md = fs.readFileSync(brandPath, 'utf8');
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

function findExecutableInDir(rootDir, exeName) {
  if (!fs.existsSync(rootDir)) return null;
  const direct = path.join(rootDir, exeName);
  if (fs.existsSync(direct)) return direct;

  try {
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

/**
 * Resolves ffmpeg and ffprobe binaries from env vars, system PATH, or bundled Remotion compositor.
 */
export function resolveFfmpegBinaries(filmDir = null) {
  const isWin = process.platform === 'win32';
  const ffmpegExe = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const ffprobeExe = isWin ? 'ffprobe.exe' : 'ffprobe';

  const searchDirs = [];
  if (filmDir) {
    searchDirs.push(path.join(filmDir, 'node_modules', '@remotion'));
    searchDirs.push(path.join(filmDir, 'node_modules', 'ffmpeg-static'));
  }
  searchDirs.push(path.join(STARTER_TEMPLATE_DIR, 'node_modules', '@remotion'));
  searchDirs.push(path.join(STARTER_TEMPLATE_DIR, 'node_modules', 'ffmpeg-static'));

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

