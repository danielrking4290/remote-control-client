import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as FileSystem from "expo-file-system/legacy";
import { apiService, DEFAULT_SERVER_BASE_URL } from "../services/api";

interface ServerConnectionContextValue {
  serverBaseUrl: string;
  setServerBaseUrl: (url: string) => void;
  resetServerToDefault: () => void;
}

const SERVER_CONNECTION_FILENAME = "server-connection.json";

const ServerConnectionContext = createContext<ServerConnectionContextValue | null>(null);

export function normalizeServerBaseUrl(raw: string): string {
  let s = raw.trim().replace(/\/+$/, "");
  if (!s) {
    return DEFAULT_SERVER_BASE_URL;
  }
  if (!/^https?:\/\//i.test(s)) {
    s = `http://${s}`;
  }
  return s;
}

function parseServerConnectionFile(raw: unknown): string {
  if (raw === null || typeof raw !== "object") {
    return DEFAULT_SERVER_BASE_URL;
  }
  const u = (raw as Record<string, unknown>).baseUrl;
  if (typeof u !== "string" || !u.trim()) {
    return DEFAULT_SERVER_BASE_URL;
  }
  return normalizeServerBaseUrl(u);
}

async function loadServerConnectionFromFile(): Promise<string> {
  try {
    const path = FileSystem.documentDirectory + SERVER_CONNECTION_FILENAME;
    const exists = await FileSystem.getInfoAsync(path);
    if (!exists.exists) {
      return DEFAULT_SERVER_BASE_URL;
    }
    const str = await FileSystem.readAsStringAsync(path);
    return parseServerConnectionFile(JSON.parse(str) as unknown);
  } catch {
    return DEFAULT_SERVER_BASE_URL;
  }
}

async function saveServerConnectionToFile(baseUrl: string): Promise<void> {
  try {
    const path = FileSystem.documentDirectory + SERVER_CONNECTION_FILENAME;
    await FileSystem.writeAsStringAsync(path, JSON.stringify({ baseUrl }, null, 2));
  } catch {
    // Ignore write errors
  }
}

export function ServerConnectionProvider({ children }: { children: ReactNode }) {
  const [serverBaseUrl, setServerBaseUrlState] = useState(DEFAULT_SERVER_BASE_URL);
  const hasLoadedFromFile = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadServerConnectionFromFile().then((loaded) => {
      if (cancelled) {
        return;
      }
      hasLoadedFromFile.current = true;
      setServerBaseUrlState(loaded);
      apiService.setBaseUrl(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedFromFile.current) {
      return;
    }
    void saveServerConnectionToFile(serverBaseUrl);
  }, [serverBaseUrl]);

  const setServerBaseUrl = useCallback((url: string) => {
    const next = normalizeServerBaseUrl(url);
    setServerBaseUrlState(next);
    apiService.setBaseUrl(next);
  }, []);

  const resetServerToDefault = useCallback(() => {
    setServerBaseUrlState(DEFAULT_SERVER_BASE_URL);
    apiService.setBaseUrl(DEFAULT_SERVER_BASE_URL);
  }, []);

  const value: ServerConnectionContextValue = {
    serverBaseUrl,
    setServerBaseUrl,
    resetServerToDefault,
  };

  return (
    <ServerConnectionContext.Provider value={value}>{children}</ServerConnectionContext.Provider>
  );
}

export function useServerConnection(): ServerConnectionContextValue {
  const ctx = useContext(ServerConnectionContext);
  if (!ctx) {
    throw new Error("useServerConnection must be used within ServerConnectionProvider");
  }
  return ctx;
}
