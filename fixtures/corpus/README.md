# Real-instrument pitch corpus v1

This directory is the checked-in, redistribution-safe release gate for the
tuner pipeline. It contains 19 isolated real recordings covering every
standard string of guitar, bass, ukulele and violin, plus one voice scenario.
Synthetic tones remain unit-test fixtures; they are not treated as evidence of
real-instrument quality.

## Layout

- `manifest.json` is the versioned source of truth for coverage, provenance,
  source/output SHA-256 hashes, deterministic transforms, phase annotations,
  detector configuration and quality thresholds.
- `audio/*.wav` contains mono 48 kHz PCM16 derivatives used by CI without a
  network connection.
- `rebuild.sh` downloads the exact sources, verifies their hashes, applies the
  manifest transforms and verifies every rebuilt WAV hash before replacing it.
- `LICENSES.md` records attribution and redistribution terms.

## Run the gate

```sh
cargo run --release -p pitch-core --example quality -- \
  --check --corpus fixtures/corpus/manifest.json \
  > pitch-quality-report.json
```

Exit code `0` means every capture passes. Exit code `2` means at least one
threshold failed; the JSON report identifies the capture, metric, observed
value and limit. It also embeds the effective thresholds, guidance mode,
source/output hashes and license links. CI always uploads this report as
`pitch-quality-report`.

## Rebuild

The rebuild requires `curl`, `ffmpeg`, `jq` and `shasum`:

```sh
fixtures/corpus/rebuild.sh
```

The script never updates hashes. A changed source, transform, FFmpeg output or
manifest therefore fails closed and must be reviewed explicitly.

## Annotation policy

- Attack and audible-release boundaries were detected at `-42 dB` and checked
  against the pitch contour.
- Stable frequency is the median from `librosa.yin 0.11.0` over the annotated
  sustain (`4096` sample frame, `256` sample hop, `30-900 Hz`).
- The release gate runs in `tuningTargets` mode because these are known open
  strings; this exercises the same harmonic guidance used by instrument mode.
- The default correctness tolerance is `8 cents`. `uke-a4` uses `35 cents` for
  its measured sharp-to-stable attack bend. `voice-f4` uses the conventional
  `50 cents` raw-pitch tolerance and a `30 cents` sustain-MAE limit for its
  natural glide. These overrides are local and visible in the manifest.
- Corpus v1 contains independent single-note captures. It gates acquisition,
  false locks, note switching, sustain error and coverage; the evaluator's
  reacquisition metrics still need dedicated multi-segment transition files.

## Adding a capture

1. Confirm that redistribution is permitted and add complete source/license
   metadata and the source SHA-256.
2. Add a deterministic `transform`, rebuild the WAV and record its SHA-256.
3. Annotate attack, stable sustain and release using an independent analyzer.
4. Add the required instrument/note pair and scenario thresholds.
5. Run the gate and review the full per-capture report before committing.
