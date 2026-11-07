/**
 * ALTIER · app/screens/animations.ts
 * ---------------------------------
 * Animation utilities using React Native's built-in LayoutAnimation.
 * Hallmark motion vocabulary: one easing, purposeful durations.
 */

import { LayoutAnimation, UIManager } from "react-native";
import { Theme } from "./design";

const { motion } = Theme;

// Enable layout animation on Android
if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ============================================================
 * LAYOUT ANIMATION PRESETS
 * ============================================================ */

export const LayoutPresets = {
  /** Fade in for new elements */
  enter: LayoutAnimation.create(
    motion.durations.normal,
    LayoutAnimation.Types.easeInEaseOut,
    LayoutAnimation.Properties.opacity
  ),

  /** Scale + fade for updates */
  update: LayoutAnimation.create(
    motion.durations.normal,
    LayoutAnimation.Types.easeInEaseOut,
    LayoutAnimation.Properties.scaleXY
  ),

  /** Fade out for removed elements */
  exit: LayoutAnimation.create(
    motion.durations.fast,
    LayoutAnimation.Types.easeInEaseOut,
    LayoutAnimation.Properties.opacity
  ),

  /** Spring-like feel for presses */
  press: LayoutAnimation.create(
    motion.durations.fast,
    LayoutAnimation.Types.spring,
    LayoutAnimation.Properties.scaleXY
  ),

  /** Smooth transition for modals/sheets */
  modal: LayoutAnimation.create(
    motion.durations.slow,
    LayoutAnimation.Types.easeInEaseOut,
    LayoutAnimation.Properties.opacity
  ),
} as const;

/* ============================================================
 * HELPER FUNCTIONS
 * ============================================================ */

/** Configure next layout animation */
export function animateLayout(preset: keyof typeof LayoutPresets = "update") {
  LayoutAnimation.configureNext(LayoutPresets[preset]);
}

/** Animate a state change with layout animation */
export function withLayoutAnimation<T>(callback: () => T, preset: keyof typeof LayoutPresets = "update"): T {
  animateLayout(preset);
  return callback();
}

/* ============================================================
 * REDUCED MOTION SUPPORT
 * ============================================================ */

/** Check if user prefers reduced motion (iOS only for now) */
export function prefersReducedMotion(): boolean {
  // React Native doesn't expose this directly without native modules
  // For now, return false. Can be enhanced with a native module.
  return false;
}

/* ============================================================
 * HALLMARK EASING (for reference)
 * ============================================================ */

// Hallmark's easing curve: cubic-bezier(0.22, 1, 0.36, 1)
// Available as LayoutAnimation.Types.easeInEaseOut (closest match)
export const HALLMARK_EASING_NAME = "cubic-bezier(0.22, 1, 0.36, 1)";

/* ============================================================
 * DURATION CONSTANTS (from Theme)
 * ============================================================ */

export const Durations = {
  instant: 0,
  fast: Theme.motion.durations.fast,      // 120ms - hover, press, toggles
  normal: Theme.motion.durations.normal,  // 220ms - menus, popovers
  slow: Theme.motion.durations.slow,      // 350ms - entrances, sheets
} as const;

export const Stagger = {
  item: 40,        // 40ms between staggered items
  maxItems: 6,     // max 6 staggered items
} as const;

export const Transform = {
  pressScale: 0.97,
  hoverLift: -2,
  enterRise: 12,
} as const;