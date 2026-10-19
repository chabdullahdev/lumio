import { formatBytes, isNewerVersion, parseReleaseManifest } from '../updates';

const VALID = {
  versionCode: 3,
  versionName: '1.2',
  size: 1234,
  sha256: 'abc123',
  url: 'https://example.test/lumio-3.apk',
  publishedAt: '2026-10-19T00:00:00.000Z',
};

describe('isNewerVersion', () => {
  it('compares version codes numerically', () => {
    expect(isNewerVersion(2, 1)).toBe(true);
    expect(isNewerVersion(1, 1)).toBe(false);
    expect(isNewerVersion(1, 2)).toBe(false);
    expect(isNewerVersion(Number.NaN, 1)).toBe(false);
  });
});

describe('parseReleaseManifest', () => {
  it('accepts a complete manifest', () => {
    expect(parseReleaseManifest(VALID)).toEqual(VALID);
  });

  it('defaults optional fields', () => {
    const required = {
      versionCode: VALID.versionCode,
      versionName: VALID.versionName,
      sha256: VALID.sha256,
      url: VALID.url,
    };
    expect(parseReleaseManifest(required)).toEqual({
      ...required,
      size: 0,
      publishedAt: '',
    });
  });

  it('rejects malformed manifests', () => {
    expect(parseReleaseManifest(null)).toBeNull();
    expect(parseReleaseManifest('nope')).toBeNull();
    expect(parseReleaseManifest({ ...VALID, url: undefined })).toBeNull();
    expect(parseReleaseManifest({ ...VALID, sha256: 42 })).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formats megabytes and kilobytes', () => {
    expect(formatBytes(55 * 1048576)).toBe('55 MB');
    expect(formatBytes(1.5 * 1048576)).toBe('1.5 MB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(0)).toBe('');
  });
});
