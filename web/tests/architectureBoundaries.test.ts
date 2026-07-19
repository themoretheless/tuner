import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = new URL('../src/', import.meta.url);

describe('web architecture boundaries', () => {
  it('keeps compatibility entries and composition modules small', () => {
    expect(lineCount('composables/useTuner.ts')).toBeLessThanOrEqual(5);
    expect(lineCount('adapters/vue/useTunerApplication.ts')).toBeLessThanOrEqual(130);
    expect(lineCount('composables/useTuningState.ts')).toBeLessThanOrEqual(150);
    expect(lineCount('composables/useSettings.ts')).toBeLessThanOrEqual(140);
  });

  it('keeps use cases, capabilities and adapters within focused module budgets', () => {
    for (const directory of [
      'application/controllers/',
      'application/ports/',
      'application/services/',
      'app/ports/',
      'adapters/vue/capabilities/',
      'adapters/vue/controllers/',
      'adapters/vue/ports/',
    ]) {
      for (const file of filesUnder(directory)) {
        expect(lineCount(file), file).toBeLessThanOrEqual(150);
      }
    }
  });

  it('keeps domain and application independent from Vue and presentation adapters', () => {
    for (const file of filesUnder('domain/')) {
      const source = read(file);
      expect(source, file).not.toMatch(/from ['"]vue['"]/);
      expect(source, file).not.toMatch(/from ['"].*(components|features|composables)\//);
    }
    for (const file of filesUnder('application/')) {
      const source = read(file);
      expect(source, file).not.toMatch(/from ['"]vue['"]/);
      expect(source, file).not.toMatch(/from ['"].*(adapters|components|features|composables)\//);
    }
  });

  it('keeps Vue feature adapters on explicit segregated capabilities', () => {
    for (const file of [
      ...filesUnder('adapters/vue/capabilities/'),
      ...filesUnder('adapters/vue/ports/'),
    ]) {
      const source = read(file);
      expect(source, file).not.toContain('TunerApplicationServices');
      expect(source, file).not.toMatch(/ReturnType\s*</);
    }
  });

  it('keeps UI-facing port contracts independent from adapter factories', () => {
    const contracts = [
      'app/tunerApplication.ts',
      ...filesUnder('app/ports/'),
    ];
    for (const file of contracts) {
      expect(read(file), file).not.toMatch(/from ['"]vue['"]/);
    }
    for (const file of ['app/featurePorts.ts', ...contracts]) {
      const source = read(file);
      expect(source, file).not.toMatch(/(adapters|composables|workers)\//);
      expect(source, file).not.toMatch(/ReturnType\s*</);
    }
  });

  it('forces feature views through their injected ports', () => {
    const featureDirectories = readdirSync(new URL('features/', src));
    for (const directory of featureDirectories) {
      const files = readdirSync(new URL(`features/${directory}/`, src))
        .filter((file) => file.endsWith('.vue'));
      for (const file of files) {
        const path = `features/${directory}/${file}`;
        expect(read(path), path).not.toMatch(
          /composables\/(useTuner|useSettings|useTuningState|useTunerSession)/,
        );
      }
    }
  });
});

function read(path: string) {
  return readFileSync(new URL(path, src), 'utf8');
}

function lineCount(path: string) {
  return read(path).trimEnd().split('\n').length;
}

function filesUnder(directory: string): string[] {
  return readdirSync(new URL(directory, src), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}${entry.name}`;
    if (entry.isDirectory()) return filesUnder(`${path}/`);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}
