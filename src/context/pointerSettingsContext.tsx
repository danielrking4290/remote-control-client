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
  /** 1–100; 50 = previous default cursor responsiveness. */
  cursorSpeed: number;
  /** 1–100; higher = longer press before hold (mouse down). */
  holdDetectionThreshold: number;
  /** 1–100; higher = longer max touch duration still counts as a tap. */
  tapDetectionThreshold: number;
}

interface PointerSettingsContextValue {
  mouseAccelerationEnabled: boolean;
  setMouseAccelerationEnabled: (enabled: boolean) => void;
  cursorSpeed: number;
  setCursorSpeed: (value: number) => void;
  holdDetectionThreshold: number;
  setHoldDetectionThreshold: (value: number) => void;
  tapDetectionThreshold: number;
  setTapDetectionThreshold: (value: number) => void;
  resetPointerSettingsToDefaults: () => void;
}

const POINTER_SETTINGS_FILENAME = "pointer-settings.json";

const DefaultPointerSettings: PointerSettings = {
  /** Matches prior app behavior (velocity-based gain + carry). */
  mouseAcceleration: true,
  cursorSpeed: 50,
  holdDetectionThreshold: 50,
  tapDetectionThreshold: 50,
};

function clampSlider1To100(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(1, Math.round(value)));
}

const PointerSettingsContext = createContext<PointerSettingsContextValue | null>(null);

function parsePointerSettings(raw: unknown): PointerSettings {
  if (raw === null || typeof raw !== "object") return DefaultPointerSettings;
  const o = raw as Record<string, unknown>;
  if (typeof o.mouseAcceleration !== "boolean") return DefaultPointerSettings;
  return {
    mouseAcceleration: o.mouseAcceleration,
    cursorSpeed: clampSlider1To100(o.cursorSpeed, DefaultPointerSettings.cursorSpeed),
    holdDetectionThreshold: clampSlider1To100(
      o.holdDetectionThreshold,
      DefaultPointerSettings.holdDetectionThreshold
    ),
    tapDetectionThreshold: clampSlider1To100(
      o.tapDetectionThreshold,
      DefaultPointerSettings.tapDetectionThreshold
    ),
  };
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
  const [cursorSpeed, setCursorSpeedState] = useState(DefaultPointerSettings.cursorSpeed);
  const [holdDetectionThreshold, setHoldDetectionThresholdState] = useState(
    DefaultPointerSettings.holdDetectionThreshold
  );
  const [tapDetectionThreshold, setTapDetectionThresholdState] = useState(
    DefaultPointerSettings.tapDetectionThreshold
  );
  const hasLoadedFromFile = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadPointerSettingsFromFile().then((loaded) => {
      if (cancelled) return;
      hasLoadedFromFile.current = true;
      setMouseAccelerationEnabledState(loaded.mouseAcceleration);
      setCursorSpeedState(loaded.cursorSpeed);
      setHoldDetectionThresholdState(loaded.holdDetectionThreshold);
      setTapDetectionThresholdState(loaded.tapDetectionThreshold);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedFromFile.current) return;
    void savePointerSettingsToFile({
      mouseAcceleration: mouseAccelerationEnabled,
      cursorSpeed,
      holdDetectionThreshold,
      tapDetectionThreshold,
    });
  }, [
    mouseAccelerationEnabled,
    cursorSpeed,
    holdDetectionThreshold,
    tapDetectionThreshold,
  ]);

  const setMouseAccelerationEnabled = useCallback((enabled: boolean) => {
    setMouseAccelerationEnabledState(enabled);
  }, []);

  const setCursorSpeed = useCallback((value: number) => {
    setCursorSpeedState(clampSlider1To100(value, DefaultPointerSettings.cursorSpeed));
  }, []);

  const setHoldDetectionThreshold = useCallback((value: number) => {
    setHoldDetectionThresholdState(clampSlider1To100(value, DefaultPointerSettings.holdDetectionThreshold));
  }, []);

  const setTapDetectionThreshold = useCallback((value: number) => {
    setTapDetectionThresholdState(clampSlider1To100(value, DefaultPointerSettings.tapDetectionThreshold));
  }, []);

  const resetPointerSettingsToDefaults = useCallback(() => {
    setMouseAccelerationEnabledState(DefaultPointerSettings.mouseAcceleration);
    setCursorSpeedState(DefaultPointerSettings.cursorSpeed);
    setHoldDetectionThresholdState(DefaultPointerSettings.holdDetectionThreshold);
    setTapDetectionThresholdState(DefaultPointerSettings.tapDetectionThreshold);
  }, []);

  const value: PointerSettingsContextValue = {
    mouseAccelerationEnabled,
    setMouseAccelerationEnabled,
    cursorSpeed,
    setCursorSpeed,
    holdDetectionThreshold,
    setHoldDetectionThreshold,
    tapDetectionThreshold,
    setTapDetectionThreshold,
    resetPointerSettingsToDefaults,
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
