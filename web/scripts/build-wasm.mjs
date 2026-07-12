import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = resolve(webRoot, '..', 'pitch-core');
const buildArgs = [
  'build',
  '--target',
  'web',
  '--out-dir',
  resolve(webRoot, 'public', 'wasm'),
  '--features',
  'wasm',
];

let result = run('wasm-pack', buildArgs, true);
if (result.error?.code === 'ENOENT') {
  const install = run('cargo', ['install', 'wasm-pack']);
  if (install.status !== 0) process.exit(install.status ?? 1);
  result = run('wasm-pack', buildArgs);
}

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

function run(command, args, tolerateMissing = false) {
  const result = spawnSync(command, args, {
    cwd: coreRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error && (!tolerateMissing || result.error.code !== 'ENOENT')) {
    throw result.error;
  }
  return result;
}
