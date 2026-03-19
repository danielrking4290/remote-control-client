import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import type { GestureType, Action, GestureMappings } from "../types/gestureMappings";
import { ImageSourcePropType } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

interface GestureMappingsContextValue {
  mappings: GestureMappings;
  setMapping: (gesture: GestureType, action: Action) => void;
  getActionForGesture: (gesture: GestureType) => Action;
  getIconForGesture: (gesture: GestureType) => ImageSourcePropType | undefined;
  resetToDefaults: () => void;
}

const DefaultGestureMappings: GestureMappings = {
  ONE_FINGER_TAP: "LEFT_CLICK_MOUSE",
  TWO_FINGER_TAP: "RIGHT_CLICK_MOUSE",
  THREE_FINGER_TAP: "MEDIA_PLAY_PAUSE",
  THREE_FINGER_SWIPE_UP: "MEDIA_VOLUME_UP",
  THREE_FINGER_SWIPE_DOWN: "MEDIA_VOLUME_DOWN",
  THREE_FINGER_SWIPE_LEFT: "MEDIA_PREVIOUS",
  THREE_FINGER_SWIPE_RIGHT: "MEDIA_NEXT",
  TWO_FINGER_SWIPE_UP: "SCROLL_DOWN",
  TWO_FINGER_SWIPE_DOWN: "SCROLL_UP",
  TWO_FINGER_SWIPE_LEFT: "SCROLL_RIGHT",
  TWO_FINGER_SWIPE_RIGHT: "SCROLL_LEFT"
};

const GESTURE_MAPPINGS_FILENAME = "gesture-mappings.json";

const VALID_GESTURE_TYPES: GestureType[] = [
  "ONE_FINGER_TAP", "TWO_FINGER_TAP", "THREE_FINGER_TAP",
  "TWO_FINGER_SWIPE_UP", "TWO_FINGER_SWIPE_DOWN", "TWO_FINGER_SWIPE_LEFT", "TWO_FINGER_SWIPE_RIGHT",
  "THREE_FINGER_SWIPE_UP", "THREE_FINGER_SWIPE_DOWN", "THREE_FINGER_SWIPE_LEFT", "THREE_FINGER_SWIPE_RIGHT"
];

const VALID_ACTIONS: Action[] = [
  "LEFT_CLICK_MOUSE", "RIGHT_CLICK_MOUSE", "SWITCH_WINDOW", "TASK_VIEW", "CLOSE_WINDOW",
  "REFRESH_PAGE", "MEDIA_NEXT", "MEDIA_PREVIOUS", "MEDIA_PLAY_PAUSE", "MEDIA_VOLUME_UP", "MEDIA_VOLUME_DOWN",
  "SCROLL_UP", "SCROLL_DOWN", "SCROLL_LEFT", "SCROLL_RIGHT", "NONE"
];

function isValidGestureMappings(obj: unknown): obj is GestureMappings {
  if (obj === null || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  for (const g of VALID_GESTURE_TYPES) {
    if (!VALID_ACTIONS.includes(o[g] as Action)) return false;
  }
  return Object.keys(o).length === VALID_GESTURE_TYPES.length;
}

async function loadMappingsFromFile(): Promise<GestureMappings | null> {
  try {
    const path = FileSystem.documentDirectory + GESTURE_MAPPINGS_FILENAME;
    const exists = await FileSystem.getInfoAsync(path, { size: false });
    if (!exists.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as unknown;
    return isValidGestureMappings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function saveMappingsToFile(mappings: GestureMappings): Promise<void> {
  try {
    const path = FileSystem.documentDirectory + GESTURE_MAPPINGS_FILENAME;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(mappings, null, 2));
  } catch {
    // Ignore write errors (e.g. storage full)
  }
}

const SwipeGestureDirectionalPairs: [GestureType, GestureType][] = [
  ["TWO_FINGER_SWIPE_UP", "TWO_FINGER_SWIPE_DOWN"],
  ["TWO_FINGER_SWIPE_LEFT", "TWO_FINGER_SWIPE_RIGHT"],
  ["THREE_FINGER_SWIPE_UP", "THREE_FINGER_SWIPE_DOWN"],
  ["THREE_FINGER_SWIPE_LEFT", "THREE_FINGER_SWIPE_RIGHT"],
];

const GestureMappingsContext = createContext<GestureMappingsContextValue | null>(null);

const SCROLL_ACTIONS: Action[] = ["SCROLL_UP", "SCROLL_DOWN", "SCROLL_LEFT", "SCROLL_RIGHT"];

function getSwipeComplement(gesture: GestureType): GestureType | null {
  for (const [a, b] of SwipeGestureDirectionalPairs) {
    if (gesture === a) return b;
    if (gesture === b) return a;
  }
  return null;
}

function getOppositeScrollAction(action: Action): Action | null {
  switch (action) {
    case "SCROLL_UP": return "SCROLL_DOWN";
    case "SCROLL_DOWN": return "SCROLL_UP";
    case "SCROLL_LEFT": return "SCROLL_RIGHT";
    case "SCROLL_RIGHT": return "SCROLL_LEFT";
    default: return null;
  }
}

function isScrollAction(action: Action): boolean {
  return SCROLL_ACTIONS.includes(action);
}

export function getIconForGesture(gesture: GestureType): ImageSourcePropType | undefined {
  try {
    switch (gesture) {
      case "ONE_FINGER_TAP":
        return require("../../resources/images/gesture-icons/oneFingerTap.png");
      case "TWO_FINGER_TAP":
        return require("../../resources/images/gesture-icons/twoFingerTap.png");
      case "THREE_FINGER_TAP":
        return require("../../resources/images/gesture-icons/threeFingerTap.png");
      case "THREE_FINGER_SWIPE_UP":
        return require("../../resources/images/gesture-icons/threeFingerSwipeUp.png");
      case "THREE_FINGER_SWIPE_DOWN":
        return require("../../resources/images/gesture-icons/threeFingerSwipeDown.png");
      case "THREE_FINGER_SWIPE_LEFT":
        return require("../../resources/images/gesture-icons/threeFingerSwipeLeft.png");
      case "THREE_FINGER_SWIPE_RIGHT":
        return require("../../resources/images/gesture-icons/threeFingerSwipeRight.png");
      case "TWO_FINGER_SWIPE_UP":
        return require("../../resources/images/gesture-icons/twoFingerSwipeUp.png");
      case "TWO_FINGER_SWIPE_DOWN":
        return require("../../resources/images/gesture-icons/twoFingerSwipeDown.png");
      case "TWO_FINGER_SWIPE_LEFT":
        return require("../../resources/images/gesture-icons/twoFingerSwipeLeft.png");
      case "TWO_FINGER_SWIPE_RIGHT":
        return require("../../resources/images/gesture-icons/twoFingerSwipeRight.png");
    }
  } catch (error) {
    return undefined;
  }
}

export function getIconForAction(action: Action): ImageSourcePropType | undefined {
  try {
    switch (action) {
      case "LEFT_CLICK_MOUSE":
        return require("../../resources/images/action-icons/leftClick.png");
      case "RIGHT_CLICK_MOUSE":
        return require("../../resources/images/action-icons/rightClick.png");
      case "SWITCH_WINDOW":
        return require("../../resources/images/action-icons/switchWindow.png");
      case "TASK_VIEW":
        return require("../../resources/images/action-icons/taskView.png");
      case "CLOSE_WINDOW":
        return require("../../resources/images/action-icons/closeWindow.png");
      case "REFRESH_PAGE":
        return require("../../resources/images/action-icons/refreshPage.png");
      case "MEDIA_NEXT":
        return require("../../resources/images/action-icons/mediaNext.png");
      case "MEDIA_PREVIOUS":
        return require("../../resources/images/action-icons/mediaPrevious.png");
      case "MEDIA_PLAY_PAUSE":
        return require("../../resources/images/action-icons/mediaPlay.png");
      case "MEDIA_VOLUME_UP":
        return require("../../resources/images/action-icons/mediaVolumeUp.png");
      case "MEDIA_VOLUME_DOWN":
        return require("../../resources/images/action-icons/mediaVolumeDown.png");
      case "SCROLL_UP":
        return require("../../resources/images/action-icons/scrollUp.png");
      case "SCROLL_DOWN":
        return require("../../resources/images/action-icons/scrollDown.png");
      case "SCROLL_LEFT":
        return require("../../resources/images/action-icons/scrollLeft.png");
      case "SCROLL_RIGHT":
        return require("../../resources/images/action-icons/scrollRight.png");
    }
  } catch (error) {
    return undefined;
  }
}

export function GestureMappingsProvider({ children }: { children: ReactNode }) {
  const [mappings, setMappings] = useState<GestureMappings>(() => ({ ...DefaultGestureMappings }));
  const hasLoadedFromFile = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadMappingsFromFile().then((loaded) => {
      if (cancelled) return;
      hasLoadedFromFile.current = true;
      if (loaded !== null) setMappings(loaded);
    }).catch(() => {
      if (!cancelled) hasLoadedFromFile.current = true;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hasLoadedFromFile.current) return;
    saveMappingsToFile(mappings);
  }, [mappings]);

  const setMapping = useCallback((gesture: GestureType, action: Action) => {
    const complement = getSwipeComplement(gesture);
    setMappings((prev) => {
      const next = { ...prev, [gesture]: action };
      if (complement !== null) {
        if (action === "SCROLL_UP") {
          next[complement] = "SCROLL_DOWN";
        } else if (action === "SCROLL_DOWN") {
          next[complement] = "SCROLL_UP";
        } else if (action === "SCROLL_LEFT") {
          next[complement] = "SCROLL_RIGHT";
        } else if (action === "SCROLL_RIGHT") {
          next[complement] = "SCROLL_LEFT";
        } else {
          next[complement] = "NONE";
        }
      }
      // Each scroll action may only be mapped to one gesture. Clear it from any other gesture.
      const designatedForScroll: Partial<Record<Action, GestureType>> = {};
      if (isScrollAction(action)) {
        designatedForScroll[action] = gesture;
        const opposite = getOppositeScrollAction(action);
        if (opposite !== null && complement !== null) {
          designatedForScroll[opposite] = complement;
        }
      }
      const allGestures = Object.keys(next) as GestureType[];
      for (const scrollAction of SCROLL_ACTIONS) {
        const designated = designatedForScroll[scrollAction];
        if (designated === undefined) continue; // we didn't assign this scroll action; leave others as-is
        for (const g of allGestures) {
          if (next[g] === scrollAction && g !== designated) {
            next[g] = "NONE";
          }
        }
      }
      return next;
    });
  }, []);

  const getActionForGesture = useCallback(
    (gesture: GestureType): Action => mappings[gesture],
    [mappings]
  );

  const resetToDefaults = useCallback(() => {
    setMappings({ ...DefaultGestureMappings });
  }, []);

  const value: GestureMappingsContextValue = {
    mappings,
    setMapping,
    getActionForGesture,
    getIconForGesture,
    resetToDefaults
  };

  return (
    <GestureMappingsContext.Provider value={value}>
      {children}
    </GestureMappingsContext.Provider>
  );
}

export function useGestureMappings(): GestureMappingsContextValue {
  const ctx = useContext(GestureMappingsContext);
  if (!ctx) {
    throw new Error("useGestureMappings must be used within GestureMappingsProvider");
  }
  return ctx;
}
