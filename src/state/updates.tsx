/**
 * App-update state: silently checks the release channel on launch, exposes a
 * manual check, and drives the download/install flow. Shared by the Home
 * banner and the Profile settings card.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  canInstallPackages,
  checkForUpdate,
  installUpdate,
  openInstallSettings,
  updatesSupported,
  type ReleaseManifest,
} from '../lib/updates';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'permission'
  | 'up-to-date'
  | 'unsupported'
  | 'error';

type UpdatesContextValue = {
  phase: UpdatePhase;
  latest: ReleaseManifest | null;
  currentVersionName: string | null;
  progress: number;
  error: string | null;
  check: (options?: { manual?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  openSettings: () => Promise<void>;
};

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

type ProgressEvent = { bytes?: number; total?: number };

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const supported = updatesSupported();
  const [phase, setPhase] = useState<UpdatePhase>(supported ? 'idle' : 'unsupported');
  const [latest, setLatest] = useState<ReleaseManifest | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'LumioUpdaterProgress',
      (event: ProgressEvent) => {
        const total = Number(event?.total ?? 0);
        const bytes = Number(event?.bytes ?? 0);
        if (total > 0) {
          setProgress(Math.min(1, bytes / total));
        }
      },
    );
    return () => subscription.remove();
  }, []);

  const check = useCallback(
    async (options?: { manual?: boolean }) => {
      if (!supported || busy.current) {
        return;
      }
      const manual = options?.manual ?? false;
      if (manual) {
        setPhase('checking');
        setError(null);
      }
      try {
        const result = await checkForUpdate();
        setCurrentVersionName(result.currentVersionName);
        if (!result.supported) {
          setPhase('unsupported');
          return;
        }
        setLatest(result.latest);
        if (result.updateAvailable) {
          setPhase('available');
        } else {
          setPhase(manual ? 'up-to-date' : 'idle');
        }
      } catch (checkError) {
        // The silent launch check never nags; only manual checks surface errors.
        if (manual) {
          setError(checkError instanceof Error ? checkError.message : String(checkError));
          setPhase('error');
        }
      }
    },
    [supported],
  );

  useEffect(() => {
    check();
  }, [check]);

  const install = useCallback(async () => {
    if (!latest || busy.current) {
      return;
    }
    setError(null);
    busy.current = true;
    try {
      if (!(await canInstallPackages())) {
        setPhase('permission');
        busy.current = false;
        return;
      }
      setProgress(0);
      setPhase('downloading');
      await installUpdate(latest);
      setPhase('installing');
      // The system installer is now in front of the app. If the user cancels,
      // the update card comes back; if they install, Android restarts LUMIO.
      setTimeout(() => {
        busy.current = false;
        check();
      }, 4000);
    } catch (installError) {
      const code = (installError as { code?: string })?.code;
      if (code === 'E_PERMISSION') {
        setPhase('permission');
      } else {
        setError(installError instanceof Error ? installError.message : String(installError));
        setPhase('error');
      }
      busy.current = false;
    }
  }, [check, latest]);

  const openSettings = useCallback(async () => {
    try {
      await openInstallSettings();
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : String(settingsError));
      setPhase('error');
      return;
    }
    // The user grants the permission in Android settings and comes back.
    setPhase('available');
  }, []);

  const value = useMemo<UpdatesContextValue>(
    () => ({
      phase,
      latest,
      currentVersionName,
      progress,
      error,
      check,
      install,
      openSettings,
    }),
    [phase, latest, currentVersionName, progress, error, check, install, openSettings],
  );

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

export function useUpdates(): UpdatesContextValue {
  const context = useContext(UpdatesContext);
  if (!context) {
    throw new Error('useUpdates must be used inside UpdatesProvider');
  }
  return context;
}
