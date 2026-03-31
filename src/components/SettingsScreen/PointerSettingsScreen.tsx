import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import Slider from "@react-native-community/slider";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { usePointerSettings } from "../../context/pointerSettingsContext";
import { baseStyles } from "../../styles/base";

export const PointerSettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const {
        mouseAccelerationEnabled,
        setMouseAccelerationEnabled,
        cursorSpeed,
        setCursorSpeed,
        holdDetectionThreshold,
        setHoldDetectionThreshold,
        tapDetectionThreshold,
        setTapDetectionThreshold,
        resetPointerSettingsToDefaults,
    } = usePointerSettings();

    return (
        <View style={baseStyles.canvas}>
            <View style={baseStyles.headingContainer}>
                {onBack && (
                    <TouchableOpacity style={baseStyles.headingBackButton} onPress={onBack}>
                        <FontAwesomeIcon icon={faChevronLeft} size={24} color="white" />
                    </TouchableOpacity>
                )}
                <Text style={baseStyles.headingText}>Pointer Settings</Text>
            </View>

            <ScrollView
                style={baseStyles.scrollView}
                contentContainerStyle={baseStyles.scrollViewContentContainer}
                showsVerticalScrollIndicator
                bounces={false} // For iOS
                overScrollMode="never" // For Android
            >
                <View style={baseStyles.container}>
                    <View style={styles.toggleRow}>
                        <Text style={baseStyles.subheadingText}>Mouse Acceleration</Text>
                        <Switch
                            value={mouseAccelerationEnabled}
                            onValueChange={setMouseAccelerationEnabled}
                            trackColor={{ false: "#505050", true: "#5a8f5a" }}
                            thumbColor="#e8e8e8"
                            ios_backgroundColor="#505050"
                        />
                    </View>
                    <Text style={styles.helpText}>
                        When mouse acceleration is enabled, fast strokes will travel farther.{"\n\n"}When mouse acceleration is disabled, the cursor will track one-to-one with the gesture.
                    </Text>
                </View>
                <View style={baseStyles.container}>
                    <Text style={baseStyles.subheadingText}>Cursor Speed</Text>
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
                <View style={baseStyles.container}>
                    <Text style={baseStyles.subheadingText}>Hold Detection Threshold</Text>
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
                    <Text style={styles.helpText}>
                        This slider adjusts the duration it is necessary to hold down a one finger tap before it is interpreted as a sustained left click.
                    </Text>
                </View>
                <View style={baseStyles.container}>
                    <Text style={baseStyles.subheadingText}>Tap Detection Threshold</Text>
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
                    <Text style={styles.helpText}>
                        This slider adjusts how generously tap events are interpreted as left clicks.
                        {"\n\n"}
                        A lower threshold will cause only very quick taps to be interpreted as clicks.
                        {"\n\n"}
                        A higher threshold will allow for a longer duration between the start of a tap and release to be interpreted as a click.
                    </Text>
                </View>
                <TouchableOpacity
                    style={[baseStyles.textButton, styles.resetToDefaultsButton]}
                    onPress={resetPointerSettingsToDefaults}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Reset pointer settings to defaults"
                >
                    <Text style={baseStyles.bodyText}>Reset to Defaults</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
        marginBottom: 10,
    },
    toggleLabel: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
        flex: 1,
        marginRight: 12
    },
    toggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    helpText: {
        fontSize: 14,
        color: "#b0b0b0",
        lineHeight: 20,
    },
    slider: {
        width: "100%",
        height: 40,
    },
    resetToDefaultsButton: {
        marginTop: 10,
        alignSelf: "stretch",
    },
});
