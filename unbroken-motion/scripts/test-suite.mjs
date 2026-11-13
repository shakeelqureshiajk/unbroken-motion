#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EXAMPLES_DIR,
  SKILL_ROOT,
  STARTER_TEMPLATE_DIR,
  copyStarterTemplate,
  materializeExampleToDir,
  readJson,
  resolveWorkspaceDir,
  syncFilmBrandJson,
  writeJson,
} from './common.mjs';
import { generateManifestForFilm } from './manifest.mjs';
import { runVerification } from './verify.mjs';

function snapshotSkillTree(dir) {
  const entries = [];
  function walk(curr) {
    for (const e of fs.readdirSync(curr, { withFileTypes: true })) {
      const full = path.join(curr, e.name);
      if (e.isDirectory()) walk(full);
      else {
        const st = fs.statSync(full);
        entries.push(`${path.relative(SKILL_ROOT, full)}:${st.size}:${Math.round(st.mtimeMs)}`);
      }
    }
  }
  walk(dir);
  return entries.sort().join('\n');
}

async function testMalformedBeatSheets(tmpRoot) {
  console.log('1. Testing 5 malformed beat sheets against Gate G1 (--schema-only)...');
  const baseBeats = readJson(path.join(STARTER_TEMPLATE_DIR, 'beats.json'));

  const cases = [
    {
      name: 'missing-seed',
      mutate: (b) => { delete b.seed; },
      expectMatch: /seed/,
    },
    {
      name: 'timeline-gap',
      mutate: (b) => { b.beats[1].start += 0.5; },
      expectMatch: /Timeline gap/,
    },
    {
      name: 'missing-handoff',
      mutate: (b) => { delete b.beats[0].handoff; },
      expectMatch: /missing required "handoff"/,
    },
    {
      name: 'broken-carry-graph',
      mutate: (b) => { b.beats[0].handoff.targetActor = 'nonExistentActor'; },
      expectMatch: /targetActor "nonExistentActor" not present/,
    },
    {
      name: 'window-too-long',
      mutate: (b) => { b.beats[0].handoff.windowSec = 0.9; },
      expectMatch: /windowSec.*exceeds/,
    },
  ];

  for (const tc of cases) {
    const dir = path.join(tmpRoot, tc.name);
    copyStarterTemplate(dir);
    const mutated = structuredClone(baseBeats);
    tc.mutate(mutated);
    writeJson(path.join(dir, 'beats.json'), mutated);

    const res = await runVerification(dir, { schemaOnly: true });
    assert.equal(res.passed, false, `Expected ${tc.name} to fail G1`);
    const joined = res.gates[0].details.join('\n');
    assert.match(joined, tc.expectMatch, `Expected ${tc.name} error matching ${tc.expectMatch}, got:\n${joined}`);
    console.log(`   [OK] ${tc.name} failed with: ${res.gates[0].details[0]}`);
  }
}

async function testGate7Violations(tmpRoot) {
  console.log('2. Testing Gate G7 brand isolation & determinism catches...');
  const dir = path.join(tmpRoot, 'g7-leak');
  copyStarterTemplate(dir);

  const scenePath = path.join(dir, 'src', 'scene.ts');
  const orig = fs.readFileSync(scenePath, 'utf8');
  const tainted = orig.replace(
    'backgroundColor: bg,',
    "backgroundColor: '#FBF7F0', // leaked warm-editorial color\n      /* Math.random() useCurrentFrame() */"
  );
  fs.writeFileSync(scenePath, tainted, 'utf8');

  await generateManifestForFilm(dir);
  const res = await runVerification(dir, { requireAudio: false });
  const g7 = res.gates.find((g) => g.gate === 'G7');
  assert.equal(g7.passed, false, 'Expected G7 to fail on leaked color and banned calls');
  const msg = g7.details.join('\n');
  assert.match(msg, /unauthorized color #FBF7F0/);
  assert.match(msg, /hardcoded hex\/rgb/);
  assert.match(msg, /Math\.random/);
  assert.match(msg, /useCurrentFrame/);
  console.log('   [OK] G7 caught leaked color #FBF7F0, hardcoded hex, Math.random(), and raw useCurrentFrame()');
}

async function testBrandSwitching(tmpRoot) {
  console.log('3. Testing dynamic brand token switching (obsidian-tech -> warm-editorial)...');
  const dir = path.join(tmpRoot, 'brand-switch');
  copyStarterTemplate(dir);

  const beatsPath = path.join(dir, 'beats.json');
  const beats = readJson(beatsPath);
  beats.brand = 'warm-editorial';
  writeJson(beatsPath, beats);

  const synced = syncFilmBrandJson(dir, 'warm-editorial');
  assert.equal(synced.tokens.id, 'warm-editorial');
  assert.equal(synced.tokens.colors.background, '#FBF7F0');

  await generateManifestForFilm(dir);
  const res = await runVerification(dir, { requireAudio: false });
  const g7 = res.gates.find((g) => g.gate === 'G7');
  assert.equal(g7.passed, true, `Expected warm-editorial switch to pass G7: ${g7.details.join('; ')}`);
  assert.equal(res.passed, true, 'Expected switched starter template to pass G1-G5 & G7');
  console.log('   [OK] Switched brand cleanly to warm-editorial (#FBF7F0) and passed G1-G5, G7');
}

async function testCalibrationCases(tmpRoot) {
  console.log('4. Testing slim calibration examples (_calibration-bad-slideshow vs _calibration-good-carry)...');
  const badDir = materializeExampleToDir('_calibration-bad-slideshow', path.join(tmpRoot, '_calibration-bad-slideshow'));
  const goodDir = materializeExampleToDir('_calibration-good-carry', path.join(tmpRoot, '_calibration-good-carry'));

  await generateManifestForFilm(badDir);
  const badRes = await runVerification(badDir, { requireAudio: false });
  assert.equal(badRes.passed, false, '_calibration-bad-slideshow MUST fail verification');
  const g2 = badRes.gates.find((g) => g.gate === 'G2');
  const g3 = badRes.gates.find((g) => g.gate === 'G3');
  assert.equal(g2.passed, false, '_calibration-bad-slideshow MUST fail G2 continuity');
  assert.equal(g3.passed, false, '_calibration-good-carry MUST fail G3 rhythm');
  console.log(`   [OK] _calibration-bad-slideshow FAILED as expected (carryScore=${g2.carryScore}, ${g3.summary})`);

  await generateManifestForFilm(goodDir);
  const goodRes = await runVerification(goodDir, { requireAudio: false });
  assert.equal(goodRes.passed, true, `_calibration-good-carry MUST pass verification: ${JSON.stringify(goodRes.gates, null, 2)}`);
  assert.equal(goodRes.carryScore, 1, '_calibration-good-carry carryScore must be 1.0');
  console.log(`   [OK] _calibration-good-carry PASSED (carryScore=${goodRes.carryScore})`);
}

async function testBenchmarkFilms(tmpRoot) {
  console.log('5. Verifying all slim benchmark & showcase examples (G1-G7)...');
  const films = [
    'smoke-test',
    '01-single-seed',
    '02-ui-workflow',
    '03-brand-reel-vertical',
    '04-agentic-ai',
    '05-content-creation',
  ];
  const activeWs = resolveWorkspaceDir();

  for (const slug of films) {
    assert.equal(
      fs.existsSync(path.join(EXAMPLES_DIR, slug)),
      true,
      `Missing slim example: ${slug}`
    );
    const dir = materializeExampleToDir(slug, path.join(tmpRoot, slug));
    await generateManifestForFilm(dir);

    const wsDraft = path.join(activeWs, slug, 'out', 'draft.mp4');
    const hasDraft = fs.existsSync(wsDraft);
    const res = await runVerification(dir, {
      requireAudio: hasDraft,
      videoPath: hasDraft ? wsDraft : undefined,
    });
    assert.equal(
      res.passed,
      true,
      `Benchmark ${slug} failed verification:\n${res.gates.filter((g) => !g.passed).map((g) => `  ${g.gate}: ${g.summary} (${g.details.join('; ')})`).join('\n')}`
    );
    assert.equal(res.carryScore, 1, `${slug} carryScore must equal 1.0`);
    console.log(`   [OK] ${slug}: ALL GATES PASSED (carryScore=1.0, audio=${hasDraft ? 'verified-mp4' : 'skipped'})`);
  }
}

async function main() {
  const beforeSnap = snapshotSkillTree(SKILL_ROOT);
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'um-tests-'));
  try {
    await testMalformedBeatSheets(tmpRoot);
    await testGate7Violations(tmpRoot);
    await testBrandSwitching(tmpRoot);
    await testCalibrationCases(tmpRoot);
    await testBenchmarkFilms(tmpRoot);

    const afterSnap = snapshotSkillTree(SKILL_ROOT);
    assert.equal(
      afterSnap,
      beforeSnap,
      'Read-only skill folder violation: files inside SKILL_ROOT were created or modified during test-suite execution!'
    );
    console.log('6. [OK] Read-only SKILL_ROOT invariant verified (zero files added or modified inside skill package).');
    console.log('\nALL TEST SUITE ASSERTIONS PASSED.\n');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
