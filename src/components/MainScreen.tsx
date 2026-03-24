import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, Keyboard, PanResponder, Vibration } from "react-native";
import type { GestureResponderEvent } from "react-native";
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
const MOUSE_VELOCITY_PRECISION_MAX = 0.42;
/** Touch speed (px/ms) at or above → full sweep boost (high so only sharp flicks hit max gain). */
const MOUSE_VELOCITY_SWEEP_MIN = 2.35;
/** Gain for slow / careful movement (must stay 1 so the cursor matches the finger). */
const MOUSE_GAIN_PRECISION = 1;
/** Cursor delta multiplier for fast, large strokes. */
const MOUSE_GAIN_SWEEP = 6;

function mouseGainForTouchVelocity(velocityPxPerMs: number): number {
  const span = MOUSE_VELOCITY_SWEEP_MIN - MOUSE_VELOCITY_PRECISION_MAX;
  const t = Math.min(1, Math.max(0, (velocityPxPerMs - MOUSE_VELOCITY_PRECISION_MAX) / span));
  return MOUSE_GAIN_PRECISION + t * (MOUSE_GAIN_SWEEP - MOUSE_GAIN_PRECISION);
}

/** Two-finger scroll: same velocity idea as the cursor, but lower max gain (scroll stacks every frame). */
const SCROLL_VELOCITY_PRECISION_MAX = 0.42;
const SCROLL_VELOCITY_SWEEP_MIN = 2.2;
const SCROLL_GAIN_PRECISION = 1;
const SCROLL_GAIN_SWEEP = 3.25;

function scrollGainForTouchVelocity(velocityPxPerMs: number): number {
  const span = SCROLL_VELOCITY_SWEEP_MIN - SCROLL_VELOCITY_PRECISION_MAX;
  const t = Math.min(1, Math.max(0, (velocityPxPerMs - SCROLL_VELOCITY_PRECISION_MAX) / span));
  return SCROLL_GAIN_PRECISION + t * (SCROLL_GAIN_SWEEP - SCROLL_GAIN_PRECISION);
}

/** PanResponder's `numberActiveTouches` often stays at 2 for 3+ fingers; `touches.length` is usually correct. */
function resolveTouchCount(evt: GestureResponderEvent, numberActiveTouches: number): number {
  return Math.max(numberActiveTouches, evt.nativeEvent.touches.length);
}

function isDiscreteScrollAction(action: Action): boolean {
  return (
    action === "SCROLL_UP" ||
    action === "SCROLL_DOWN" ||
    action === "SCROLL_LEFT" ||
    action === "SCROLL_RIGHT"
  );
}

function isMultiFingerSwipeGestureType(gestureType: GestureType): boolean {
  return (
    gestureType.startsWith("TWO_FINGER_SWIPE_") ||
    gestureType.startsWith("THREE_FINGER_SWIPE_")
  );
}

export const MainScreen: React.FC<{ onOpenSettings?: () => void }> = ({ onOpenSettings }) => {
  const MOUSE_DOWN_HOLD_MOVE_THRESHOLD_MS = 10;
  const MINIMUM_MS_BETWEEN_RELEASES = 50;
  /** Max total movement (px) for one-finger to count as tap; above this = swipe (no action) */
  const ONE_FINGER_TAP_MAX_MOVEMENT_PX = 28;
  const MINIMUM_MS_BETWEEN_RIGHT_CLICKS = 200;
  const THREE_FINGER_SWIPE_UP_THRESHOLD_PX = 50;
  const THREE_FINGER_SWIPE_LEFT_THRESHOLD_PX = 50;
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
  /** True if this gesture ever had 3 touches (release may see fewer fingers first). */
  const everHadThreeFingers = useMutableValue(false);
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
  const {
    mouseAccelerationEnabled,
    cursorSpeed,
    holdDetectionThreshold,
    tapDetectionThreshold,
  } = usePointerSettings();
  const getActionRef = useRef(getActionForGesture);
  getActionRef.current = getActionForGesture;
  const mouseAccelerationEnabledRef = useRef(mouseAccelerationEnabled);
  mouseAccelerationEnabledRef.current = mouseAccelerationEnabled;
  const cursorSpeedRef = useRef(cursorSpeed);
  cursorSpeedRef.current = cursorSpeed;
  const holdDetectionThresholdRef = useRef(holdDetectionThreshold);
  holdDetectionThresholdRef.current = holdDetectionThreshold;
  const tapDetectionThresholdRef = useRef(tapDetectionThreshold);
  tapDetectionThresholdRef.current = tapDetectionThreshold;

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
    onPanResponderGrant: async (evt, gestureState) => {
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
      everHadThreeFingers.set(false);
      lastActiveTouchCount.set(resolveTouchCount(evt, gestureState.numberActiveTouches));

      holdStartTime.set(Date.now());
      holdStartPosition.set({ x: gestureState.x0, y: gestureState.y0 });
      isHolding.set(false);

      currentlyHandlingPanResponseGrant.set(false);
    },
    onPanResponderMove: async (evt, gestureState) => {
      const touchCount = resolveTouchCount(evt, gestureState.numberActiveTouches);
      if (touchCount >= 2) {
        gestureEverHadMultipleFingers.set(true);
      }

      // If the user changes the finger count mid-gesture (e.g. 1 -> 2),
      // reset our delta baselines for smooth scrolling and to avoid sign flips.
      if (touchCount !== lastActiveTouchCount.get()) {
        const prevCount = lastActiveTouchCount.get();
        lastActiveTouchCount.set(touchCount);
        const currentPosition = { x: gestureState.moveX, y: gestureState.moveY };
        lastPosition.set(currentPosition);
        dx.set(0);
        dy.set(0);
        lastDx.set(0);
        lastDy.set(0);
        twoFingerSwipeDx.set(0);
        twoFingerSwipeDy.set(0);
        // Dropping below 3 fingers often happens before release; keep totals so swipe
        // classification and scroll-on-release still see the full 3-finger stroke.
        if (!(prevCount === 3 && touchCount < 3)) {
          threeFingerSwipeDx.set(0);
          threeFingerSwipeDy.set(0);
        }
        mouseCarryX.set(0);
        mouseCarryY.set(0);
        // Don't emit an action on the transition frame.
        lastMoveTime.set(Date.now());
        return;
      }

      wasTwoFingerGesture.set(touchCount === 2);
      wasThreeFingerGesture.set(touchCount === 3);
      if (touchCount >= 3) {
        everHadThreeFingers.set(true);
      }
      const now = Date.now();
      const timeDiff = now - lastMoveTime.get();

      // Hold (mouse down) only for one-finger-only gestures; never trigger if this gesture ever had 2+ fingers
      if (touchCount === 1 && !gestureEverHadMultipleFingers.get() && !isHolding.get() && holdStartTime.get() !== -1) {
        const holdDuration = now - holdStartTime.get();
        const holdStartPos = holdStartPosition.get();
        const currentPos = { x: gestureState.moveX, y: gestureState.moveY };

        const movementDistance = Math.sqrt(
          Math.pow(currentPos.x - holdStartPos.x, 2) +
          Math.pow(currentPos.y - holdStartPos.y, 2)
        );

        const holdMs =
          300 + (holdDetectionThresholdRef.current / 100) * 900;
        if (holdDuration > holdMs &&
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
          const touchMode = touchCount >= 3 ? 3 : touchCount === 2 ? 2 : 1;
          switch (touchMode) {
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
                const cursorMult = Math.max(0.2, cursorSpeedRef.current / 50);
                mouseCarryX.set(mouseCarryX.get() + rawDx * gain * cursorMult);
                mouseCarryY.set(mouseCarryY.get() + rawDy * gain * cursorMult);
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
              const rawDeltaX = currentPosition.x - lastPosition.get().x;
              const rawDeltaY = currentPosition.y - lastPosition.get().y;
              const scrollVerticalActions: Action[] = ["SCROLL_UP", "SCROLL_DOWN"];
              const scrollHorizontalActions: Action[] = ["SCROLL_LEFT", "SCROLL_RIGHT"];
              const verticalScrollFromThreeFinger =
                scrollVerticalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_UP")) ||
                scrollVerticalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_DOWN"));
              const horizontalScrollFromThreeFinger =
                scrollHorizontalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_LEFT")) ||
                scrollHorizontalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_RIGHT"));
              const threeFingerMappedToScroll = verticalScrollFromThreeFinger || horizontalScrollFromThreeFinger;
              const verticalScrollFromTwoFinger =
                scrollVerticalActions.includes(getActionRef.current("TWO_FINGER_SWIPE_UP")) ||
                scrollVerticalActions.includes(getActionRef.current("TWO_FINGER_SWIPE_DOWN"));
              const horizontalScrollFromTwoFinger =
                scrollHorizontalActions.includes(getActionRef.current("TWO_FINGER_SWIPE_LEFT")) ||
                scrollHorizontalActions.includes(getActionRef.current("TWO_FINGER_SWIPE_RIGHT"));
              const twoFingerMappedToScroll = verticalScrollFromTwoFinger || horizontalScrollFromTwoFinger;
              // After a real 3-finger phase, one finger often lifts first; we drop to touchCount 2
              // while 2-finger scroll is NONE (cleared when 3-finger took those actions). Keep using
              // 3-finger scroll + totals until the gesture ends.
              const continueAsThreeFinger =
                everHadThreeFingers.get() && threeFingerMappedToScroll;
              if (continueAsThreeFinger) {
                threeFingerSwipeDx.set(threeFingerSwipeDx.get() + rawDeltaX);
                threeFingerSwipeDy.set(threeFingerSwipeDy.get() + rawDeltaY);
                const deltaX = horizontalScrollFromThreeFinger ? rawDeltaX : 0;
                const deltaY = verticalScrollFromThreeFinger ? rawDeltaY : 0;
                if (Math.abs(deltaX) >= TWO_FINGER_SCROLL_DEADBAND_PX || Math.abs(deltaY) >= TWO_FINGER_SCROLL_DEADBAND_PX) {
                  const dist = Math.hypot(deltaX, deltaY);
                  const velocity = dist / Math.max(timeDiff, 1);
                  const gain = mouseAccelerationEnabledRef.current
                    ? scrollGainForTouchVelocity(velocity)
                    : 1;
                  apiService.scrollMouse(
                    (deltaX * gain) / TWO_FINGER_SCROLL_DELTA_DIVISOR,
                    (deltaY * gain) / TWO_FINGER_SCROLL_DELTA_DIVISOR
                  );
                }
              } else {
                twoFingerSwipeDx.set(twoFingerSwipeDx.get() + rawDeltaX);
                twoFingerSwipeDy.set(twoFingerSwipeDy.get() + rawDeltaY);
                // Use per-frame finger deltas instead of `dx/dy` + `lastDx/lastDy` gating.
                // Only send each axis if that axis’ swipe pair is mapped to scroll.
                if (twoFingerMappedToScroll) {
                  const deltaX = horizontalScrollFromTwoFinger ? rawDeltaX : 0;
                  const deltaY = verticalScrollFromTwoFinger ? rawDeltaY : 0;
                  if (Math.abs(deltaX) >= TWO_FINGER_SCROLL_DEADBAND_PX || Math.abs(deltaY) >= TWO_FINGER_SCROLL_DEADBAND_PX) {
                    const dist = Math.hypot(deltaX, deltaY);
                    const velocity = dist / Math.max(timeDiff, 1);
                    const gain = mouseAccelerationEnabledRef.current
                      ? scrollGainForTouchVelocity(velocity)
                      : 1;
                    apiService.scrollMouse(
                      (deltaX * gain) / TWO_FINGER_SCROLL_DELTA_DIVISOR,
                      (deltaY * gain) / TWO_FINGER_SCROLL_DELTA_DIVISOR
                    );
                  }
                }
              }
              break;
            }
            case 3: {
              threeFingerSwipeDx.set(threeFingerSwipeDx.get() + (currentPosition.x - lastPosition.get().x));
              threeFingerSwipeDy.set(threeFingerSwipeDy.get() + (currentPosition.y - lastPosition.get().y));
              const scrollVerticalActions: Action[] = ["SCROLL_UP", "SCROLL_DOWN"];
              const scrollHorizontalActions: Action[] = ["SCROLL_LEFT", "SCROLL_RIGHT"];
              const verticalScrollFromThreeFinger =
                scrollVerticalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_UP")) ||
                scrollVerticalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_DOWN"));
              const horizontalScrollFromThreeFinger =
                scrollHorizontalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_LEFT")) ||
                scrollHorizontalActions.includes(getActionRef.current("THREE_FINGER_SWIPE_RIGHT"));
              const threeFingerMappedToScroll = verticalScrollFromThreeFinger || horizontalScrollFromThreeFinger;
              if (threeFingerMappedToScroll) {
                const rawDeltaX = currentPosition.x - lastPosition.get().x;
                const rawDeltaY = currentPosition.y - lastPosition.get().y;
                const deltaX = horizontalScrollFromThreeFinger ? rawDeltaX : 0;
                const deltaY = verticalScrollFromThreeFinger ? rawDeltaY : 0;
                if (Math.abs(deltaX) >= TWO_FINGER_SCROLL_DEADBAND_PX || Math.abs(deltaY) >= TWO_FINGER_SCROLL_DEADBAND_PX) {
                  const dist = Math.hypot(deltaX, deltaY);
                  const velocity = dist / Math.max(timeDiff, 1);
                  const gain = mouseAccelerationEnabledRef.current
                    ? scrollGainForTouchVelocity(velocity)
                    : 1;
                  apiService.scrollMouse(
                    (deltaX * gain) / TWO_FINGER_SCROLL_DELTA_DIVISOR,
                    (deltaY * gain) / TWO_FINGER_SCROLL_DELTA_DIVISOR
                  );
                }
              }
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

        if (everHadThreeFingers.get() && (threeFingerSwipeDistVert >= THREE_FINGER_SWIPE_UP_THRESHOLD_PX || threeFingerSwipeDistHorz >= THREE_FINGER_SWIPE_LEFT_THRESHOLD_PX)) {
          if (threeFingerSwipeDistVert >= threeFingerSwipeDistHorz) {
            gestureType = dy3 < 0 ? "THREE_FINGER_SWIPE_UP" : "THREE_FINGER_SWIPE_DOWN";
          } else {
            gestureType = dx3 < 0 ? "THREE_FINGER_SWIPE_LEFT" : "THREE_FINGER_SWIPE_RIGHT";
          }
        } else if (wasTwoFingerGesture.get() && twoFingerSwipeDist >= TWO_FINGER_SWIPE_THRESHOLD_PX) {
          if (Math.abs(dy2) >= Math.abs(dx2)) {
            gestureType = dy2 < 0 ? "TWO_FINGER_SWIPE_UP" : "TWO_FINGER_SWIPE_DOWN";
          } else {
            gestureType = dx2 < 0 ? "TWO_FINGER_SWIPE_LEFT" : "TWO_FINGER_SWIPE_RIGHT";
          }
        } else if (
          msSinceGestureStarted <
          80 + (tapDetectionThresholdRef.current / 100) * 280
        ) {
          if (wasTwoFingerGesture.get())
            gestureType = "TWO_FINGER_TAP";
          else if (everHadThreeFingers.get())
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
          const scrollAlreadySentDuringPan =
            isMultiFingerSwipeGestureType(gestureType) && isDiscreteScrollAction(action);
          if (scrollAlreadySentDuringPan) {
            // Continuous `scrollMouse` during move already applied scroll; discrete SCROLL_* would double-fire.
          } else if (isVolumeUpSwipe) {
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