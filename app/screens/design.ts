/**
 * ALTIER · app/screens/design.ts
 * ------------------------------
 * Hallmark-inspired design system.
 * One theme, dealt for this product: calm, exact, a little warm.
 * Tailor's studio world → warm graphite ramp, ember coral accent.
 * 
 * This replaces the ad-hoc tokens.ts with a proper design system:
 * - Theme tokens (colors, type, spacing, radius, shadow, easing)
 * - Macrostructures (page anatomy for each screen)
 * - Gate references (Floor/Reflex/Finish checks)
 * - Animation vocabulary
 */

import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ============================================================
 * THEME TOKENS
 * ============================================================ */

// Color ramp: warm graphite (tailor's studio: unbleached linen, warm charcoal)
export const Colors = {
  // Surfaces
  bg: "#F7F4EE",           // page background - warm off-white
  card: "#FDFBF7",         // raised surface
  raised: "#EFE9DF",       // active row, input, hover
  line: "#E5E0D6",         // hairline borders (ink at 8%)
  
  // Text roles (exactly three)
  ink: "#1F1B16",          // primary
  muted: "#7B7266",        // secondary
  quiet: "#A39A8C",        // meta/captions
  
  // Accent: ember coral (fabric, clay, warm light)
  accent: "#C85C4D",
  accentHover: "#B04E42",
  accentSoft: "#F5E8E5",   // accent at 15% for subtle backgrounds
  accentRing: "rgba(200, 92, 77, 0.35)", // focus ring
  
  // Semantic (toned to sit in ramp)
  positive: "#2E8B57",
  negative: "#C0392B",
  
  // Status
  streak: "#C85C4D",
  bell: "#C85C4D",
  
  // Overlay
  overlay: "rgba(31, 27, 22, 0.5)",
  scrim: "rgba(31, 27, 22, 0.3)",
} as const;

// Spacing scale (4px grid)
export const Space = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 48,
  hero: 64,
} as const;

// Border radius (nested: inner = outer - padding)
export const Radius = {
  keycap: 4,      // tags, badges, small buttons
  control: 8,     // inputs, buttons, chips
  card: 12,       // cards
  panel: 16,      // panels, modals
  full: 9999,     // pills, avatars
} as const;

// Typography (system fonts with precise weights)
export const Type = {
  // Families (system: SF Pro / Roboto)
  // Display: serif for headlines only
  // Body: sans
  
  sizes: {
    micro: 11,       // meta, counts
    caption: 12,     // small labels
    body: 14,        // default text
    bodyLarge: 15,   // nav items
    title: 20,       // card titles
    headline: 28,    // page titles
    hero: 36,        // hero headlines
  },
  
  lineHeights: {
    tight: 1.05,
    normal: 1.4,
    relaxed: 1.6,
  },
  
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
  },
  
  tracking: {
    tight: -0.02,
    normal: 0,
    wide: 0.04,
    wider: 0.08,
  },
} as const;

// Shadows (depth from surface steps + hairlines)
export const Shadows = {
  small: StyleSheet.create({
    shadow: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
  }).shadow,
  
  card: StyleSheet.create({
    shadow: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  }).shadow,
  
  floating: StyleSheet.create({
    shadow: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 4,
    },
  }).shadow,
} as const;

// Motion (one easing curve, purposeful durations)
export const Motion = {
  ease: "cubic-bezier(0.22, 1, 0.36, 1)", // Hallmark's curve
  
  durations: {
    instant: 0,
    fast: 120,      // hover, press, toggles
    normal: 220,    // menus, popovers, tooltips
    slow: 350,      // entrances, sheets, layout changes
  },
  
  stagger: 40,      // between items
  maxStaggerItems: 6,
  
  // Transform values
  pressScale: 0.97,
  hoverLift: -2,
  enterRise: 12,
} as const;

// Layout constants
export const Layout = {
  screenPadding: Space.lg,        // 16
  cardPadding: Space.lg,          // 16
  cardGap: Space.md,              // 12
  sectionGap: Space.section,      // 48
  navHeight: 72,                  // includes safe area bottom
  rowHeight: 36,
  rowGap: 4,
  headerHeight: 56,
} as const;

// Z-index scale
export const ZIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
} as const;

/* ============================================================
 * MACROSTRUCTURES (Page Anatomy)
 * ============================================================ */

// Screen templates - each screen follows its macrostructure
export const Macrostructure = {
  // Onboarding: centered flow, single column, generous breathing room
  onboarding: {
    headerGap: Space.xl,
    cardGap: Space.md,
    photoDropHeight: 220,
    bottomPadding: Space.xxxl + Layout.navHeight,
  },
  
  // Today: dense app shell, flat-lay grid, sticky nav
  today: {
    topbarHeight: 44,
    weekStripHeight: 72,
    pillHeight: 40,
    chipHeight: 32,
    flatlayGap: Space.md,
    flatlayTileBasis: "45%",
    sectionGap: Space.xl,
    cardPadding: Space.lg,
    bottomPadding: Space.xxxl + Layout.navHeight,
  },
  
  // Profile: scannable sections, measured reads prominent
  profile: {
    headerGap: Space.lg,
    sectionGap: Space.xl,
    readRowGap: Space.sm,
    swatchSize: 36,
    bottomPadding: Space.xxxl,
  },
} as const;

/* ============================================================
 * GATE REFERENCES (Hallmark's 58 gates adapted for RN)
 * ============================================================

Floor (never waive):
  F1  Contrast ≥ 4.5:1 on all text
  F2  Focus visible on all interactive elements
  F3  Reduced motion respected (disable animations if system setting)
  F4  No invented facts / placeholder content in production
  F5  Phone layout works at 375px width
  F6  Touch targets ≥ 44×44
  F7  No gradient text, glows, colored shadows
  F8  No emoji as UI icons
  F9  No arbitrary spacing (all on 4px grid)
  F10 No uppercase tracked labels

Reflex (waivable with reason):
  R1  Max 3 font sizes per screen
  R2  Max 2 weights (400, 500, 600 only)
  R3  One accent color, used ≤ 3 times per screen
  R4  Cards use nested radius (card - padding = control)
  R5  Icons: one set, one size, one stroke
  R6  Loading states: skeleton or spinner, never blank
  R7  Empty states: illustrated, actionable
  R8  Error states: inline, specific, recoverable

Finish (craft detail, answer or dismiss):
  F100 Section rhythm: consistent vertical cadence
  F101 Head crowding: heading not cramped against preceding element
  F102 Text cramping: text not painted under another element
  F103 Photo share: hero photo ≤ 60% of first screen
  F104 Fold check: hero fits at 375/768/1440 widths
  F105 Focus ring: visible, accent color, 2px offset
  F106 Stagger: ≤ 6 items, 40ms each
  F107 Transition: only color, opacity, transform
  F108 No animate-all, no layout animation

*/

/* ============================================================
 * ANIMATION VOCABULARY
 * ============================================================ */

// Standard animation configs for Reanimated / react-native-animate
// (Using LayoutAnimation for simplicity, but structured for migration)
export const Animations = {
  // Entrance: fade + rise
  enter: {
    duration: Motion.durations.slow,
    easing: Motion.ease,
    from: { opacity: 0, translateY: Motion.enterRise },
    to: { opacity: 1, translateY: 0 },
  },
  
  // Staggered entrance
  stagger: (index: number) => ({
    ...Animations.enter,
    delay: index * Motion.stagger,
  }),
  
  // Press: tiny scale down
  press: {
    duration: Motion.durations.fast,
    easing: Motion.ease,
    scale: Motion.pressScale,
  },
  
  // Toggle: fade + scale
  toggle: {
    duration: Motion.durations.normal,
    easing: Motion.ease,
  },
  
  // Slide up (modals, sheets)
  slideUp: {
    duration: Motion.durations.slow,
    easing: Motion.ease,
    from: { opacity: 0, translateY: 24 },
    to: { opacity: 1, translateY: 0 },
  },
  
  // Fade only
  fade: {
    duration: Motion.durations.normal,
    easing: Motion.ease,
  },
  
  // Shimmer (for skeletons)
  shimmer: {
    duration: 1200,
    easing: "linear",
    iterations: -1,
  },
} as const;

/* ============================================================
 * THEME STAMP (for validation)
 * ============================================================
 *
 * Each screen's StyleSheet should start with this comment:
 *
 *   /*
 *    * Hallmark · ALTIER · [screen-name]
 *    * theme: tailor-studio-v1
 *    * dealt: calm, exact, a little warm
 *    * gates: F1-F10 pass, R1-R8 pass, F100-F108 answered
 *    * built: [date]
 *    *
 * */

/* ============================================================
 * HOOK: useTheme
 * ============================================================ */

export function useTheme() {
  const insets = useSafeAreaInsets();
  
  return {
    colors: Colors,
    space: Space,
    radius: Radius,
    type: Type,
    shadows: Shadows,
    motion: Motion,
    layout: Layout,
    zIndex: ZIndex,
    macrostructure: Macrostructure,
    insets,
    animations: Animations,
  };
}

/* ============================================================
 * EXPORTS
 * ============================================================ */

export const Theme = {
  colors: Colors,
  space: Space,
  radius: Radius,
  type: Type,
  shadows: Shadows,
  motion: Motion,
  layout: Layout,
  zIndex: ZIndex,
  macrostructure: Macrostructure,
  animations: Animations,
  gates: {
    floor: ["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10"],
    reflex: ["R1","R2","R3","R4","R5","R6","R7","R8"],
    finish: ["F100","F101","F102","F103","F104","F105","F106","F107","F108"],
  },
};

export default Theme;