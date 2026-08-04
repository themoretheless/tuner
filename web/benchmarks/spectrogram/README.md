# Canvas spectrogram A/B benchmark

This benchmark compares the removed legacy Canvas loop with the production
incremental Canvas renderer. The legacy implementation exists only in this
fixture and is not reachable from the application or its production bundle.

Run the reproducible default workload from `web/`:

```sh
npm run benchmark:spectrogram
```

The JSON report is written to
`web/benchmark-results/spectrogram-ab.json` (an ignored directory). It records
browser/version, viewport, DPR, canvas size, fixed PRNG seed, FFT bin count,
target update rate, warmup, measured duration, run count and alternating A/B
order. Each run includes CPU draw-dispatch distributions, draw-dispatch
intervals, missed target slots/rate, target versus elapsed duration and Long
Task API totals when supported. Long tasks are observed only during the timed
phase and drained after a bounded rAF/macrotask flush.
These are main-thread dispatch measurements, not GPU presentation timings.

The strict default is 10 paired runs per variant, 15 seconds warmup and 60
seconds measured work at 60 Hz. Runs use a seeded balanced ABBA order on fresh
pages. Both variants submit exactly the same fixed number of frames; the report
contains expected/submitted counts and first/last sequence IDs. The primary
comparison is the paired delta of mean CPU dispatch time, summarized by its
median and a deterministic bootstrap-of-the-median 95% confidence interval.
Absolute milliseconds and relative `(optimized - legacy) / legacy` deltas are
reported separately. Only a complete default-or-stronger run with a full
150-column warmup is `decisionEligible`; shorter overrides are labelled
`smoke`, return a null summary and are non-authoritative.

Before timing, a separate fixed 150-frame correctness phase records a pixel
checksum plus a red low-frequency impulse at the bottom, a green
high-frequency impulse at the top, and a hot newest-frame probe on the right.
Legacy and optimized
checksums are expected to differ: the optimized renderer intentionally removes
overlapping `fillRect` cells and uses a nearest-neighbor bitmap, while both
bands must contain signal. The frozen legacy source has its own SHA-256 in the
report, alongside commit/dirty state, production build mode, browser, OS,
headless GPU string, viewport, CSS canvas and backing-store dimensions.

Useful environment overrides:

```sh
SPECTROGRAM_BENCHMARK_RUNS=3 \
SPECTROGRAM_BENCHMARK_WARMUP_MS=500 \
SPECTROGRAM_BENCHMARK_DURATION_MS=2000 \
SPECTROGRAM_BENCHMARK_RATE_HZ=60 \
SPECTROGRAM_BENCHMARK_DPR=2 \
npm run benchmark:spectrogram
```

For a quick harness smoke:

```sh
SPECTROGRAM_BENCHMARK_RUNS=1 \
SPECTROGRAM_BENCHMARK_WARMUP_MS=100 \
SPECTROGRAM_BENCHMARK_DURATION_MS=300 \
npm run benchmark:spectrogram
```

Do not compare reports from different browser builds, machines, viewport/DPR,
power states or workload metadata as if they were equivalent.

CDP tracing is deliberately not part of this stable harness. A separate
headed/real-GPU target trace remains required before making claims about GPU
presentation or compositor cost; SwiftShader/headless results only support the
CPU dispatch comparison reported here.
