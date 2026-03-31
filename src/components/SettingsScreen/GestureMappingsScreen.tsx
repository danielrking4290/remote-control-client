import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Pressable,
    Modal,
    Image,
    type ImageStyle,
} from "react-native";
import { getIconForAction, getIconForGesture, useGestureMappings } from "../../context/gestureMappingsContext";
import {
    type GestureType,
    type Action,
    GestureMappings
} from "../../types/gestureMappings";
import { faChevronDown, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { baseStyles } from "../../styles/base";

interface GestureOption {
    id: GestureType;
    label: string;
}

interface ActionOption {
    id: Action;
    label: string;
}

const GestureOptions: GestureOption[] = [
    { id: "ONE_FINGER_TAP", label: "1F Tap" },
    { id: "TWO_FINGER_TAP", label: "2F Tap" },
    { id: "TWO_FINGER_SWIPE_UP", label: "2F Up" },
    { id: "TWO_FINGER_SWIPE_DOWN", label: "2F Down" },
    { id: "TWO_FINGER_SWIPE_LEFT", label: "2F Left" },
    { id: "TWO_FINGER_SWIPE_RIGHT", label: "2F Right" },
    { id: "THREE_FINGER_TAP", label: "3F Tap" },
    { id: "THREE_FINGER_SWIPE_UP", label: "3F Up" },
    { id: "THREE_FINGER_SWIPE_DOWN", label: "3F Down" },
    { id: "THREE_FINGER_SWIPE_LEFT", label: "3F Left" },
    { id: "THREE_FINGER_SWIPE_RIGHT", label: "3F Right" }
];

const ActionOptions: ActionOption[] = [
    { id: "LEFT_CLICK_MOUSE", label: "Left Click" },
    { id: "RIGHT_CLICK_MOUSE", label: "Right Click" },
    { id: "SWITCH_WINDOW", label: "Switch Window" },
    { id: "TASK_VIEW", label: "Task View" },
    { id: "CLOSE_WINDOW", label: "Close Window" },
    { id: "REFRESH_PAGE", label: "Refresh Page" },
    { id: "MEDIA_NEXT", label: "Next" },
    { id: "MEDIA_PREVIOUS", label: "Previous" },
    { id: "MEDIA_PLAY_PAUSE", label: "Play/Pause" },
    { id: "MEDIA_VOLUME_UP", label: "Volume Up" },
    { id: "MEDIA_VOLUME_DOWN", label: "Volume Down" },
    { id: "SCROLL_UP", label: "Scroll Up" },
    { id: "SCROLL_DOWN", label: "Scroll Down" },
    { id: "SCROLL_LEFT", label: "Scroll Left" },
    { id: "SCROLL_RIGHT", label: "Scroll Right" },
    { id: "NONE", label: "None" }
];

const SCROLL_ACTIONS: Action[] = ["SCROLL_UP", "SCROLL_DOWN", "SCROLL_LEFT", "SCROLL_RIGHT"];

function isSwipeGesture(gesture: GestureType): boolean {
    return gesture.includes("SWIPE");
}

function isScrollAction(action: Action): boolean {
    return SCROLL_ACTIONS.includes(action);
}

function getActionLabel(actionId: Action): string {
    return ActionOptions.find((a) => a.id === actionId)?.label ?? actionId;
}

function getStyleClassForAction(actionId: Action): ImageStyle {
    switch (actionId) {
        case "MEDIA_PLAY_PAUSE":
        case "MEDIA_VOLUME_UP":
        case "MEDIA_VOLUME_DOWN":
        case "MEDIA_NEXT":
        case "MEDIA_PREVIOUS":
            return baseStyles.mediaIcon;
        default:
            return baseStyles.actionIcon;
    }
}

export const GestureMappingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { mappings, setMapping, resetToDefaults } = useGestureMappings();
    const [pickerGesture, setPickerGesture] = useState<GestureType | null>(null);

    return (
        <>
            <View style={baseStyles.headingContainer}>
                <TouchableOpacity style={baseStyles.headingBackButton} onPress={onBack}>
                    <FontAwesomeIcon icon={faChevronLeft} size={24} color="white" />
                </TouchableOpacity>
                <Text style={baseStyles.headingText}>Gesture Mappings</Text>
            </View>

            <ScrollView
                style={baseStyles.scrollView}
                contentContainerStyle={baseStyles.scrollViewContentContainer}
                showsVerticalScrollIndicator
                bounces={false} // For iOS
                overScrollMode="never" // For Android
            >
                {GestureOptions.map((gesture) => (
                    <View key={gesture.id} style={baseStyles.mappingFormControl}>
                        <View style={baseStyles.mappingFormLabel}>
                            <View style={baseStyles.menuItemLabel}>
                                <Image source={getIconForGesture(gesture.id)} style={baseStyles.menuItemIcon} />

                                <Text style={baseStyles.bodyText}>{gesture.label}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={baseStyles.mappingFormActionButton}
                            onPress={() => setPickerGesture(gesture.id)}
                            activeOpacity={0.7}>
                            <View style={baseStyles.mappingFormActionIconContainer}>
                                <Image source={getIconForAction(mappings[gesture.id])} style={getStyleClassForAction(mappings[gesture.id])} />
                            </View>
                            <View style={baseStyles.mappingFormActionLabelContainer}>
                                <Text
                                    style={baseStyles.bodyText}
                                    numberOfLines={1}>
                                    {getActionLabel(mappings[gesture.id])}
                                </Text>
                            </View>
                            <View style={baseStyles.mappingFormChevronIconContainer}>
                                <FontAwesomeIcon icon={faChevronRight} size={15} color="#aaaaaa" />
                            </View>
                        </TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity
                    key="resetToDefaults"
                    style={baseStyles.textButton}
                    onPress={resetToDefaults}
                    activeOpacity={0.7}>
                    <Text style={baseStyles.bodyText}>Reset to Defaults</Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal
                visible={pickerGesture !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setPickerGesture(null)}>
                <View style={baseStyles.modalBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => setPickerGesture(null)}
                    />
                    <View style={baseStyles.modalContent}>
                        <View style={baseStyles.modalHeader}>
                            <Image source={getIconForGesture(pickerGesture!)} style={baseStyles.menuItemIcon} />

                            <Text style={baseStyles.subheadingText}>{GestureOptions.find((g) => g.id === pickerGesture)?.label}</Text>
                        </View>
                        <ScrollView
                            style={baseStyles.modalScrollView}
                            contentContainerStyle={baseStyles.modalScrollContent}
                            showsVerticalScrollIndicator>
                            {ActionOptions.filter((action) => {
                                // Scroll actions can only be mapped to swipe gestures
                                if (pickerGesture && !isSwipeGesture(pickerGesture) && isScrollAction(action.id)) {
                                    return false;
                                }
                                return true;
                            }).map((action) => (
                                <TouchableOpacity
                                    key={action.id}
                                    style={[
                                        baseStyles.textButton,
                                        pickerGesture &&
                                        mappings[pickerGesture] === action.id &&
                                        baseStyles.textButtonSelected,
                                    ]}
                                    onPress={() => {
                                        if (pickerGesture) {
                                            setMapping(pickerGesture, action.id);
                                            setPickerGesture(null);
                                        }
                                    }}
                                    activeOpacity={0.7}>
                                    <View style={baseStyles.buttonLabelContainer}>
                                        <View style={baseStyles.buttonLabelIconContainer}>
                                            <Image source={getIconForAction(action.id)} style={getStyleClassForAction(action.id)} />
                                        </View>
                                        <View style={baseStyles.buttonLabelTextContainer}>
                                            <Text
                                                style={[
                                                    baseStyles.bodyText,
                                                    pickerGesture &&
                                                    mappings[pickerGesture] === action.id &&
                                                    baseStyles.textButtonSelected
                                                ]}>
                                                {action.label}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <View style={baseStyles.modalFooter}>
                            <TouchableOpacity
                                style={baseStyles.dismissModalButton}
                                onPress={() => setPickerGesture(null)}>
                                <FontAwesomeIcon icon={faChevronDown} size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    
    
});
