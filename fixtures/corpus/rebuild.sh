#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
MANIFEST="$ROOT/manifest.json"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

for command in curl ffmpeg jq shasum; do
  command -v "$command" >/dev/null || {
    printf 'missing required command: %s\n' "$command" >&2
    exit 1
  }
done

jq -c '.captures[]' "$MANIFEST" | while IFS= read -r entry; do
  id=$(jq -r '.id' <<<"$entry")
  url=$(jq -r '.source.sourceUrl' <<<"$entry")
  source_hash=$(jq -r '.source.sourceSha256' <<<"$entry")
  output_hash=$(jq -r '.captureSha256' <<<"$entry")
  output=$(jq -r '.capture' <<<"$entry")
  trim=$(jq -r '.transform.sourceTrimSeconds' <<<"$entry")
  lead=$(jq -r '.transform.leadingSilenceSeconds' <<<"$entry")
  duration=$(jq -r '.transform.durationSeconds' <<<"$entry")
  source="$WORK/$id.source"
  rebuilt="$WORK/$id.wav"

  curl --fail --location --silent --show-error "$url" -o "$source"
  printf '%s  %s\n' "$source_hash" "$source" | shasum -a 256 --check --status
  ffmpeg -hide_banner -loglevel error -y -i "$source" \
    -af "atrim=start=$trim,asetpts=PTS-STARTPTS,adelay=$(awk -v value="$lead" 'BEGIN { printf "%.0f", value * 1000 }'):all=1,apad" \
    -t "$duration" -ar 48000 -ac 1 -c:a pcm_s16le "$rebuilt"
  printf '%s  %s\n' "$output_hash" "$rebuilt" | shasum -a 256 --check --status || {
    actual=$(shasum -a 256 "$rebuilt" | awk '{print $1}')
    printf '%s output hash differs: expected %s, got %s\n' "$id" "$output_hash" "$actual" >&2
    exit 1
  }
  cp "$rebuilt" "$ROOT/$output"
done
