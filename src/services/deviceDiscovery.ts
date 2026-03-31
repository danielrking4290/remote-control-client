import axios from "axios";
import Constants from "expo-constants";
import * as Network from "expo-network";
import { Platform } from "react-native";

export interface DiscoveredDevice {
    baseUrl: string;
    displayHost: string;
    port: number;
}

interface DiscoveryPayload {
    service?: string;
    version?: string;
    host?: string;
    port?: number;
}

export type ScanPrepResult =
    | { ok: true; subnetLabel: string }
    | { ok: false; errorKey: "discovery_not_available" | "no_local_ip" };

const DEFAULT_SCAN_PORT = 3000;
/** First connection to a LAN IP can be slow on Windows (firewall / ARP). */
const DEFAULT_TIMEOUT_MS = 1500;

/** Extract IPv4 from values like "192.168.1.2:8081" (Expo hostUri / debuggerHost). */
function parseIpv4FromHostPort(raw: string): string | null {
    const first = raw.split(",")[0]?.trim() ?? "";
    if (!first) {
        return null;
    }
    // hostUri can be "192.168.1.2:8081"; avoid treating "http:" as host.
    const hostPart = first.startsWith("http://")
        ? first.slice("http://".length).split("/")[0] ?? ""
        : first.split("/")[0] ?? "";
    const addr = hostPart.split(":")[0]?.trim() ?? "";
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(addr)) {
        return null;
    }
    return addr;
}

/** IPs worth probing before / in parallel with subnet sweep (dev PC running Metro + server). */
function collectPriorityLanIps(): string[] {
    const ips: string[] = [];
    const add = (raw?: string | null) => {
        if (!raw) {
            return;
        }
        const ip = parseIpv4FromHostPort(raw);
        if (ip && !ips.includes(ip)) {
            ips.push(ip);
        }
    };

    const expoConfig = Constants.expoConfig as { hostUri?: string } | undefined;
    add(expoConfig?.hostUri);
    const expoGo = Constants.expoGoConfig as { debuggerHost?: string } | undefined;
    add(expoGo?.debuggerHost);

    // Android emulator: host machine from the emulated network is always 10.0.2.2
    if (Platform.OS === "android" && !ips.includes("10.0.2.2")) {
        ips.push("10.0.2.2");
    }

    return ips;
}

export async function probeDiscoveryAtBaseUrl(
    baseUrl: string,
    options: {
        timeoutMs?: number;
        signal?: AbortSignal;
        onFound: (device: DiscoveredDevice) => void;
    }
): Promise<void> {
    const root = baseUrl.replace(/\/+$/, "");
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
        const res = await axios.get<DiscoveryPayload>(`${root}/discovery`, {
            timeout: timeoutMs,
            signal: options.signal,
            validateStatus: (s) => s === 200,
        });
        const data = res.data;
        if (data?.service !== "remote-control-server") {
            return;
        }
        const hostFromUrl = (() => {
            try {
                const u = new URL(root.includes("://") ? root : `http://${root}`);
                return u.hostname;
            } catch {
                return "";
            }
        })();
        options.onFound({
            baseUrl: root,
            displayHost:
                typeof data.host === "string" && data.host.length > 0 ? data.host : hostFromUrl,
            port: typeof data.port === "number" ? data.port : DEFAULT_SCAN_PORT,
        });
    } catch {
        // No service here
    }
}

/** Prepare scan: platform check + local IPv4 for /24 subnet. */
export async function prepareLocalScan(): Promise<ScanPrepResult> {
    if (Platform.OS === "web") {
        return { ok: false, errorKey: "discovery_not_available" };
    }
    let ip: string;
    try {
        ip = await Network.getIpAddressAsync();
    } catch {
        return { ok: false, errorKey: "no_local_ip" };
    }
    if (!ip || ip === "0.0.0.0") {
        return { ok: false, errorKey: "no_local_ip" };
    }
    const parts = ip.split(".").map((x) => parseInt(x, 10));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
        return { ok: false, errorKey: "no_local_ip" };
    }
    const [a, b, c] = parts;
    return { ok: true, subnetLabel: `${a}.${b}.${c}.x` };
}

export function subnetTripleFromPrep(prep: Extract<ScanPrepResult, { ok: true }>): {
    a: number;
    b: number;
    c: number;
} | null {
    const m = prep.subnetLabel.match(/^(\d+)\.(\d+)\.(\d+)\.x$/);
    if (!m) {
        return null;
    }
    return {
        a: parseInt(m[1], 10),
        b: parseInt(m[2], 10),
        c: parseInt(m[3], 10),
    };
}

/** Probe Expo dev machine + emulator host IPs (parallel). */
export async function probePriorityDiscoveryHosts(options: {
    port?: number;
    timeoutMs?: number;
    onFound: (device: DiscoveredDevice) => void;
    signal?: AbortSignal;
}): Promise<void> {
    const port = options.port ?? DEFAULT_SCAN_PORT;
    const ips = collectPriorityLanIps();
    if (ips.length === 0) {
        return;
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    await Promise.all(
        ips.map((ip) =>
            probeDiscoveryAtBaseUrl(`http://${ip}:${port}`, {
                timeoutMs,
                signal: options.signal,
                onFound: options.onFound,
            })
        )
    );
}

/**
 * Probes each address on the given /24 for the discovery endpoint.
 * Calls `onFound` for each matching server (may be concurrent).
 */
export async function probeSubnetForServers(
    triple: { a: number; b: number; c: number },
    options: {
        port?: number;
        timeoutMs?: number;
        concurrency?: number;
        onFound: (device: DiscoveredDevice) => void;
        signal?: AbortSignal;
    }
): Promise<void> {
    const { a, b, c } = triple;
    const port = options.port ?? DEFAULT_SCAN_PORT;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const concurrency = Math.min(40, Math.max(8, options.concurrency ?? 28));
    const octets = Array.from({ length: 254 }, (_, i) => i + 1);

    let nextIndex = 0;
    const worker = async () => {
        for (;;) {
            if (options.signal?.aborted) {
                return;
            }
            const i = nextIndex++;
            if (i >= octets.length) {
                return;
            }
            const last = octets[i];
            const hostIp = `${a}.${b}.${c}.${last}`;
            await probeDiscoveryAtBaseUrl(`http://${hostIp}:${port}`, {
                timeoutMs,
                signal: options.signal,
                onFound: options.onFound,
            });
        }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

/** Full flow: prepare + probe. */
export async function scanLocalNetworkForServers(options: {
    port?: number;
    timeoutMs?: number;
    concurrency?: number;
    onFound: (device: DiscoveredDevice) => void;
    signal?: AbortSignal;
}): Promise<ScanPrepResult> {
    const prep = await prepareLocalScan();
    if (!prep.ok) {
        return prep;
    }
    const triple = subnetTripleFromPrep(prep);
    if (!triple) {
        return { ok: false, errorKey: "no_local_ip" };
    }
    await Promise.all([
        probePriorityDiscoveryHosts(options),
        probeSubnetForServers(triple, options),
    ]);
    return prep;
}
