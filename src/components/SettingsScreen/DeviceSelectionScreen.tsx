import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Platform,
} from "react-native";
import {
    faChevronLeft,
    faCircleCheck,
    faCircleExclamation,
    faComputer,
    faCheck,
    faArrowsRotate,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { normalizeServerBaseUrl, useServerConnection } from "../../context/serverConnectionContext";
import { apiService, DEFAULT_SERVER_BASE_URL } from "../../services/api";
import {
    prepareLocalScan,
    probePriorityDiscoveryHosts,
    probeSubnetForServers,
    subnetTripleFromPrep,
    type DiscoveredDevice,
} from "../../services/deviceDiscovery";
import { baseStyles } from "../../styles/base";

export const DeviceSelectionScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { serverBaseUrl, setServerBaseUrl, resetServerToDefault } = useServerConnection();
    const [addressInput, setAddressInput] = useState(serverBaseUrl);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
    const [testDetail, setTestDetail] = useState<string | null>(null);

    const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState<string | null>(null);
    const [lastSubnet, setLastSubnet] = useState<string | null>(null);

    const scanAbortRef = useRef<AbortController | null>(null);
    const seenUrlsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        setAddressInput(serverBaseUrl);
    }, [serverBaseUrl]);

    useEffect(() => {
        return () => {
            scanAbortRef.current?.abort();
        };
    }, []);

    const discoveryEnabled = Platform.OS !== "web";

    const applyAddress = useCallback(() => {
        setServerBaseUrl(addressInput);
        setTestStatus("idle");
        setTestDetail(null);
    }, [addressInput, setServerBaseUrl]);

    const runConnectionTest = useCallback(async () => {
        setTestStatus("testing");
        setTestDetail(null);
        const candidate = normalizeServerBaseUrl(
            addressInput.trim() ? addressInput : serverBaseUrl
        );
        const prev = apiService.getBaseUrl();
        apiService.setBaseUrl(candidate);
        try {
            const size = await apiService.getScreenSize();
            setServerBaseUrl(candidate);
            setTestStatus("ok");
            setTestDetail(`Reachable — host reports ${size.width}×${size.height} screen.`);
        } catch {
            apiService.setBaseUrl(prev);
            setTestStatus("error");
            setTestDetail(
                "Could not reach the server. Check the address, port, and that the remote app is running."
            );
        }
    }, [addressInput, serverBaseUrl, setServerBaseUrl]);

    const runDiscoveryScan = useCallback(async () => {
        scanAbortRef.current?.abort();
        const ac = new AbortController();
        scanAbortRef.current = ac;

        setScanning(true);
        setScanMessage(null);
        setDiscovered([]);
        seenUrlsRef.current.clear();
        setLastSubnet(null);

        const prep = await prepareLocalScan();
        if (!prep.ok) {
            setScanning(false);
            if (prep.errorKey === "discovery_not_available") {
                setScanMessage("Network scan is not available in this build. Use manual URL below.");
            } else {
                setScanMessage(
                    "Could not read this device's Wi‑Fi address. Connect to the same Wi‑Fi as your PC, then try again."
                );
            }
            return;
        }

        setLastSubnet(prep.subnetLabel);
        const triple = subnetTripleFromPrep(prep);
        if (!triple) {
            setScanning(false);
            setScanMessage(
                "Could not read this device's Wi‑Fi address. Connect to the same Wi‑Fi as your PC, then try again."
            );
            return;
        }

        const onFoundDevice = (device: DiscoveredDevice) => {
            const key = normalizeServerBaseUrl(device.baseUrl);
            if (seenUrlsRef.current.has(key)) {
                return;
            }
            seenUrlsRef.current.add(key);
            setDiscovered((prev) =>
                [...prev, device].sort((a, b) =>
                    a.displayHost.localeCompare(b.displayHost, undefined, { sensitivity: "base" })
                )
            );
        };

        await Promise.all([
            probePriorityDiscoveryHosts({
                signal: ac.signal,
                onFound: onFoundDevice,
            }),
            probeSubnetForServers(triple, {
                signal: ac.signal,
                onFound: onFoundDevice,
            }),
        ]);

        if (ac.signal.aborted) {
            setScanning(false);
            return;
        }

        setScanning(false);
        setScanMessage(null);
    }, []);

    const selectDiscoveredDevice = useCallback(
        (device: DiscoveredDevice) => {
            setServerBaseUrl(device.baseUrl);
            setTestStatus("idle");
            setTestDetail(null);
        },
        [setServerBaseUrl]
    );

    const isRowSelected = (baseUrl: string) =>
        normalizeServerBaseUrl(baseUrl) === normalizeServerBaseUrl(serverBaseUrl);

    return (
        <View style={baseStyles.canvas}>
            <View style={baseStyles.headingContainer}>
                <TouchableOpacity style={baseStyles.headingBackButton} onPress={onBack}>
                    <FontAwesomeIcon icon={faChevronLeft} size={24} color="white" />
                </TouchableOpacity>
                <Text style={baseStyles.headingText}>Device Selection</Text>
            </View>

            <ScrollView
                style={baseStyles.scrollView}
                contentContainerStyle={baseStyles.scrollViewContentContainer}
                showsVerticalScrollIndicator
                bounces={false}
                overScrollMode="never"
                keyboardShouldPersistTaps="handled"
            >
                {!discoveryEnabled && (
                    <View style={baseStyles.container}>
                        <Text style={styles.helpText}>
                            Network discovery runs on the iOS and Android app. On web, use manual URL below.
                        </Text>
                    </View>
                )}

                {discoveryEnabled && (
                    <View style={baseStyles.container}>
                        <Text style={baseStyles.subheadingText}>Find computers</Text>
                        <Text style={styles.helpText}>
                            Your phone scans the Wi‑Fi subnet for the remote server (port 3000) and, in
                            development, the machine running Expo (Metro). Android emulators also check the
                            host at 10.0.2.2. On Windows, allow inbound TCP 3000 for Node.js in the firewall,
                            and run an up‑to‑date server that exposes GET /discovery. Guest‑Wi‑Fi isolation
                            blocks discovery.
                        </Text>
                        <TouchableOpacity
                            style={[baseStyles.textButton, styles.scanButton]}
                            onPress={runDiscoveryScan}
                            disabled={scanning}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Scan network for remote computers"
                        >
                            {scanning ? (
                                <View style={styles.scanButtonInner}>
                                    <ActivityIndicator color="#ffffff" />
                                    <Text style={[baseStyles.bodyText, styles.scanButtonLabel]}>
                                        Scanning {lastSubnet ?? "…"}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.scanButtonInner}>
                                    <FontAwesomeIcon icon={faArrowsRotate} size={18} color="#ffffff" />
                                    <Text style={[baseStyles.bodyText, styles.scanButtonLabel]}>
                                        Scan this network
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        {scanMessage && (
                            <Text style={styles.scanHint}>{scanMessage}</Text>
                        )}
                    </View>
                )}

                {discoveryEnabled && discovered.length > 0 && (
                    <View style={styles.deviceListSection}>
                        <Text style={[baseStyles.subheadingText, styles.deviceListTitle]}>
                            Found {discovered.length === 1 ? "1 computer" : `${discovered.length} computers`}
                        </Text>
                        {discovered.map((device) => {
                            const selected = isRowSelected(device.baseUrl);
                            return (
                                <TouchableOpacity
                                    key={device.baseUrl}
                                    style={[baseStyles.menuItem, selected && styles.discoveredRowSelected]}
                                    onPress={() => selectDiscoveredDevice(device)}
                                    activeOpacity={0.7}
                                >
                                    <View style={baseStyles.menuItemLabel}>
                                        <FontAwesomeIcon icon={faComputer} size={22} color="#ffffff" />
                                        <View style={styles.deviceRowText}>
                                            <Text style={baseStyles.bodyText}>{device.displayHost}</Text>
                                            <Text style={styles.deviceUrl}>{device.baseUrl}</Text>
                                        </View>
                                    </View>
                                    {selected ? (
                                        <FontAwesomeIcon icon={faCheck} size={18} color="#5a8f5a" />
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {discoveryEnabled && !scanning && discovered.length === 0 && lastSubnet !== null && !scanMessage && (
                    <Text style={styles.emptyAfterScan}>
                        No servers found on {lastSubnet.replace(".x", ".0/24")}. Confirm the server is
                        running, Windows Firewall allows port 3000, and the phone and PC share the same LAN
                        (or use manual URL below).
                    </Text>
                )}

                <View style={baseStyles.container}>
                    <Text style={baseStyles.subheadingText}>Manual URL</Text>
                    <Text style={styles.helpText}>
                        Use this if discovery does not list your PC (different subnet, custom port, or VPN).
                    </Text>
                    <TextInput
                        style={styles.urlInput}
                        value={addressInput}
                        onChangeText={(t) => {
                            setAddressInput(t);
                            setTestStatus("idle");
                            setTestDetail(null);
                        }}
                        placeholder={`e.g. ${DEFAULT_SERVER_BASE_URL}`}
                        placeholderTextColor="#707070"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        returnKeyType="done"
                        onSubmitEditing={applyAddress}
                    />
                </View>

                <View style={styles.actionsColumn}>
                    <TouchableOpacity
                        style={baseStyles.textButton}
                        onPress={runConnectionTest}
                        activeOpacity={0.7}
                        disabled={testStatus === "testing"}
                        accessibilityRole="button"
                        accessibilityLabel="Test connection to remote computer"
                    >
                        {testStatus === "testing" ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={baseStyles.bodyText}>Test connection</Text>
                        )}
                    </TouchableOpacity>

                    {testStatus === "ok" && testDetail && (
                        <View style={styles.resultRow}>
                            <FontAwesomeIcon icon={faCircleCheck} size={18} color="#5a8f5a" />
                            <Text style={styles.resultTextOk}>{testDetail}</Text>
                        </View>
                    )}
                    {testStatus === "error" && testDetail && (
                        <View style={styles.resultRow}>
                            <FontAwesomeIcon icon={faCircleExclamation} size={18} color="#c97a7a" />
                            <Text style={styles.resultTextErr}>{testDetail}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={baseStyles.textButton}
                        onPress={applyAddress}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Save server address"
                    >
                        <Text style={baseStyles.bodyText}>Save address</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[baseStyles.textButton, styles.resetButton]}
                        onPress={() => {
                            resetServerToDefault();
                            setTestStatus("idle");
                            setTestDetail(null);
                            setDiscovered([]);
                            setLastSubnet(null);
                            setScanMessage(null);
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Reset server address to default"
                    >
                        <Text style={baseStyles.bodyText}>Reset to default</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    helpText: {
        fontSize: 14,
        color: "#b0b0b0",
        lineHeight: 20,
        marginTop: 10,
    },
    scanButton: {
        marginTop: 14,
    },
    scanButtonInner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    scanButtonLabel: {
        marginLeft: 4,
    },
    scanHint: {
        marginTop: 12,
        fontSize: 14,
        color: "#e0a0a0",
        lineHeight: 20,
    },
    deviceListSection: {
        gap: 10,
    },
    deviceListTitle: {
        marginBottom: 4,
    },
    discoveredRowSelected: {
        backgroundColor: "#353535",
        borderWidth: 1,
        borderColor: "#5a8f5a",
    },
    deviceRowText: {
        flex: 1,
        marginLeft: 6,
    },
    deviceUrl: {
        fontSize: 12,
        color: "#888888",
        marginTop: 4,
    },
    emptyAfterScan: {
        fontSize: 14,
        color: "#b0b0b0",
        lineHeight: 20,
        paddingHorizontal: 2,
    },
    urlInput: {
        marginTop: 14,
        backgroundColor: "#353535",
        color: "#ffffff",
        borderRadius: 16,
        paddingHorizontal: 15,
        paddingVertical: 14,
        fontSize: 14,
        fontFamily: "Roboto",
    },
    actionsColumn: {
        gap: 10,
    },
    resetButton: {
        marginTop: 6,
    },
    resultRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    resultTextOk: {
        flex: 1,
        fontSize: 14,
        color: "#9ec99e",
        lineHeight: 20,
    },
    resultTextErr: {
        flex: 1,
        fontSize: 14,
        color: "#e0a0a0",
        lineHeight: 20,
    },
});
