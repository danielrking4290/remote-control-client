import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import Slider from "@react-native-community/slider";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";

export const PointerSettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [cursorSpeed, setCursorSpeed] = useState(50);
    const [holdDetectionThreshold, setHoldDetectionThreshold] = useState(50);
    const [tapDetectionThreshold, setTapDetectionThreshold] = useState(50);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <FontAwesomeIcon icon={faChevronLeft} size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>Pointer Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cursor Speed</Text>
                    <Slider
                        style={styles.slider}
                        value={cursorSpeed}
                        onValueChange={setCursorSpeed}
                        minimumValue={1}
                        maximumValue={100}
                        step={1}
                        thumbTintColor="#dddddd"
                        minimumTrackTintColor="#dddddd"
                        maximumTrackTintColor="#dddddd"
                    />
                </View>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hold Detection Threshold</Text>
                    <Slider
                        style={styles.slider}
                        value={holdDetectionThreshold}
                        onValueChange={setHoldDetectionThreshold}
                        minimumValue={1}
                        maximumValue={100}
                        step={1}
                        thumbTintColor="#dddddd"
                        minimumTrackTintColor="#dddddd"
                        maximumTrackTintColor="#dddddd"
                    />
                </View>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tap Detection Threshold</Text>
                    <Slider
                        style={styles.slider}
                        value={tapDetectionThreshold}
                        onValueChange={setTapDetectionThreshold}
                        minimumValue={1}
                        maximumValue={100}
                        step={1}
                        thumbTintColor="#dddddd"
                        minimumTrackTintColor="#dddddd"
                        maximumTrackTintColor="#505050"
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#323232",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#404040",
    },
    backButton: {
        padding: 10,
        minWidth: 44,
    },
    title: {
        fontSize: 24,
        flex: 1,
        textAlign: "center",
        color: "white",
    },
    headerSpacer: {
        minWidth: 44,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        gap: 10,
        padding: 16,
    },
    section: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
        marginBottom: 10,
    },
    slider: {
        width: "100%",
        height: 40,
    },
});
