/**
 * ALTIER · app/screens/tokens.ts
 * ------------------------------
 * Shared design tokens after unslop. One neutral ramp (warm graphite),
 * three text roles, one accent from the world (tailor's studio).
 * All values on the 4px grid.
 */

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  hero: 48,
} as const;

export const Radius = {
  keycap: 4,
  control: 8,
  card: 12,
  panel: 16,
} as const;

export const IconSize = {
  small: 16,
  medium: 18,
  large: 20,
  xl: 24,
} as const;

export const C = {
  // Warm graphite ramp (tinted toward tailor's studio)
  bg: "#F7F4EE",          // page background
  card: "#FDFBF7",        // raised surface
  raised: "#EFE9DF",      // active row, input
  line: "#E5E0D6",        // hairline borders (primary text at 8%)
  
  // Text roles
  ink: "#1F1B16",         // primary
  muted: "#7B7266",       // secondary
  quiet: "#A39A8C",       // meta/captions
  
  // Accent from the world — ember coral (fabric, clay, warm light)
  accent: "#C85C4D",
  accentHover: "#B04E42",
  accentSoft: "#F5E8E5",  // accent at 15% for subtle backgrounds
  
  // Semantic (toned to sit in ramp)
  positive: "#2E8B57",
  negative: "#C0392B",
  
  // Measured palette swatches use their own hex — not from this ramp
} as const;

export const Type = {
  // Interface: Geist (precise, calm). Partner: Newsreader for headlines.
  // Since we can't load custom fonts easily in Expo without config,
  // we use system fonts with weights that match the character.
  // iOS: SF Pro, Android: Roboto — both neutral and precise.
  
  sizes: {
    micro: 11,      // meta, counts
    caption: 12,    // small labels
    body: 14,       // default text
    bodyLarge: 15,  // nav items
    title: 20,      // card titles
    headline: 28,   // page titles
    hero: 36,       // hero headlines (mobile)
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
} as const;

export const Shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export const Layout = {
  screenPadding: Spacing.lg,        // 16
  cardPadding: Spacing.lg,          // 16
  cardGap: Spacing.md,              // 12
  sectionGap: Spacing.section,      // 32
  navHeight: 64,
  rowHeight: 36,
  rowGap: 4,
} as const;