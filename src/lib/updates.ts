/**
 * Android auto-update: release check and install hand-off.
 *
 * The backend publishes each APK plus a `latest.json` manifest to the public
 * `app-releases` Supabase Storage bucket (see scripts/publish-android-release.mjs).
 * This module compares the published `versionCode` with the one the native
 * updater module reports for the installed APK, and hands the download to the
 * native side only when a newer build exists.
 *
 * In dev builds (or on iOS) the native module is absent, so updates are simply
 * reported as unsupported and no UI is shown.
 */
import { NativeModules, Platform } from 'react-native';
import { supabaseConfig } from './env';

export type ReleaseManifest = {
  versionCode: number;
  versionName: string;
  size: number;
  sha256: string;
  url: string;
  publishedAt: string;
};

export type UpdateCheck = {
  supported: boolean;
  currentVersionCode: number | null;
  currentVersionName: string | null;
  latest: ReleaseManifest | null;
  updateAvailable: boolean;
};

type UpdaterNativeModule = {
  getVersionCode(): Promise<number>;
  getVersionName(): Promise<string>;
  canRequestPackageInstalls(): Promise<boolean>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(url: string, sha256: string): Promise<void>;
};

function nativeUpdater(): UpdaterNativeModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  const module = NativeModules.LumioUpdater as UpdaterNativeModule | undefined;
  return module ?? null;
}

/** True when this build can check for and install updates. */
export function updatesSupported(): boolean {
  return nativeUpdater() !== null && supabaseConfig !== null;
}

function releasesUrl(): string | null {
  if (!supabaseConfig) {
    return null;
  }
  return `${supabaseConfig.url}/storage/v1/object/public/app-releases/latest.json`;
}

export function isNewerVersion(latestVersionCode: number, currentVersionCode: number): boolean {
  return Number.isFinite(latestVersionCode) && latestVersionCode > currentVersionCode;
}

/** Narrow the untrusted manifest JSON to the fields the updater relies on. */
export function parseReleaseManifest(raw: unknown): ReleaseManifest | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const versionCode = typeof row.versionCode === 'number' ? row.versionCode : null;
  const versionName = typeof row.versionName === 'string' ? row.versionName : null;
  const url = typeof row.url === 'string' ? row.url : null;
  const sha256 = typeof row.sha256 === 'string' ? row.sha256 : null;
  if (versionCode === null || !versionName || !url || !sha256) {
    return null;
  }
  return {
    versionCode,
    versionName,
    size: typeof row.size === 'number' ? row.size : 0,
    sha256,
    url,
    publishedAt: typeof row.publishedAt === 'string' ? row.publishedAt : '',
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  const megabytes = bytes / 1048576;
  return megabytes >= 1
    ? `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Ask the update channel whether a newer build exists. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const updater = nativeUpdater();
  const url = releasesUrl();
  if (!updater || !url) {
    return {
      supported: false,
      currentVersionCode: null,
      currentVersionName: null,
      latest: null,
      updateAvailable: false,
    };
  }

  const currentVersionCode = await updater.getVersionCode();
  const currentVersionName = await updater.getVersionName().catch(() => null);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    // Cache-bust: the manifest is served with a short cache lifetime.
    const response = await fetch(`${url}?t=${Date.now()}`, { signal: controller.signal });
    if (!response.ok) {
      // 404 simply means no release has been published yet.
      return {
        supported: true,
        currentVersionCode,
        currentVersionName,
        latest: null,
        updateAvailable: false,
      };
    }
    const latest = parseReleaseManifest(await response.json());
    return {
      supported: true,
      currentVersionCode,
      currentVersionName,
      latest,
      updateAvailable: latest !== null && isNewerVersion(latest.versionCode, currentVersionCode),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** True when Android will let the app prompt to install an APK. */
export async function canInstallPackages(): Promise<boolean> {
  const updater = nativeUpdater();
  if (!updater) {
    return false;
  }
  return updater.canRequestPackageInstalls();
}

/** Open the "install unknown apps" screen for LUMIO. */
export async function openInstallSettings(): Promise<void> {
  const updater = nativeUpdater();
  if (!updater) {
    throw new Error('Updates are only available in the Android app.');
  }
  await updater.openInstallSettings();
}

/**
 * Download the manifest's APK, verify its checksum, and open the system
 * installer. Throws with code `E_PERMISSION` when "install unknown apps" has
 * not been granted for LUMIO yet.
 */
export async function installUpdate(manifest: ReleaseManifest): Promise<void> {
  const updater = nativeUpdater();
  if (!updater) {
    throw new Error('Updates are only available in the Android app.');
  }
  await updater.downloadAndInstall(manifest.url, manifest.sha256);
}
