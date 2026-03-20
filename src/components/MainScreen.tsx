import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, Keyboard, PanResponder, Vibration } from "react-native";
import { apiService } from "../services/api";
import { useMutableValue } from "../hooks/useMutableValue";
import { useGestureMappings } from "../context/gestureMappingsContext";
import { usePointerSettings } from "../context/pointerSettingsContext";
import type { Action, GestureType } from "../types/gestureMappings";
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faKeyboard, faGear } from '@fortawesome/free-solid-svg-icons';
import type { Point } from "../interfaces/point";
import { SafeAreaView } from "react-native-safe-area-context";

/** Touch speed (px/ms) at or below → 1:1 cursor mapping (predictable fine control). */
const MOUSE_VELOCITY_PRECISION_MAX = 0.32;
/** Touch speed (px/ms) at or above → full sweep boost. */
const MOUSE_VELOCITY_SWEEP_MIN = 1.1;
/** Gain for slow / careful movement (must stay 1 so the cursor matches the finger). */
const MOUSE_GAIN_PRECISION = 1;
/** Cursor delta multiplier for fast, large strokes. */
const MOUSE_GAIN_SWEEP = 6;

function mouseGainForTouchVelocity(velocityPxPerMs: number): number {
  const span = MOUSE_VELOCITY_SWEEP_MIN - MOUSE_VELOCITY_PRECISION_MAX;
  const t = Math.min(1, Math.max(0, (velocityPxPerMs - MOUSE_VELOCITY_PRECISION_MAX) / span));
  return MOUSE_GAIN_PRECISION + t * (MOUSE_GAIN_SWEEP - MOUSE_GAIN_PRECISION);
}

export const MainScreen: React.FC<{ onOpenSettings?: () => void }> = ({ onOpenSettings }) => {
  const MOUSE_DOWN_HOLD_THRESHOLD_MS = 750;
  const MOUSE_DOWN_HOLD_MOVE_THRESHOLD_MS = 10;
  const JUMP_THRESHOLD_MS = 40;
  const MINIMUM_MS_BETWEEN_RELEASES = 50;
  /** Max touch duration (ms) to count as tap; relaxed so natural taps (~150–200ms) are not missed */
  const TAP_DETECTION_MS_THRESHOLD = 220;
  /** Max total movement (px) for one-finger to count as tap; above this = swipe (no action) */
  const ONE_FINGER_TAP_MAX_MOVEMENT_PX = 28;
  const MINIMUM_MS_BETWEEN_RIGHT_CLICKS = 200;
  const THREE_FINGER_SWIPE_UP_THRESHOLD_PX = 50;
  const THREE_FINGER_SWIPE_DOWN_THRESHOLD_PX = 50;
  const THREE_FINGER_SWIPE_LEFT_THRESHOLD_PX = 50;
  const THREE_FINGER_SWIPE_RIGHT_THRESHOLD_PX = 50;
  const TWO_FINGER_SWIPE_THRESHOLD_PX = 50;
  /** Pixels of vertical swipe per volume step (continuous volume). */
  const VOLUME_PX_PER_STEP = 18;
  /** Scale down 2-finger scroll deltas to avoid “jumpy” large steps. */
  const TWO_FINGER_SCROLL_DELTA_DIVISOR = 3;
  /** Ignore tiny jitter when determining 2-finger scroll updates. */
  const TWO_FINGER_SCROLL_DEADBAND_PX = 0.4;

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
  /** True if this gesture ever had 2+ fingers (hold is one-finger only). */
  const gestureEverHadMultipleFingers = useMutableValue(false);
  /** Previous active touch count, used to reset deltas when finger count changes. */
  const lastActiveTouchCount = useMutableValue(0);
  const twoFingerSwipeDx = useMutableValue(0);
  const twoFingerSwipeDy = useMutableValue(0);
  const threeFingerSwipeDx = useMutableValue(0);
  const threeFingerSwipeDy = useMutableValue(0);
  /** Total movement this gesture for one-finger (to distinguish tap vs swipe). */
  const oneFingerTotalDx = useMutableValue(0);
  const oneFingerTotalDy = useMutableValue(0);
  /** Fractional scaled movement left over after integer mouse steps (avoids losing tiny drags). */
  const mouseCarryX = useMutableValue(0);
  const mouseCarryY = useMutableValue(0);
  /** Volume steps already sent this gesture (so we send continuously during swipe). */
  const volumeUpStepsSentThisGesture = useMutableValue(0);
  const volumeDownStepsSentThisGesture = useMutableValue(0);

  const { getActionForGesture } = useGestureMappings();
  const { mouseAccelerationEnabled } = usePointerSettings();
  const getActionRef = useRef(getActionForGesture);
  getActionRef.current = getActionForGesture;
  const mouseAccelerationEnabledRef = useRef(mouseAccelerationEnabled);
  mouseAccelerationEnabledRef.current = mouseAccelerationEnabled;

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
      case "MEDIA_NEXT": apiService.mediaNext(); break;
      case "MEDIA_PREVIOUS": apiService.mediaPrevious(); break;
      case "MEDIA_PLAY_PAUSE": apiService.mediaPlayPause(); break;
      case "MEDIA_VOLUME_UP": apiService.mediaVolumeUp(); break;
      case "MEDIA_VOLUME_DOWN": apiService.mediaVolumeDown(); break;
      case "SCROLL_UP": apiService.scrollUp(); break;
      case "SCROLL_DOWN": apiService.scrollDown(); break;
      case "SCROLL_LEFT": apiService.scrollLeft(); break;
      case "SCROLL_RIGHT": apiService.scrollRight(); break;
      case "NONE": break;
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
      twoFingerSwipeDx.set(0);
      twoFingerSwipeDy.set(0);
      threeFingerSwipeDx.set(0);
      threeFingerSwipeDy.set(0);
      oneFingerTotalDx.set(0);
      oneFingerTotalDy.set(0);
      mouseCarryX.set(0);
      mouseCarryY.set(0);
      volumeUpStepsSentThisGesture.set(0);
      volumeDownStepsSentThisGesture.set(0);
      gestureEverHadMultipleFingers.set(false);
      wasTwoFingerGesture.set(false);
      wasThreeFingerGesture.set(false);
      lastActiveTouchCount.set(gestureState.numberActiveTouches);

      holdStartTime.set(Date.now());
      holdStartPosition.set({ x: gestureState.x0, y: gestureState.y0 });
      isHolding.set(false);

      currentlyHandlingPanResponseGrant.set(false);
    },
    onPanResponderMove: async (_, gestureState) => {
      const touchCount = gestureState.numberActiveTouches;
      if (gestureState.numberActiveTouches >= 2) {
        gestureEverHadMultipleFingers.set(true);
      }

      // If the user changes the finger count mid-gesture (e.g. 1 -> 2),
      // reset our delta baselines for smooth scrolling and to avoid sign flips.
      if (touchCount !== lastActiveTouchCount.get()) {
        lastActiveTouchCount.set(touchCount);
        const currentPosition = { x: gestureState.moveX, y: gestureState.moveY };
        lastPosition.set(currentPosition);
        dx.set(0);
        dy.set(0);
        lastDx.set(0);
        lastDy.set(0);
        twoFingerSwipeDx.set(0);
        twoFingerSwipeDy.set(0);
        threeFingerSwipeDx.set(0);
        threeFingerSwipeDy.set(0);
        mouseCarryX.set(0);
        mouseCarryY.set(0);
        // Don't emit an action on the transition frame.
        lastMoveTime.set(Date.now());
        return;
      }

      wasTwoFingerGesture.set(touchCount === 2);
      wasThreeFingerGesture.set(touchCount === 3);
      const now = Date.now();
      const timeDiff = now - lastMoveTime.get();

      // Hold (mouse down) only for one-finger-only gestures; never trigger if this gesture ever had 2+ fingers
      if (gestureState.numberActiveTouches === 1 && !gestureEverHadMultipleFingers.get() && !isHolding.get() && holdStartTime.get() !== -1) {
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

        const rawDx = currentPosition.x - lastPosition.get().x;
        const rawDy = currentPosition.y - lastPosition.get().y;

        dx.set(Math.round(dx.get() + rawDx));
        dy.set(Math.round(dy.get() + rawDy));

        if (dx.get() !== 0 || dy.get() !== 0) {
          switch (gestureState.numberActiveTouches) {
            case 1:
              oneFingerTotalDx.set(oneFingerTotalDx.get() + rawDx);
              oneFingerTotalDy.set(oneFingerTotalDy.get() + rawDy);
              // If the current gesture ever had 2+ fingers, we are in a multi-touch gesture
              // (e.g. 2-finger scroll). In that case, do not move the mouse when touch count
              // temporarily drops to 1, otherwise we get “wild jumps”.
              if (!gestureEverHadMultipleFingers.get()) {
                const dist = Math.hypot(rawDx, rawDy);
                const velocity = dist / Math.max(timeDiff, 1);
                const gain = mouseAccelerationEnabledRef.current
                  ? mouseGainForTouchVelocity(velocity)
                  : 1;
                mouseCarryX.set(mouseCarryX.get() + rawDx * gain);
                mouseCarryY.set(mouseCarryY.get() + rawDy * gain);
                const cx = mouseCarryX.get();
                const cy = mouseCarryY.get();
                const moveDx = Math.trunc(cx);
                const moveDy = Math.trunc(cy);
                mouseCarryX.set(cx - moveDx);
                mouseCarryY.set(cy - moveDy);
                if (moveDx !== 0 || moveDy !== 0) {
                  apiService.moveMouse(moveDx, moveDy);
                }
              }
              break;
            case 2: {
              twoFingerSwipeDx.set(twoFingerSwipeDx.get() + (currentPosition.x - lastPosition.get().x));
              twoFingerSwipeDy.set(twoFingerSwipeDy.get() + (currentPosition.y - lastPosition.get().y));
              const scrollActions: Action[] = ["SCROLL_UP", "SCROLL_DOWN", "SCROLL_LEFT", "SCROLL_RIGHT"];
              const twoFingerSwipeGestures: GestureType[] = ["TWO_FINGER_SWIPE_UP", "TWO_FINGER_SWIPE_DOWN", "TWO_FINGER_SWIPE_LEFT", "TWO_FINGER_SWIPE_RIGHT"];
              const twoFingerMappedToScroll = twoFingerSwipeGestures.some((g) => scrollActions.includes(getActionRef.current(g)));
              // Use per-frame finger deltas instead of `dx/dy` + `lastDx/lastDy` gating.
              // The old gating could skip frames when the delta exceeded `JUMP_THRESHOLD_MS`,
              // producing a “jumpy” scroll.
              if (twoFingerMappedToScroll) {
                const deltaX = currentPosition.x - lastPosition.get().x;
                const deltaY = currentPosition.y - lastPosition.get().y;
                if (Math.abs(deltaX) >= TWO_FINGER_SCROLL_DEADBAND_PX || Math.abs(deltaY) >= TWO_FINGER_SCROLL_DEADBAND_PX) {
                  apiService.scrollMouse(deltaX / TWO_FINGER_SCROLL_DELTA_DIVISOR, deltaY / TWO_FINGER_SCROLL_DELTA_DIVISOR);
                }
              }
              break;
            }
            case 3: {
              threeFingerSwipeDx.set(threeFingerSwipeDx.get() + (currentPosition.x - lastPosition.get().x));
              threeFingerSwipeDy.set(threeFingerSwipeDy.get() + (currentPosition.y - lastPosition.get().y));
              const thdY = threeFingerSwipeDy.get();
              if (getActionRef.current("THREE_FINGER_SWIPE_UP") === "MEDIA_VOLUME_UP" && thdY < 0) {
                const stepsUp = Math.floor(-thdY / VOLUME_PX_PER_STEP);
                const delta = stepsUp - volumeUpStepsSentThisGesture.get();
                if (delta > 0) {
                  apiService.mediaVolumeUp(delta);
                  volumeUpStepsSentThisGesture.set(stepsUp);
                }
              }
              if (getActionRef.current("THREE_FINGER_SWIPE_DOWN") === "MEDIA_VOLUME_DOWN" && thdY > 0) {
                const stepsDown = Math.floor(thdY / VOLUME_PX_PER_STEP);
                const delta = stepsDown - volumeDownStepsSentThisGesture.get();
                if (delta > 0) {
                  apiService.mediaVolumeDown(delta);
                  volumeDownStepsSentThisGesture.set(stepsDown);
                }
              }
              break;
            }
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
        const dx2 = twoFingerSwipeDx.get();
        const dy2 = twoFingerSwipeDy.get();
        const dx3 = threeFingerSwipeDx.get();
        const dy3 = threeFingerSwipeDy.get();
        const twoFingerSwipeDist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const threeFingerSwipeDistVert = Math.abs(dy3);
        const threeFingerSwipeDistHorz = Math.abs(dx3);

        if (wasTwoFingerGesture.get() && twoFingerSwipeDist >= TWO_FINGER_SWIPE_THRESHOLD_PX) {
          if (Math.abs(dy2) >= Math.abs(dx2)) {
            gestureType = dy2 < 0 ? "TWO_FINGER_SWIPE_UP" : "TWO_FINGER_SWIPE_DOWN";
          } else {
            gestureType = dx2 < 0 ? "TWO_FINGER_SWIPE_LEFT" : "TWO_FINGER_SWIPE_RIGHT";
          }
        } else if (wasThreeFingerGesture.get() && (threeFingerSwipeDistVert >= THREE_FINGER_SWIPE_UP_THRESHOLD_PX || threeFingerSwipeDistHorz >= THREE_FINGER_SWIPE_LEFT_THRESHOLD_PX)) {
          if (threeFingerSwipeDistVert >= threeFingerSwipeDistHorz) {
            gestureType = dy3 < 0 ? "THREE_FINGER_SWIPE_UP" : "THREE_FINGER_SWIPE_DOWN";
          } else {
            gestureType = dx3 < 0 ? "THREE_FINGER_SWIPE_LEFT" : "THREE_FINGER_SWIPE_RIGHT";
          }
        } else if (msSinceGestureStarted < TAP_DETECTION_MS_THRESHOLD) {
          if (wasTwoFingerGesture.get())
            gestureType = "TWO_FINGER_TAP";
          else if (wasThreeFingerGesture.get())
            gestureType = "THREE_FINGER_TAP";
          else {
            // Don't treat it as a one-finger tap if this gesture ever had 2+ fingers.
            if (gestureEverHadMultipleFingers.get()) {
              gestureType = null;
            } else {
            const oneFingerDist = Math.sqrt(oneFingerTotalDx.get() ** 2 + oneFingerTotalDy.get() ** 2);
            if (oneFingerDist <= ONE_FINGER_TAP_MAX_MOVEMENT_PX)
              gestureType = "ONE_FINGER_TAP";
            }
          }
        }
        if (gestureType) {
          const action = getActionRef.current(gestureType);
          const isVolumeUpSwipe = (gestureType === "THREE_FINGER_SWIPE_UP" || gestureType === "THREE_FINGER_SWIPE_DOWN") && action === "MEDIA_VOLUME_UP";
          const isVolumeDownSwipe = (gestureType === "THREE_FINGER_SWIPE_UP" || gestureType === "THREE_FINGER_SWIPE_DOWN") && action === "MEDIA_VOLUME_DOWN";
          if (isVolumeUpSwipe) {
            const totalSteps = Math.max(1, Math.floor(threeFingerSwipeDistVert / VOLUME_PX_PER_STEP));
            const remainder = totalSteps - volumeUpStepsSentThisGesture.get();
            if (remainder > 0) apiService.mediaVolumeUp(remainder);
          } else if (isVolumeDownSwipe) {
            const totalSteps = Math.max(1, Math.floor(threeFingerSwipeDistVert / VOLUME_PX_PER_STEP));
            const remainder = totalSteps - volumeDownStepsSentThisGesture.get();
            if (remainder > 0) apiService.mediaVolumeDown(remainder);
          } else {
            actionRunnerRef.current(action);
          }
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