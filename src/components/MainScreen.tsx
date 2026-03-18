import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, Keyboard, PanResponder, Vibration } from "react-native";
import { apiService } from "../services/api";
import { useMutableValue } from "../hooks/useMutableValue";
import { useGestureMappings } from "../context/gestureMappingsContext";
import type { Action, GestureType } from "../types/gestureMappings";
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faKeyboard, faGear } from '@fortawesome/free-solid-svg-icons';
import type { Point } from "../interfaces/point";
import { SafeAreaView } from "react-native-safe-area-context";

export const MainScreen: React.FC<{ onOpenSettings?: () => void }> = ({ onOpenSettings }) => {
  const MOUSE_DOWN_HOLD_THRESHOLD_MS = 750;
  const MOUSE_DOWN_HOLD_MOVE_THRESHOLD_MS = 10;
  const JUMP_THRESHOLD_MS = 40;
  const MINIMUM_MS_BETWEEN_RELEASES = 50;
  const TAP_DETECTION_MS_THRESHOLD = 100;
  const MINIMUM_MS_BETWEEN_RIGHT_CLICKS = 200;
  const THREE_FINGER_SWIPE_UP_THRESHOLD_PX = 50;
  const THREE_FINGER_SWIPE_DOWN_THRESHOLD_PX = 50;

  const inputRef = useRef<TextInput>(null);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const lastMoveTime = useMutableValue(Date.now());
  const lastKeyPressTime = useMutableValue(Date.now());
  const timeGestureStarted = useMutableValue(Date.now());
  const timeLastRightClickOccurred = useMutableValue(Date.now());

  const lastKeyPressed = useMutableValue("");

  const holdStartTime = useMutableValue(-1);
  const holdStartPosition = useMutableValue<Point>({ x: -1, y: -1 });
  const isHolding = useMutableValue(false);

  const lastPosition = useMutableValue<Point>({ x: -1, y: -1 });
  const dx = useMutableValue(0);
  const dy = useMutableValue(0);
  const lastDx = useMutableValue(0);
  const lastDy = useMutableValue(0);

  const currentlyHandlingPanResponseGrant = useMutableValue(false);
  const timeOfLastPanResponderRelease = useMutableValue(Date.now());

  const wasTwoFingerGesture = useMutableValue(false);
  const wasThreeFingerGesture = useMutableValue(false);
  const threeFingerSwipeDy = useMutableValue(0);

  const { getActionForGesture } = useGestureMappings();
  const getActionRef = useRef(getActionForGesture);
  getActionRef.current = getActionForGesture;

  const runAction = useCallback((action: Action) => {
    switch (action) {
      case "LEFT_CLICK_MOUSE": apiService.clickMouse(); break;
      case "RIGHT_CLICK_MOUSE":
        if (Date.now() - timeLastRightClickOccurred.get() < MINIMUM_MS_BETWEEN_RIGHT_CLICKS)
          return;
        apiService.rightClickMouse();
        timeLastRightClickOccurred.set(Date.now());
        break;
      case "SWITCH_WINDOW": apiService.switchWindow(); break;
      case "TASK_VIEW": apiService.viewAllWindows(); break;
      case "CLOSE_WINDOW": apiService.closeWindow(); break;
      case "REFRESH_PAGE": apiService.refreshPage(); break;
      default: break;
    }
  }, []);

  const actionRunnerRef = useRef(runAction);
  actionRunnerRef.current = runAction;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: async (_, gestureState) => {
      if (inputVisible) {
        Keyboard.dismiss();
      }

      currentlyHandlingPanResponseGrant.set(true);

      lastMoveTime.set(Date.now());
      timeGestureStarted.set(Date.now());

      lastPosition.set({ x: -1, y: -1 });
      threeFingerSwipeDy.set(0);

      holdStartTime.set(Date.now());
      holdStartPosition.set({ x: gestureState.x0, y: gestureState.y0 });
      isHolding.set(false);

      currentlyHandlingPanResponseGrant.set(false);
    },
    onPanResponderMove: async (_, gestureState) => {
      wasTwoFingerGesture.set(gestureState.numberActiveTouches === 2);
      wasThreeFingerGesture.set(gestureState.numberActiveTouches === 3);
      const now = Date.now();
      const timeDiff = now - lastMoveTime.get();

      if (!isHolding.get() && holdStartTime.get() !== -1) {
        const holdDuration = now - holdStartTime.get();
        const holdStartPos = holdStartPosition.get();
        const currentPos = { x: gestureState.moveX, y: gestureState.moveY };

        const movementDistance = Math.sqrt(
          Math.pow(currentPos.x - holdStartPos.x, 2) +
          Math.pow(currentPos.y - holdStartPos.y, 2)
        );

        if (holdDuration > MOUSE_DOWN_HOLD_THRESHOLD_MS &&
          movementDistance < MOUSE_DOWN_HOLD_MOVE_THRESHOLD_MS) {
          isHolding.set(true);
          Vibration.vibrate(50);
          await apiService.mouseDown();
        }
      }

      if (timeDiff >= 16 && // 60 fps
        !currentlyHandlingPanResponseGrant.get()) {

        lastMoveTime.set(now);

        let currentPosition = { x: gestureState.moveX, y: gestureState.moveY };

        if (lastPosition.get().x == -1 || lastPosition.get().y == -1) {
          lastPosition.set(currentPosition);
        }

        dx.set(Math.round(dx.get() + (currentPosition.x - lastPosition.get().x)));
        dy.set(Math.round(dy.get() + (currentPosition.y - lastPosition.get().y)));

        if (dx.get() !== 0 || dy.get() !== 0) {
          switch (gestureState.numberActiveTouches) {
            case 1:
              apiService.moveMouse(dx.get(), dy.get());
              break;
            case 2:
              if (Math.abs(dx.get() - lastDx.get()) < JUMP_THRESHOLD_MS &&
                Math.abs(dy.get() - lastDy.get()) < JUMP_THRESHOLD_MS) {
                apiService.scrollMouse(dx.get(), dy.get());
              }
              break;
            case 3:
              threeFingerSwipeDy.set(threeFingerSwipeDy.get() + (currentPosition.y - lastPosition.get().y));
              break;
          }

          if (Math.round(dx.get()) !== 0) {
            dx.set(0);
          }

          if (Math.round(dy.get()) !== 0) {
            dy.set(0);
          }
        }

        lastPosition.set(currentPosition);
        lastDx.set(dx.get());
        lastDy.set(dy.get());
      }
    },
    onPanResponderRelease: async () => {
      const msSinceLastRelease = Date.now() - timeOfLastPanResponderRelease.get();
      const msSinceGestureStarted = Date.now() - timeGestureStarted.get();

      if (msSinceLastRelease < MINIMUM_MS_BETWEEN_RELEASES) {
        return;
      }

      if (isHolding.get()) {
        await apiService.mouseUp();
        isHolding.set(false);
      } else {
        let gestureType: GestureType | null = null;
        if (wasThreeFingerGesture.get() && threeFingerSwipeDy.get() < -THREE_FINGER_SWIPE_UP_THRESHOLD_PX) {
          gestureType = "THREE_FINGER_SWIPE_UP";
        } else if (wasThreeFingerGesture.get() && threeFingerSwipeDy.get() > THREE_FINGER_SWIPE_DOWN_THRESHOLD_PX) {
          gestureType = "THREE_FINGER_SWIPE_DOWN";
        } else if (msSinceGestureStarted < TAP_DETECTION_MS_THRESHOLD) {
          if (wasTwoFingerGesture.get())
            gestureType = "TWO_FINGER_TAP";
          else if (wasThreeFingerGesture.get())
            gestureType = "THREE_FINGER_TAP";
          else
            gestureType = "ONE_FINGER_TAP";
        }
        if (gestureType) {
          const action = getActionRef.current(gestureType);
          actionRunnerRef.current(action);
        }
      }
      holdStartTime.set(-1);
      holdStartPosition.set({ x: -1, y: -1 });
      timeOfLastPanResponderRelease.set(Date.now());
    },
    onPanResponderTerminate: async () => {
      if (isHolding.get()) {
        await apiService.mouseUp();
        isHolding.set(false);
      }

      holdStartTime.set(-1);
      holdStartPosition.set({ x: -1, y: -1 });
    },
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => false,
  }), []);

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      setInputVisible(false);
      setInputValue("");
      inputRef.current?.blur();
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (inputVisible) {
      inputRef.current?.focus();
    }
  }, [inputVisible]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topContainer} {...panResponder.panHandlers}>
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={inputValue}
          onKeyPress={(event) => {
            if ((event.nativeEvent.key === lastKeyPressed.get() &&
              Date.now() - lastKeyPressTime.get() > 200) ||
              event.nativeEvent.key !== lastKeyPressed.get()) {
              apiService.typeKey(event.nativeEvent.key);
              lastKeyPressTime.set(Date.now());
            }
            lastKeyPressed.set(event.nativeEvent.key);
          }}
          onSubmitEditing={() => {
            apiService.typeKey("Enter");
            lastKeyPressTime.set(Date.now());
            lastKeyPressed.set("Enter");
          }}
          multiline={false}
          keyboardType="default"
          autoCapitalize="none"
          returnKeyType="done"
        />
      </View>
      <View style={styles.bottomContainer}>
        {onOpenSettings && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onOpenSettings}>
            <FontAwesomeIcon icon={faGear as IconProp} size={26} color="white" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.keyboardButton}
          onPress={() => {
            setInputValue("");
            setInputVisible(true);
          }}>
          <FontAwesomeIcon icon={faKeyboard as IconProp} size={30} color="white" />
        </TouchableOpacity>
        <View style={styles.placeholder}>

        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    height: "100%",
    backgroundColor: "#090909"
  },
  topContainer: {
    flex: 1,
    backgroundColor: "#323232",
    borderRadius: 16,
    marginLeft: 5,
    marginRight: 5
  },
  bottomContainer: {
    flexDirection: "row",
    backgroundColor: "#323232",
    borderRadius: 16,
    margin: 5,
    height: 70
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    bottom: 20
  },
  settingsButton: {
    flex: 1,
    backgroundColor: "#404040",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16
  },
  keyboardButton: {
    flex: 2,
    backgroundColor: "#404040",
    padding: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  placeholder: {
    flex: 1,
    backgroundColor: "#404040",
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16
  },
  windowSwitchButton: {
    backgroundColor: "#42f554",
    padding: 10,
    borderRadius: 5,
    margin: 10,
    width: "90%",
    alignSelf: "center"
  },
  settingsBarButton: {
    backgroundColor: "#505050",
    padding: 10,
    borderRadius: 5,
    margin: 10,
    width: "90%",
    alignSelf: "center"
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  }
});