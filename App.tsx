import { useState, useRef, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  View,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MainScreen } from "./src/components/MainScreen";
import { SettingsScreen } from "./src/components/SettingsScreen/SettingsScreen";
import { GestureMappingsProvider } from "./src/context/gestureMappingsContext";
import { PointerSettingsProvider } from "./src/context/pointerSettingsContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_DURATION = 300;

export default function App() {
  const [screen, setScreen] = useState<"main" | "settings">("main");
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  useEffect(() => {
    if (screen === "settings") {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: SLIDE_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [screen, slideAnim]);

  const openSettings = () => setScreen("settings");

  const closeSettings = () => {
    Animated.timing(slideAnim, {
      toValue: -SCREEN_WIDTH,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => setScreen("main"));
  };

  return (
    <SafeAreaProvider>
      <GestureMappingsProvider>
        <PointerSettingsProvider>
          <View style={styles.container}>
            <StatusBar style="light" />
            <MainScreen onOpenSettings={openSettings} />
            <Animated.View
              style={[
                styles.settingsOverlay,
                { transform: [{ translateX: slideAnim }] },
              ]}
              pointerEvents={screen === "settings" ? "auto" : "none"}>
              <SettingsScreen onBack={closeSettings} />
            </Animated.View>
          </View>
        </PointerSettingsProvider>
      </GestureMappingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  settingsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    backgroundColor: "#323232",
  },
});