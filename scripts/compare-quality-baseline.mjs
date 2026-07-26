// Differential baseline gate for the pitch quality corpus report.
//
// The quality example (--check) answers only "is each metric under its
// absolute threshold?". Degradation that stays *within* the threshold is
// invisible. This script compares a fresh report (schema v2) against a
// committed baseline snapshot (fixtures/quality-baseline.json) and fails
// when any metric degrades beyond a per-metric budget.
//
// Usage:
//   node scripts/compare-quality-baseline.mjs --update --report report.json
//       Regenerate fixtures/quality-baseline.json from a fresh passing report.
//       Do this only from a known-good reference (e.g. after merging DSP
//       changes that intentionally shift metrics).
//   node scripts/compare-quality-baseline.mjs --report report.json
//       Compare report against the committed baseline. Exit 0 = within
//       budget, exit 1 = budget exceeded or structural mismatch.
//
// Degradation budgets (per capture id x condition, condition = clean |
// snr:<dB> | reverb:<rt60>s). Rationale: the absolute thresholds in the
// corpus manifest are ~4x above observed values, so budget gates sit far
// below them and catch slow drift early while tolerating deterministic-run
// noise (float rounding across compilers/CPUs is sub-0.01 cent).
//
//   stableSustainCentsMae / stableSustainCentsP95:
//       relative +5% OR absolute +0.10 cents, whichever is larger.
//       (5% of ~2.4-cent MAE ~ 0.12 cents; the absolute floor keeps
//       near-zero p95 entries from being gated by rounding noise.)
//   timeToFirstCorrectMs:
//       relative +10% OR absolute +50 ms, whichever is larger.
//       (hop-quantized at 33 ms; 50 ms ~ 1.5 hops.)
//   stableDetectionCoverage:
//       absolute drop of at most 0.01 (one percentage point).
//   falseLockRatio:
//       absolute increase of at most 0.02 (two percentage points).
//   octaveErrorRatio:
//       absolute increase of at most 0.005 (half a percentage point;
//       octave errors are the most severe failure class, so tightest budget).
//
// Improvements are always accepted and reported.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultBaselinePath = resolve(root, 'fixtures/quality-baseline.json');

const args = process.argv.slice(2);
function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) return null;
  return args[index + 1];
}
const update = args.includes('--update');
const reportPath = optionValue('--report');
const baselinePath = optionValue('--baseline') ?? defaultBaselinePath;
if (!reportPath) {
  console.error('usage: node scripts/compare-quality-baseline.mjs [--update] --report <report.json> [--baseline <baseline.json>]');
  process.exit(2);
}

// Relative metrics: fail when new > max(baseline * (1 + rel), baseline + abs).
const RELATIVE_BUDGETS = {
  maeCents: { rel: 0.05, abs: 0.10, label: 'MAE (cents)' },
  p95Cents: { rel: 0.05, abs: 0.10, label: 'p95 (cents)' },
  timeToFirstCorrectMs: { rel: 0.10, abs: 50.0, label: 'timeToFirstCorrect (ms)' },
};
// Absolute metrics: fail when new exceeds baseline +/- the absolute budget.
const ABSOLUTE_BUDGETS = {
  coverage: { budget: -0.01, label: 'coverage' },
  falseLockRatio: { budget: 0.02, label: 'falseLockRatio' },
  octaveErrorRatio: { budget: 0.005, label: 'octaveErrorRatio' },
};

function round(value, digits = 4) {
  if (value === null || value === undefined) return null;
  return Number(Number(value).toFixed(digits));
}

function extractMetrics(metrics) {
  return {
    maeCents: round(metrics.stableSustainCentsMae),
    p95Cents: round(metrics.stableSustainCentsP95),
    coverage: round(metrics.stableDetectionCoverage),
    falseLockRatio: round(metrics.falseLockRatio),
    octaveErrorRatio: round(metrics.octaveErrorRatio),
    timeToFirstCorrectMs: round(metrics.timeToFirstCorrectMs, 1),
  };
}

// Flatten a schema-v2 report into compact baseline entries keyed by
// `${captureId} | ${condition}`.
function flattenReport(report) {
  if (report.schemaVersion !== 2) {
    throw new Error(`expected report schemaVersion 2, got ${report.schemaVersion}`);
  }
  const entries = {};
  for (const capture of report.captures ?? []) {
    entries[`${capture.id} | clean`] = extractMetrics(capture.metrics);
    for (const level of capture.snrLevels ?? []) {
      entries[`${capture.id} | snr:${level.snrDb}dB`] = extractMetrics(level.metrics);
    }
    for (const condition of capture.reverbConditions ?? []) {
      entries[`${capture.id} | reverb:${condition.rt60Seconds}s`] = extractMetrics(condition.metrics);
    }
  }
  return entries;
}

const report = JSON.parse(await readFile(reportPath, 'utf8'));
const reportEntries = flattenReport(report);

if (update) {
  const baseline = {
    schemaVersion: 1,
    description:
      'Compact differential baseline for the pitch quality corpus. ' +
      'Regenerate from a known-good report with: ' +
      'node scripts/compare-quality-baseline.mjs --update --report <report.json>',
    budgets: {
      maeCents: 'max(baseline * 1.05, baseline + 0.10 cents)',
      p95Cents: 'max(baseline * 1.05, baseline + 0.10 cents)',
      timeToFirstCorrectMs: 'max(baseline * 1.10, baseline + 50 ms)',
      coverage: 'baseline - 0.01 (absolute)',
      falseLockRatio: 'baseline + 0.02 (absolute)',
      octaveErrorRatio: 'baseline + 0.005 (absolute)',
    },
    generatedFrom: {
      corpus: report.corpus,
      configRevision: report.configRevision,
      reportPassed: report.passed,
    },
    entries: reportEntries,
  };
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`baseline updated: ${baselinePath} (${Object.keys(reportEntries).length} entries)`);
  process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const baselineEntries = baseline.entries ?? {};

const rows = [];
let failures = 0;
const keys = new Set([...Object.keys(baselineEntries), ...Object.keys(reportEntries)]);
for (const key of [...keys].sort()) {
  const base = baselineEntries[key];
  const current = reportEntries[key];
  if (!base) {
    // New capture/condition: not a failure, but reported so the baseline
    // can be regenerated intentionally.
    rows.push({ key, status: 'NEW', detail: 'not in baseline; run --update to adopt' });
    continue;
  }
  if (!current) {
    failures += 1;
    rows.push({ key, status: 'MISSING', detail: 'present in baseline, absent in report' });
    continue;
  }
  const problems = [];
  const deltas = [];
  for (const [metric, { rel, abs, label }] of Object.entries(RELATIVE_BUDGETS)) {
    if (base[metric] === null || current[metric] === null) continue;
    const limit = Math.max(base[metric] * (1 + rel), base[metric] + abs);
    const delta = current[metric] - base[metric];
    if (Math.abs(delta) > 1e-9) deltas.push(`${label} ${fmt(delta, '+')}`);
    if (current[metric] > limit + 1e-9) {
      problems.push(`${label} ${current[metric]} > limit ${round(limit)} (baseline ${base[metric]})`);
    }
  }
  for (const [metric, { budget, label }] of Object.entries(ABSOLUTE_BUDGETS)) {
    if (base[metric] === null || current[metric] === null) continue;
    const delta = current[metric] - base[metric];
    if (Math.abs(delta) > 1e-9) deltas.push(`${label} ${fmt(delta, '+')}`);
    if (budget >= 0 && delta > budget + 1e-9) {
      problems.push(`${label} ${current[metric]} > limit ${round(base[metric] + budget)} (baseline ${base[metric]})`);
    }
    if (budget < 0 && delta < budget - 1e-9) {
      problems.push(`${label} ${current[metric]} < limit ${round(base[metric] + budget)} (baseline ${base[metric]})`);
    }
  }
  if (problems.length > 0) {
    failures += 1;
    rows.push({ key, status: 'DEGRADED', detail: problems.join('; ') });
  } else if (deltas.length > 0) {
    rows.push({ key, status: 'ok (changed)', detail: deltas.join(', ') });
  }
}

const compared = Object.keys(reportEntries).length;
console.log(`differential baseline gate: ${compared} conditions, baseline ${baselinePath}`);
for (const row of rows) {
  console.log(`  [${row.status}] ${row.key}: ${row.detail}`);
}
if (failures > 0) {
  console.error(`FAIL: ${failures} condition(s) degraded beyond budget`);
  process.exit(1);
}
console.log('PASS: all conditions within degradation budget');

function fmt(value, sign = '') {
  const prefix = sign && value >= 0 ? sign : '';
  return `${prefix}${round(value, 4)}`;
}
