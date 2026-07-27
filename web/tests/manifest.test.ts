import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

interface WebManifest {
  name: string;
  display: string;
  icons: ManifestIcon[];
}

function loadManifest(): WebManifest {
  return JSON.parse(readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8')) as WebManifest;
}

describe('web app manifest', () => {
  it('is valid JSON with required fields', () => {
    const manifest = loadManifest();
    expect(manifest.name).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
  });

  it('includes 192x192 and 512x512 icons with purpose "any"', () => {
    const manifest = loadManifest();
    for (const size of ['192x192', '512x512']) {
      const icon = manifest.icons.find(
        (entry) => entry.sizes === size && (entry.purpose ?? 'any').includes('any') && entry.type === 'image/png',
      );
      expect(icon, `missing png icon for ${size} purpose any`).toBeTruthy();
    }
  });

  it('includes 192x192 and 512x512 maskable icons', () => {
    const manifest = loadManifest();
    for (const size of ['192x192', '512x512']) {
      const icon = manifest.icons.find(
        (entry) => entry.sizes === size && entry.purpose?.split(/\s+/).includes('maskable'),
      );
      expect(icon, `missing maskable icon for ${size}`).toBeTruthy();
    }
  });

  it('references icon files that exist in public/', () => {
    const manifest = loadManifest();
    for (const icon of manifest.icons) {
      const path = join(publicDir, icon.src);
      expect(existsSync(path), `icon file missing: ${icon.src}`).toBe(true);
    }
  });
});
