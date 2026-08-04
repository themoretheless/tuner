#!/usr/bin/env node
// Zero-network release gate (M8).
//
// Доказывает для релизной конфигурации, что приложение не ходит в сеть:
//  1. В собранном фронтенде (web/dist) нет внешних URL (http/https/ws/wss)
//     вне явного allowlist.
//  2. В исходниках web/src нет внешних URL вне allowlist и нет сетевых
//     API (fetch / WebSocket / EventSource / sendBeacon / XMLHttpRequest).
//  3. В native egui-клиенте не используются сетевые API. Native-приложение
//     работает напрямую с audio-input/pitch-core и не содержит webview.
//
// Запуск: node scripts/check-no-network.mjs [--dist-only]
// Требование: web/dist уже собран (`npm run build` в web/).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// URL-литералы, которые не являются сетевыми вызовами:
//  - XML/SVG-неймспейсы w3.org (идентификаторы, не запросы);
//  - vuejs.org error-reference — строка внутри рантайма Vue для сообщений
//    об ошибках (шаблон ссылки в тексте ошибки, запрос не выполняется).
const URL_ALLOWLIST = [
  /^https?:\/\/www\.w3\.org\//,
  /^https:\/\/vuejs\.org\/error-reference\//,
];

const URL_RE = /\b(?:https?|wss?):\/\/[^\s"'`)\]<>\\]+/g;
const NETWORK_API_RE = /\b(?:fetch\s*\(|new\s+WebSocket|new\s+EventSource|sendBeacon\s*\(|XMLHttpRequest)\b/;
const SCANNED_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.vue', '.html', '.css', '.json', '.webmanifest', '.map']);

const failures = [];
const notes = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function scanUrls(dir, label) {
  for (const file of walk(dir)) {
    if (!SCANNED_EXT.has(extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(URL_RE)) {
      const url = match[0].replace(/[.,;:'"]+$/, '');
      if (URL_ALLOWLIST.some((re) => re.test(url))) {
        notes.push(`allowlist: ${relative(ROOT, file)} -> ${url}`);
      } else {
        failures.push(`${label}: внешний URL ${url} в ${relative(ROOT, file)}`);
      }
    }
  }
}

function scanNetworkApis(dir, label) {
  for (const file of walk(dir)) {
    if (!['.ts', '.vue', '.js', '.mjs'].includes(extname(file))) continue;
    // Сгенерированный wasm-bindgen glue (web/public/wasm) использует fetch()
    // для загрузки .wasm с СОБСТВЕННОГО origin — это не выход в сеть наружу;
    // внешние URL в нём всё равно ловит scanUrls выше.
    if (label === 'public' && relative(ROOT, file).startsWith(join('web', 'public', 'wasm'))) continue;
    const text = readFileSync(file, 'utf8');
    if (NETWORK_API_RE.test(text)) {
      failures.push(`${label}: сетевое API (${NETWORK_API_RE}) в ${relative(ROOT, file)}`);
    }
  }
}

// --- 1. web/dist -------------------------------------------------------------
const distDir = join(ROOT, 'web', 'dist');
if (!existsSync(distDir)) {
  failures.push('web/dist не найден — сначала соберите фронтенд (npm run build в web/)');
} else {
  scanUrls(distDir, 'dist');
}

// --- 2. web/src ---------------------------------------------------------------
scanUrls(join(ROOT, 'web', 'src'), 'src');
scanNetworkApis(join(ROOT, 'web', 'src'), 'src');
scanUrls(join(ROOT, 'web', 'public'), 'public');
scanNetworkApis(join(ROOT, 'web', 'public'), 'public');

// --- 3. Rust-часть shipped native graph ---------------------------------------
// Scan every first-party crate linked into the native executable, not only the
// UI crate. This keeps the offline claim true when code moves across boundaries.
const nativeSourceDirs = ['egui', 'audio-input', 'pitch-core']
  .map((crate) => join(ROOT, crate, 'src'));
for (const sourceDir of nativeSourceDirs) {
  scanNetworkApis(sourceDir, 'native-rust-src');
  for (const file of walk(sourceDir)) {
    if (extname(file) !== '.rs') continue;
    const text = readFileSync(file, 'utf8');
    if (/\b(TcpStream|TcpListener|UdpSocket|reqwest|hyper::|tokio::net|std::net)\b/.test(text)) {
      failures.push(`native-rust-src: сетевой API в ${relative(ROOT, file)}`);
    }
  }
}

// --- Итог ----------------------------------------------------------------------
for (const note of notes) console.log(`  ok: ${note}`);
if (failures.length) {
  console.error('\nZERO-NETWORK GATE FAILED:');
  for (const f of failures) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
console.log('\nZero-network gate: OK — внешних сетевых вызовов не обнаружено.');
