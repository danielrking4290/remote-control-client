import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import * as FileSystem from "expo-file-system/legacy";

export interface PointerSettings {
  mouseAcceleration: boolean;
}

interface PointerSettingsContextValue {
  mouseAccelerationEnabled: boolean;
  setMouseAccelerationEnabled: (enabled: boolean) => void;
}

const POINTER_SETTINGS_FILENAME = "pointer-settings.json";

const DefaultPointerSettings: PointerSettings = {
  /** Matches prior app behavior (velocity-based gain + carry). */
  mouseAcceleration: true,
};

const PointerSettingsContext = createContext<PointerSettingsContextValue | null>(null);

function parsePointerSettings(raw: unknown): PointerSettings {
  if (raw === null || typeof raw !== "object") return DefaultPointerSettings;
  const o = raw as Record<string, unknown>;
  if (typeof o.mouseAcceleration !== "boolean") return DefaultPointerSettings;
  return { mouseAcceleration: o.mouseAcceleration };
}

async function loadPointerSettingsFromFile(): Promise<PointerSettings> {
  try {
    const path = FileSystem.documentDirectory + POINTER_SETTINGS_FILENAME;
    const exists = await FileSystem.getInfoAsync(path);
    if (!exists.exists) return DefaultPointerSettings;
    const str = await FileSystem.readAsStringAsync(path);
    return parsePointerSettings(JSON.parse(str) as unknown);
  } catch {
    return DefaultPointerSettings;
  }
}

async function savePointerSettingsToFile(settings: PointerSettings): Promise<void> {
  try {
    const path = FileSystem.documentDirectory + POINTER_SETTINGS_FILENAME;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(settings, null, 2));
  } catch {
    // Ignore write errors
  }
}

export function PointerSettingsProvider({ children }: { children: ReactNode }) {
  const [mouseAccelerationEnabled, setMouseAccelerationEnabledState] = useState(
    DefaultPointerSettings.mouseAcceleration
  );
  const hasLoadedFromFile = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadPointerSettingsFromFile().then((loaded) => {
      if (cancelled) return;
      hasLoadedFromFile.current = true;
      setMouseAccelerationEnabledState(loaded.mouseAcceleration);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedFromFile.current) return;
    void savePointerSettingsToFile({ mouseAcceleration: mouseAccelerationEnabled });
  }, [mouseAccelerationEnabled]);

  const setMouseAccelerationEnabled = useCallback((enabled: boolean) => {
    setMouseAccelerationEnabledState(enabled);
  }, []);

  const value: PointerSettingsContextValue = {
    mouseAccelerationEnabled,
    setMouseAccelerationEnabled,
  };

  return (
    <PointerSettingsContext.Provider value={value}>{children}</PointerSettingsContext.Provider>
  );
}

export function usePointerSettings(): PointerSettingsContextValue {
  const ctx = useContext(PointerSettingsContext);
  if (!ctx) {
    throw new Error("usePointerSettings must be used within PointerSettingsProvider");
  }
  return ctx;
}
