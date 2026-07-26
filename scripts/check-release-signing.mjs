#!/usr/bin/env node
// Release-signing scaffolding gate (M8).
//
// Реальная подпись/нотаризация требует сертификатов и выполняется человеком
// (см. RELEASE-SIGNING.md). Этот скрипт проверяет комплектность scaffolding'а:
//  1. desktop/src-tauri/Info.plist существует и содержит описание доступа
//     к микрофону (NSMicrophoneUsageDescription).
//  2. desktop/src-tauri/entitlements.plist существует и содержит ТОЛЬКО
//     минимальные права (аудио-вход). Любые network-* entitlements запрещены
//     (см. zero-network гейт).
//  3. В tauri.conf.json плейсхолдеры подписи остаются null — реальные
//     identity/thumbprint в репозиторий не коммитим.
//  4. В git не закоммичены приватные ключи/сертификаты (*.p12, *.p8,
//     *.mobileprovision, *.key, *.pem, tauri-signing ключи).
//  5. RELEASE-SIGNING.md существует.
//
// Запуск: node scripts/check-release-signing.mjs

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const failures = [];

// --- 1. Info.plist -------------------------------------------------------------
const infoPlistPath = join(ROOT, 'desktop', 'src-tauri', 'Info.plist');
if (!existsSync(infoPlistPath)) {
  failures.push('desktop/src-tauri/Info.plist не найден');
} else {
  const info = readFileSync(infoPlistPath, 'utf8');
  if (!info.includes('NSMicrophoneUsageDescription')) {
    failures.push('Info.plist: отсутствует NSMicrophoneUsageDescription');
  }
  for (const banned of ['NSCameraUsageDescription', 'NSLocationUsageDescription', 'NSContactsUsageDescription']) {
    if (info.includes(banned)) failures.push(`Info.plist: лишнее разрешение ${banned}`);
  }
}

// --- 2. entitlements.plist -------------------------------------------------------
const entitlementsPath = join(ROOT, 'desktop', 'src-tauri', 'entitlements.plist');
const ALLOWED_ENTITLEMENTS = new Set([
  'com.apple.security.device.audio-input', // микрофон — единственное необходимое право
]);
if (!existsSync(entitlementsPath)) {
  failures.push('desktop/src-tauri/entitlements.plist не найден');
} else {
  const ent = readFileSync(entitlementsPath, 'utf8');
  const keys = [...ent.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]);
  if (!keys.includes('com.apple.security.device.audio-input')) {
    failures.push('entitlements.plist: отсутствует com.apple.security.device.audio-input');
  }
  for (const key of keys) {
    if (!ALLOWED_ENTITLEMENTS.has(key)) {
      failures.push(`entitlements.plist: неразрешённый entitlement ${key} (минимальные права: только audio-input)`);
    }
    if (key.startsWith('com.apple.security.network')) {
      failures.push(`entitlements.plist: сетевой entitlement ${key} запрещён (zero-network)`);
    }
  }
}

// --- 3. Плейсхолдеры подписи в tauri.conf.json ------------------------------------
const tauriConf = JSON.parse(readFileSync(join(ROOT, 'desktop', 'src-tauri', 'tauri.conf.json'), 'utf8'));
const mac = tauriConf?.bundle?.macOS ?? {};
const win = tauriConf?.bundle?.windows ?? {};
if (mac.signingIdentity !== null) failures.push('tauri.conf.json: macOS.signingIdentity должен оставаться null в репозитории');
if (mac.providerShortName !== null) failures.push('tauri.conf.json: macOS.providerShortName должен оставаться null в репозитории');
if (win.certificateThumbprint !== null) failures.push('tauri.conf.json: windows.certificateThumbprint должен оставаться null в репозитории');
if (mac.entitlements !== 'entitlements.plist') failures.push('tauri.conf.json: macOS.entitlements должен указывать на entitlements.plist');

// --- 4. Секреты не закоммичены ------------------------------------------------------
let tracked = '';
try {
  tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
} catch {
  failures.push('не удалось выполнить git ls-files');
}
const SECRET_RE = /\.(p12|p8|mobileprovision|key|pem|cer|pfx)$|AuthKey_|\.tauri-keys/i;
for (const file of tracked.split('\n').filter(Boolean)) {
  if (SECRET_RE.test(file)) {
    failures.push(`в git закоммичен потенциальный секрет подписи: ${file}`);
  }
}

// --- 5. Документация -------------------------------------------------------------------
if (!existsSync(join(ROOT, 'RELEASE-SIGNING.md'))) {
  failures.push('RELEASE-SIGNING.md не найден — инструкция по подписи обязательна');
}

// --- Итог --------------------------------------------------------------------------------
if (failures.length) {
  console.error('RELEASE-SIGNING SCAFFOLD GATE FAILED:');
  for (const f of failures) console.error(`  FAIL: ${f}`);
  process.exit(1);
}
console.log('Release-signing scaffold: OK — файлы на месте, права минимальны, секреты не закоммичены.');
