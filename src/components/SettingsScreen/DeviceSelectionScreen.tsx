import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";

export const DeviceSelectionScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <FontAwesomeIcon icon={faChevronLeft} size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>Device Selection</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.placeholderText}>
                    Device selection options will appear here.
                </Text>
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
        padding: 16,
    },
    placeholderText: {
        fontSize: 16,
        color: "#aaa",
    },
});
