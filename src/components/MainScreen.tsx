import React, { useRef, useState, useEffect, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Text, TextInput, Keyboard, PanResponder, Vibration } from "react-native";
import { apiService } from "../services/api";
import { Point } from "../interfaces/point";
import { useMutableValue } from "../hooks/useMutableValue";

export const MainScreen: React.FC = () => {
  const MOUSE_DOWN_HOLD_THRESHOLD = 750;
  const MOUSE_DOWN_HOLD_MOVE_THRESHOLD = 10;

  const inputRef = useRef<TextInput>(null);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const lastMoveTime = useMutableValue(Date.now());
  const lastKeyPressTime = useMutableValue(Date.now());
  const lastClickTime = useMutableValue(Date.now());

  const lastKeyPressed = useMutableValue("");

  const holdStartTime = useMutableValue(-1);
  const holdStartPosition = useMutableValue<Point>({ x: -1, y: -1 });
  const isHolding = useMutableValue(false);

  const lastPosition = useMutableValue<Point>({ x: -1, y: -1 });
  const dx = useMutableValue(0);
  const dy = useMutableValue(0);

  const currentlyHandlingPanResponseGrant = useMutableValue(false);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: async (_, gestureState) => {
      currentlyHandlingPanResponseGrant.set(true);

      lastMoveTime.set(Date.now());
      lastClickTime.set(Date.now());

      lastPosition.set({ x: -1, y: -1 });

      holdStartTime.set(Date.now());
      holdStartPosition.set({ x: gestureState.x0, y: gestureState.y0 });
      isHolding.set(false);

      currentlyHandlingPanResponseGrant.set(false);
    },
    onPanResponderMove: async (_, gestureState) => {
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

        if (holdDuration > MOUSE_DOWN_HOLD_THRESHOLD &&
          movementDistance < MOUSE_DOWN_HOLD_MOVE_THRESHOLD) {
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

        dx.set(dx.get() + (currentPosition.x - lastPosition.get().x));
        dy.set(dy.get() + (currentPosition.y - lastPosition.get().y));

        lastPosition.set(currentPosition);

        if (Math.round(dx.get()) !== 0 || Math.round(dy.get()) !== 0) {
          apiService.moveMouse(Math.round(dx.get()), Math.round(dy.get()));

          if (Math.round(dx.get()) !== 0) {
            dx.set(0);
          }

          if (Math.round(dy.get()) !== 0) {
            dy.set(0);
          }
        }
      }
    },
    onPanResponderRelease: async () => {
      if (isHolding.get()) {
        await apiService.mouseUp();
        isHolding.set(false);
      } else if (Date.now() - lastClickTime.get() < 200) {
        apiService.clickMouse();
      }

      holdStartTime.set(-1);
      holdStartPosition.set({ x: -1, y: -1 });
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
    <View style={styles.parentContainer}>
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
          multiline={false}
          keyboardType="default"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.bottomContainer}>
        {!inputVisible && (
          <TouchableOpacity
            style={styles.keyboardButton}
            onPress={() => {
              setInputValue("");
              setInputVisible(true);
            }}>
            <Text style={styles.buttonText}>Show Keyboard</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  parentContainer: {
    height: "100%"
  },
  topContainer: {
    flex: 1
  },
  bottomContainer: {
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    bottom: 20
  },
  keyboardButton: {
    backgroundColor: "#4287f5",
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