import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { faChevronLeft, faChevronRight, faArrowPointer, faComputer } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { GestureMappingsScreen } from "./GestureMappingsScreen";
import { PointerSettingsScreen } from "./PointerSettingsScreen";
import { DeviceSelectionScreen } from "./DeviceSelectionScreen";
import { baseStyles } from "../../styles/base";

type SettingsSubScreen = "gestureMappings" | "pointerSettings" | "deviceSelection" | null;

export const SettingsScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [subScreen, setSubScreen] = useState<SettingsSubScreen>(null);

    return (
        <SafeAreaView style={baseStyles.safeArea}>
            {subScreen === "gestureMappings" && (
                <GestureMappingsScreen onBack={() => setSubScreen(null)} />
            )}
            {subScreen === "pointerSettings" && (
                <PointerSettingsScreen onBack={() => setSubScreen(null)} />
            )}
            {subScreen === "deviceSelection" && (
                <DeviceSelectionScreen onBack={() => setSubScreen(null)} />
            )}
            {subScreen === null && (
                <View style={baseStyles.canvas}>
                    <View style={baseStyles.headingContainer}>
                        {onBack && (
                            <TouchableOpacity style={baseStyles.headingBackButton} onPress={onBack}>
                                <FontAwesomeIcon icon={faChevronLeft} size={24} color="white" />
                            </TouchableOpacity>
                        )}
                        <Text style={baseStyles.headingText}>Settings</Text>
                    </View>
                    <ScrollView
                        contentContainerStyle={baseStyles.scrollViewContentContainer}>
                        <TouchableOpacity
                            style={baseStyles.menuItem}
                            onPress={() => setSubScreen("gestureMappings")}
                            activeOpacity={0.7}>
                            <View style={baseStyles.menuItemLabel}>
                                <Image source={require("../../../resources/images/oneFinger.png")} style={{ width: 25, height: 25 }} />
                                <Text style={baseStyles.bodyText}>Gesture Mappings</Text>
                            </View>
                            <FontAwesomeIcon icon={faChevronRight} size={20} color="#aaaaaa" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={baseStyles.menuItem}
                            onPress={() => setSubScreen("pointerSettings")}
                            activeOpacity={0.7}>
                            <View style={baseStyles.menuItemLabel}>
                                <FontAwesomeIcon icon={faArrowPointer} size={20} color="#ffffff" />
                                <Text style={baseStyles.bodyText}>Pointer Settings</Text>
                            </View>
                            <FontAwesomeIcon icon={faChevronRight} size={20} color="#aaaaaa" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={baseStyles.menuItem}
                            onPress={() => setSubScreen("deviceSelection")}
                            activeOpacity={0.7}>
                            <View style={baseStyles.menuItemLabel}>
                                <FontAwesomeIcon icon={faComputer} size={20} color="#ffffff" />
                                <Text style={baseStyles.bodyText}>Device Selection</Text>
                            </View>
                            <FontAwesomeIcon icon={faChevronRight} size={20} color="#aaaaaa" />
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}
        </SafeAreaView>
    );
};