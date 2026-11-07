/**
 * ALTIER · app/screens/TodayScreen.tsx
 * -----------------------------------
 * Page 1, "Today's Fit". Expo / React Native.
 *
 * Hallmark build: scaffold → hero → sections → sweep
 * Theme: tailor-studio-v1 | dealt: calm, exact, a little warm
 * Gates: F1-F10 pass, R1-R8 pass, F100-F108 answered
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Theme } from "./design";

/* ---------------- constants ---------------- */

const OCCASIONS = ["casual", "gym", "work", "party", "date"] as const;
const MOODS = ["easy", "sharp", "soft", "bold", "cosy"] as const;
type Occasion = (typeof OCCASIONS)[number];
type Mood = (typeof MOODS)[number];

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function weekDays(today: Date) {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      key: d.toISOString().slice(0, 10),
      label: DAY_LABELS[i],
      n: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
      isFuture: d > today,
    };
  });
}

const TILE_HEIGHT: Record<string, number> = {
  dress: 190, top: 165, bottom: 165, layer: 165, shoes: 120, accessory: 120, look: 190,
};
const SLOT_LABEL: Record<string, string> = {
  layer: "Layer", top: "Top", dress: "Dress", bottom: "Bottom",
  shoes: "Shoes", accessory: "Accessory", look: "The look",
};

/* ---------------- server shapes ---------------- */

type Swatch = { hex: string; name: string; kind: string };

type Piece = {
  slot: "layer" | "top" | "dress" | "bottom" | "shoes" | "accessory" | "look";
  name: string;
  colors: string[];
  image_url?: string;
  attributes?: {
    colour?: string; colour_hex?: string;
    neckline?: string; waist?: string; silhouette?: string;
  };
  price_text?: string | null;
  retailer?: string | null;
  product_link?: string | null;
  verified?: boolean;
  as_searched?: { terms: string[] } | null;
};

type AppliedRule = {
  id: string; attribute: string; recommends: string;
  confidence: number; source: string; goal: string;
};

type AdviceRule = {
  id: string; attribute: string; recommends: string; avoid?: string;
  reason: string; goal: string; confidence: number;
  source_detail: { name: string; kind?: string };
  keyed_on?: "measured undertone" | "interpreted vibe";
  axis?: string;
};
type Advice = {
  rules: AdviceRule[];
  note: string | null;
  conflicts?: {
    axis: string;
    chosen: { recommends: string; confidence: number; because: string[] };
    also_matched: { recommends: string; confidence: number; because: string[] };
  }[];
};

type FaceFeatures = {
  eyes: Record<string, number>;
  brows: Record<string, number>;
  cheeks: Record<string, number>;
  lips: Record<string, number>;
  saturated: string[];
};
type Dissent = {
  rule_id: string; attribute: string; value: string; reason: string;
  source: string; confidence: number; overruled_by_taste: boolean;
};
type SizeEstimate = {
  cm: Record<string, number>;
  cm_range: Record<string, [number, number]>;
  confidence: number; notes: string[];
};
type TodayResponse = {
  look: { id: string; title: string };
  pieces: Piece[];
  score: number;
  reason: string;
  reason_source: "gemini" | "deterministic";
  reason_fallback: string | null;
  reason_model_added: string;
  reason_verbatim: { copied: number; required: number };
  avatar_prompt: { prompt: string; unverified: string[]; note: string | null };
  dissent?: Dissent[];
  palette_swatches: Swatch[];
  palette_guidance: string | null;
  coloring: {
    line: string; undertone: string; depth: string; contrast: string;
    note: string | null; borderline: string[];
  };
  body: { line: string; shape: string | null; confidence: number | null; size_estimate: SizeEstimate | null };
  rules_applied: AppliedRule[];
  hairstyle: Advice;
  pose: Advice;
  accessory: Advice;
  face_shape: {
    shape: string | null;
    ratios: Record<string, number> | null;
    features: FaceFeatures | null;
    confidence: number | null;
  };
  pool: { source: string; considered: number; note: string; occasion_filter: { note: string | null } };
  taste: { available: boolean; pins: number; coherence: number | null };
};
type VibeRead = {
  proposal: { phrase: string; confidence: number; warnings: string[] };
  confirmed: { phrase: string; edited: boolean } | null;
};
type ConvergenceRead = { score: number | null; ready: boolean; headline: string };
type AskResponse = {
  answer: string; abstained: boolean; reason: string | null; grounded: boolean;
  source: "gemini" | "retrieval-only" | "gate"; profile_used: string | null;
  citations: { n: number; title: string; section: string; snippet: string }[];
};

/* ---------------- screen ---------------- */

export default function TodayScreen({
  accessToken,
  apiBase = process.env.EXPO_PUBLIC_ALTIER_API ?? (globalThis as any).ALTIER_API_BASE ?? "http://localhost:8000",
  userName = "you",
  avatarUri = null,
  onProfile,
}: {
  accessToken?: string | null;
  apiBase?: string;
  userName?: string;
  avatarUri?: string | null;
  onProfile?: () => void;
}) {
  const { colors, space, radius, type, shadows, layout, macrostructure } = Theme;
const insets = useSafeAreaInsets();
  const [occasion, setOccasion] = useState<Occasion>("casual");
  const [mood, setMood] = useState<Mood | null>(null);
  const [special, setSpecial] = useState("");
  const [data, setData] = useState<TodayResponse | null>(null);
  const [vibe, setVibe] = useState<VibeRead | null>(null);
  const [convergence, setConvergence] = useState<ConvergenceRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [verdictRes, setVerdictRes] = useState<any>(null);
  const [wardrobeRes, setWardrobeRes] = useState<any>(null);
  const [outfitRes, setOutfitRes] = useState<any>(null);
  const [shadeMatchRes, setShadeMatchRes] = useState<any>(null);
  const [sizeHintRes, setSizeHintRes] = useState<any>(null);
  const [tryOnPromptRes, setTryOnPromptRes] = useState<any>(null);
  const [askQ, setAskQ] = useState("");
  const [askRes, setAskRes] = useState<AskResponse | null>(null);
  const [asking, setAsking] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    setVoted(null);
    try {
      const res = await fetch(`${apiBase}/today`, {
        method: "POST",
        headers,
        body: JSON.stringify({ occasion, mood, special: special.trim() || null, k: 3 }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.detail ?? `Request failed (${res.status})`);
        setData(null);
      } else {
        setData(body as TodayResponse);
        LayoutAnimation.configureNext(LayoutAnimation.create(
          Theme.motion.durations.normal,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.scaleXY
        ));
      }
    } catch {
      setError(`Could not reach ALTIER at ${apiBase}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers, occasion, mood, special]);

  const fetchSideReads = useCallback(async () => {
    try {
      const v = await fetch(`${apiBase}/vibe`, { method: "POST", headers, body: "{}" });
      if (v.ok) setVibe(await v.json());
    } catch { }
    try {
      const c = await fetch(`${apiBase}/convergence`, { headers });
      if (c.ok) setConvergence(await c.json());
    } catch { }
  }, [apiBase, headers]);

  useEffect(() => { fetchToday(); }, [occasion, mood]);
  useEffect(() => { fetchSideReads(); }, [fetchSideReads]);

  const askAltier = useCallback(async () => {
    const q = askQ.trim();
    if (q.length < 2 || asking) return;
    setAsking(true);
    try {
      const res = await fetch(`${apiBase}/ask`, { method: "POST", headers, body: JSON.stringify({ question: q }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setAskRes({ answer: d.detail ?? `Ask is unavailable (HTTP ${res.status}).`, abstained: true, reason: "unavailable",
          grounded: true, source: "gate", profile_used: null, citations: [] });
      } else {
        setAskRes(await res.json());
      }
    } catch {
      setAskRes({ answer: `Could not reach ALTIER at ${apiBase}`, abstained: true, reason: "offline",
        grounded: true, source: "gate", profile_used: null, citations: [] });
    } finally {
      setAsking(false);
    }
  }, [apiBase, headers, askQ, asking]);

  const sendFeedback = useCallback(async (liked: boolean) => {
    if (!data) return;
    setVoted(liked ? "up" : "down");
    LayoutAnimation.configureNext(LayoutAnimation.create(
      Theme.motion.durations.fast,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    ));
    try {
      await fetch(`${apiBase}/feedback`, {
        method: "POST", headers,
        body: JSON.stringify({ look_id: data.look.id, liked, occasion, mood }),
      });
    } catch { }
  }, [apiBase, headers, data, occasion, mood]);

  const psHeaders = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const API_BASE_PERSONAL_STYLIST =
    process.env.EXPO_PUBLIC_ALTIER_API_PERSONAL_STYLIST ??
    (globalThis as any).ALTIER_API_BASE_PERSONAL_STYLIST ??
    "http://localhost:8090";

  const runVerdict = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PERSONAL_STYLIST}/verdict`, {
        method: "POST", headers: psHeaders,
        body: JSON.stringify({
          product: {
            id: "sample-top", category: "clothes", slot: "top",
            silhouette: "fitted", fit: "slim", colors: ["#6E8CC4"],
            tags: ["minimal"], moods: ["neutral"], price_cents: 12000,
            material: "cotton", construction: ["lined"], brand_tier: "known",
            review_count: 120, average_rating: 4.5, seller_rating: 4.3, return_rate: 0.08,
          },
        }),
      });
      const d = await res.json();
      if (res.ok) setVerdictRes(d);
      else setVerdictRes({ error: d.detail ?? `HTTP ${res.status}` });
    } catch { setVerdictRes({ error: "Could not reach personal stylist" }); }
  }, [API_BASE_PERSONAL_STYLIST, psHeaders]);

  const runWardrobe = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PERSONAL_STYLIST}/wardrobe`, {
        method: "POST", headers: psHeaders,
        body: JSON.stringify({
          garments: [
            { id: "g1", name: "Navy tee", slot: "top", colours: ["#1F2A44"], price_cents: 4000, wear_count: 20, fibre: "cotton" },
            { id: "g2", name: "Black jeans", slot: "bottom", colours: ["#141110"], price_cents: 8000, wear_count: 50, fibre: "denim" },
            { id: "g3", name: "Navy tee 2", slot: "top", colours: ["#1F2A44"], price_cents: 4000, wear_count: 1, fibre: "cotton" },
          ],
        }),
      });
      const d = await res.json();
      if (res.ok) setWardrobeRes(d);
      else setWardrobeRes({ error: d.detail ?? `HTTP ${res.status}` });
    } catch { setWardrobeRes({ error: "Could not reach personal stylist" }); }
  }, [API_BASE_PERSONAL_STYLIST, psHeaders]);

  const runOutfit = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PERSONAL_STYLIST}/outfit`, {
        method: "POST", headers: psHeaders,
        body: JSON.stringify({ occasion: "casual", limit: 5 }),
      });
      const d = await res.json();
      if (res.ok) setOutfitRes(d);
      else setOutfitRes({ error: d.detail ?? `HTTP ${res.status}` });
    } catch { setOutfitRes({ error: "Could not reach personal stylist" }); }
  }, [API_BASE_PERSONAL_STYLIST, psHeaders]);

  const runShadeMatch = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PERSONAL_STYLIST}/shade-match`, {
        method: "POST", headers: psHeaders,
        body: JSON.stringify({ brand: "MAC", product_shade_hex: "#d4a373" }),
      });
      const d = await res.json();
      if (res.ok) setShadeMatchRes(d);
      else setShadeMatchRes({ error: d.detail ?? `HTTP ${res.status}` });
    } catch { setShadeMatchRes({ error: "Could not reach personal stylist" }); }
  }, [API_BASE_PERSONAL_STYLIST, psHeaders]);

  const runSizeHint = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PERSONAL_STYLIST}/size-hint`, {
        method: "POST", headers: psHeaders,
        body: JSON.stringify({
          brand: "Levi",
          fit_events: [
            { brand: "Levi", size_tried: "32", fit: "fit" },
            { brand: "Levi", size_tried: "32", fit: "fit" },
            { brand: "Levi", size_tried: "34", fit: "too_large" },
          ],
        }),
      });
      const d = await res.json();
      if (res.ok) setSizeHintRes(d);
      else setSizeHintRes({ error: d.detail ?? `HTTP ${res.status}` });
    } catch { setSizeHintRes({ error: "Could not reach personal stylist" }); }
  }, [API_BASE_PERSONAL_STYLIST, psHeaders]);

  const runTryOnPrompt = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PERSONAL_STYLIST}/try-on-prompt`, {
        method: "POST", headers: psHeaders,
        body: JSON.stringify({
          look: { id: "l1", title: "Cornflower top", slot: "top", colours: ["#6E8CC4"], price_cents: 12000 },
        }),
      });
      const d = await res.json();
      if (res.ok) setTryOnPromptRes(d);
      else setTryOnPromptRes({ error: d.detail ?? `HTTP ${res.status}` });
    } catch { setTryOnPromptRes({ error: "Could not reach personal stylist" }); }
  }, [API_BASE_PERSONAL_STYLIST, psHeaders]);

  const avatarPrompt = data?.avatar_prompt;

  const week = useMemo(() => weekDays(new Date()), []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl + layout.navHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* Top bar */}
        <View style={styles.topbar}>
          <View style={styles.topLeft}>
            <Ionicons name="calendar" size={24} color={colors.ink} />
            <View style={styles.streak}>
              <Ionicons name="flame" size={16} color={colors.accent} />
              <Text style={styles.streakN}>{data ? 1 : 0}</Text>
            </View>
          </View>
          <Text style={styles.wordmark}>ALTIER</Text>
          <View style={styles.topRight}>
            <Ionicons name="help-circle" size={24} color={colors.ink} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              <Ionicons name="notifications" size={24} color={colors.ink} />
              <View style={styles.bellDot} />
            </View>
          </View>
        </View>

        {/* Week strip */}
        <View style={styles.week}>
          {week.map((day) => (
            <View key={day.key} style={styles.day}>
              <Text style={[styles.dayLabel, day.isToday && styles.dayLabelOn]}>{day.label}</Text>
              <Text style={[styles.dayNum, day.isToday && styles.dayNumOn]}>{day.n}</Text>
              <View style={[styles.dayTile, day.isFuture && styles.dayTileGhost]}>
                {day.isToday && data
                  ? data.pieces.slice(0, 4).map((p, i) => (
                      <View key={i} style={[styles.dayChip, { backgroundColor: p.colors[0] ?? colors.line }]} />
                    ))
                  : null}
              </View>
              {day.isToday && <View style={styles.dayUnderline} />}
            </View>
          ))}
        </View>

        {/* Wish pill */}
        <View style={styles.askPill}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
          <TextInput
            style={styles.askInput}
            value={special}
            onChangeText={setSpecial}
            onSubmitEditing={fetchToday}
            returnKeyType="search"
            placeholder="Ask ALTIER — something special?"
            placeholderTextColor={colors.quiet}
          />
          {special.length > 0 && (
            <Pressable onPress={fetchToday} hitSlop={space.sm}>
              <Ionicons name="arrow-forward-circle" size={28} color={colors.ink} />
            </Pressable>
          )}
        </View>

        {/* Greeting + vibe */}
        <View style={styles.greetRow}>
          <Text style={styles.greet}>{greeting}\n{userName}</Text>
          <View style={styles.vibeBox}>
            <Text style={styles.vibeLabel}>YOUR VIBE</Text>
            <Text style={styles.vibePhrase} numberOfLines={2}>
              {vibe?.confirmed?.phrase || vibe?.proposal?.phrase || "Not yet"}
            </Text>
            <Text style={styles.vibeTag}>Your read · tap to edit</Text>
          </View>
        </View>

        {/* Occasion */}
        <Text style={styles.sectionLabel}>Occasion</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {OCCASIONS.map((o) => (
            <Pressable key={o} onPress={() => { setOccasion(o); LayoutAnimation.configureNext(LayoutAnimation.create(
              Theme.motion.durations.fast, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity
            )); }} style={[styles.pill, occasion === o && styles.pillOn]}>
              <Text style={[styles.pillText, occasion === o && styles.pillTextOn]}>{o}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Mood */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {MOODS.map((m) => (
            <Pressable key={m} onPress={() => { setMood(mood === m ? null : m); LayoutAnimation.configureNext(LayoutAnimation.create(
              Theme.motion.durations.fast, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity
            )); }} style={[styles.chip, mood === m && styles.chipOn]}>
              <Text style={[styles.chipText, mood === m && styles.chipTextOn]}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && (
          <View style={styles.skeletonWrap}>
            <View style={styles.skeletonRow}>
              <View style={[styles.skeleton, { height: 165 }]} />
              <View style={[styles.skeleton, { height: 165 }]} />
            </View>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {error && !loading && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nothing to show</Text>
            <Text style={styles.footnote}>{error}</Text>
            <TouchableOpacity onPress={fetchToday} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {data && !loading && data.pieces.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nothing matched</Text>
            <Text style={styles.footnote}>Loosen the occasion, or clear what you asked for.</Text>
          </View>
        )}

        {data && !loading && data.pieces.length > 0 && (
          <>
            <Text style={styles.lookTitle}>{data.look.title}</Text>

            {/* Flat-lay grid */}
            <View style={styles.flatlay}>
              {data.pieces.map((piece, i) => (
                <TouchableOpacity
                  key={`${piece.slot}-${i}`}
                  style={styles.tile}
                >
                  <View style={[styles.tileImage, { height: TILE_HEIGHT[piece.slot] ?? 165 }]}>
                    {piece.image_url ? (
                      <Image source={{ uri: piece.image_url }} style={styles.tileImg} resizeMode="contain" />
                    ) : (
                      piece.colors.map((hex, j) => (
                        <View key={j} style={[styles.tileBand, { backgroundColor: hex }]} />
                      ))
                    )}
                  </View>
                  <Text style={styles.tileSlot}>{SLOT_LABEL[piece.slot] ?? piece.slot}</Text>
                  <Text style={styles.tileName} numberOfLines={2}>{piece.name}</Text>

                  {piece.attributes && (
                    <View style={styles.attrRow}>
                      {(["colour", "neckline", "waist", "silhouette"] as const)
                        .map((k) => piece.attributes?.[k])
                        .filter((v): v is string => Boolean(v))
                        .map((v) => (
                          <View key={v} style={styles.attrChip}>
                            <Text style={styles.attrText}>{v.replace(/-/g, " ")}</Text>
                          </View>
                        ))}
                    </View>
                  )}

                  {piece.price_text && (
                    <Text style={styles.tilePrice}>
                      {piece.price_text}{piece.retailer ? ` · ${piece.retailer}` : ""}
                    </Text>
                  )}
                  {piece.product_link && (
                    <Pressable onPress={() => Linking.openURL(piece.product_link!)} style={styles.buyBtn}>
                      <Text style={styles.buyText}>Buy</Text>
                    </Pressable>
                  )}
                  {piece.verified === false && piece.as_searched && (
                    <Text style={styles.asSearched}>As searched, not verified</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* See it on me */}
            <TouchableOpacity
              onPress={() => setShowPrompt(true)}
              style={styles.secondaryBtnWide}
            >
              <Ionicons name="sparkles" size={18} color={colors.ink} />
              <Text style={styles.secondaryBtnText}>See it on me</Text>
            </TouchableOpacity>
            {showPrompt && avatarPrompt && (
              <View style={styles.promptOverlay} pointerEvents="auto">
                <View style={styles.promptCard}>
                  <View style={styles.promptHeader}>
                    <Text style={styles.kicker}>Paste this into ChatGPT</Text>
                    <TouchableOpacity onPress={() => setShowPrompt(false)}>
                      <Ionicons name="close" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                  <Text selectable style={styles.promptText}>{avatarPrompt.prompt}</Text>
                  <Text style={styles.footnote}>
                    ALTIER has no image generator. Make the picture in the ChatGPT app and bring it back.
                  </Text>
                  {avatarPrompt.note && <Text style={styles.footnote}>{avatarPrompt.note}</Text>}
                </View>
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Today's suggestions</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Why */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.kicker}>Why this</Text>
                <Text style={styles.badge}>
                  {data.reason_source === "gemini" ? "Phrased by ALTIER" : "From the numbers"}
                </Text>
              </View>
              <Text style={styles.reason}>{data.reason}</Text>
              {data.reason_source === "gemini" && (
                <Text style={styles.footnote}>
                  {data.reason_verbatim.copied} of {data.reason_verbatim.required} sentences were
                  written by the engines and copied word for word. The writing model added only:
                  "{data.reason_model_added}"
                </Text>
              )}
              {data.reason_fallback && (
                <Text style={styles.footnote}>Written version not used: {data.reason_fallback}</Text>
              )}

              <View style={styles.voteRow}>
                <TouchableOpacity
                  onPress={() => { sendFeedback(true); LayoutAnimation.configureNext(LayoutAnimation.create(
                    Theme.motion.durations.fast, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity
                  )); }}
                  style={[styles.vote, voted === "up" && styles.voteOn]}
                >
                  <Ionicons name="chevron-up" size={20} color={voted === "up" ? colors.accent : colors.muted} />
                  <Text style={[styles.voteText, voted === "up" && styles.voteTextOn]}>This is me</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { sendFeedback(false); LayoutAnimation.configureNext(LayoutAnimation.create(
                    Theme.motion.durations.fast, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity
                  )); }}
                  style={[styles.vote, voted === "down" && styles.voteOn]}
                >
                  <Ionicons name="chevron-down" size={20} color={voted === "down" ? colors.negative : colors.muted} />
                  <Text style={[styles.voteText, voted === "down" && styles.voteTextOn]}>Not me</Text>
                </TouchableOpacity>
              </View>
              {voted && <Text style={styles.footnote}>Noted. That is you naming your taste, not tuning a model.</Text>}
            </View>

            {/* Dissent */}
            {data.dissent?.filter((d) => d.overruled_by_taste).map((d) => (
              <View key={d.rule_id} style={[styles.card, styles.dissentCard]}>
                <Text style={styles.kicker}>A convention disagrees</Text>
                <Text style={styles.reason}>{d.reason}</Text>
                <Text style={styles.footnote}>
                  {d.source} · confidence {Math.round(d.confidence * 100)}%. You keep choosing
                  looks like this, so it stays. This is an opinion, not a rule.
                </Text>
              </View>
            ))}

            {/* Palette */}
            <View style={styles.card}>
              <Text style={styles.kicker}>Your colours · measured</Text>
              <View style={styles.swatchWrap}>
                {data.palette_swatches.map((sw) => (
                  <View key={sw.hex} style={styles.swatchCol}>
                    <View style={[styles.swatch, { backgroundColor: sw.hex }]} />
                    <Text style={styles.swatchName} numberOfLines={1}>{sw.name}</Text>
                  </View>
                ))}
              </View>
              {data.palette_guidance && <Text style={styles.guidance}>{data.palette_guidance}</Text>}
            </View>

            {/* Her read */}
            <View style={styles.card}>
              <Text style={styles.kicker}>What you're made of · measured</Text>
              <Text style={styles.readLine}>{data.coloring.line}</Text>
              {data.coloring.note && (
                <View style={styles.borderline}>
                  <Text style={styles.borderlineTitle}>This one was close</Text>
                  <Text style={styles.borderlineText}>{data.coloring.note}</Text>
                </View>
              )}
              <Text style={styles.footnote}>
                Measured from your photo — CIELAB hue angle and ITA. Facts about you to build on,
                not a verdict on what suits you.
              </Text>

              {data.face_shape?.shape ? (
                <>
                  <View style={styles.hr} />
                  <Text style={styles.readLine}>{data.face_shape.shape} face</Text>
                  <Text style={styles.footnote}>
                    From four ratios measured off your face mesh. The ratios are reliable; which
                    of seven words they become is a convention with uncalibrated cut points, and
                    this one is held at {Math.round((data.face_shape.confidence ?? 0) * 100)}%.
                  </Text>
                  {data.face_shape.features && (
                    <FaceFeatureRows features={data.face_shape.features} />
                  )}
                </>
              ) : null}

              <View style={styles.hr} />
              <Text style={styles.readLine}>{data.body.line}</Text>
              {data.body.size_estimate && (
                <View style={styles.estimate}>
                  <Text style={styles.estimateTitle}>Rough estimate — not a measurement</Text>
                  {Object.entries(data.body.size_estimate.cm).map(([part, cm]) => {
                    const range = data.body.size_estimate!.cm_range[part];
                    return (
                      <Text key={part} style={styles.estimateLine}>
                        {part.replace(/_/g, " ")}: about {cm} cm ({range[0]}–{range[1]})
                      </Text>
                    );
                  })}
                  <Text style={styles.estimateNote}>{data.body.size_estimate.notes[0]}</Text>
                </View>
              )}
            </View>

            {/* Rules */}
            {data.rules_applied.length > 0 && (
              <View style={styles.card}>
                <TouchableOpacity
                  onPress={() => { setShowRules(!showRules); LayoutAnimation.configureNext(LayoutAnimation.create(
                    Theme.motion.durations.normal, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity
                  )); }}
                  style={styles.rowBetween}
                >
                  <Text style={styles.kicker}>The evidence · convention</Text>
                  <Ionicons name={showRules ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                </TouchableOpacity>
                <Text style={styles.footnote}>
                  Styling convention, not fact. No study backs any of it, and your thumbs move
                  these numbers.
                </Text>
                {showRules && data.rules_applied.map((r) => (
                  <View key={r.id} style={styles.rule}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.ruleAttr}>{r.attribute}</Text>
                      <Text style={styles.ruleConf}>{Math.round(r.confidence * 100)}%</Text>
                    </View>
                    <Text style={styles.ruleText}>{r.recommends}</Text>
                    <Text style={styles.ruleMeta}>{r.source} · assumes: {r.goal}</Text>
                  </View>
                ))}
              </View>
            )}

            <AdviceCard
              kicker="Hair · convention"
              standing="From a standard cosmetology textbook (Milady Ch.14). Widely taught, and supported by no study. It optimises for the illusion of an oval face, which is an aesthetic position you are free to reject."
              advice={data.hairstyle}
              emptyLabel="No hair advice yet — your face shape has not been read."
            />

            <AdviceCard
              kicker="Pose · unsourced"
              standing="The least grounded advice here. Studio practice passed on by demonstration, with no standard text and no study behind it — which is why these sit below everything else on this page. Easy to test in a mirror, and your thumbs should outweigh it quickly."
              advice={data.pose}
              emptyLabel="No posing advice for this profile yet."
            />

            <AdviceCard
              kicker="Accessories · mixed"
              standing="Metal temperature keys on your measured undertone. Everything else keys on your vibe, which is itself an interpretation — so those are the least confident suggestions ALTIER makes, and each line says which it is."
              advice={data.accessory}
              emptyLabel="Nothing to suggest here yet."
            />

            {/* Convergence */}
            {convergence && (
              <View style={styles.card}>
                <Text style={styles.kicker}>How clear your taste is getting</Text>
                <Text style={styles.reason}>{convergence.headline}</Text>
                <Text style={styles.footnote}>
                  A rough read, not a score of you. It tracks whether you are changing your mind
                  less, not whether you use the app more.
                </Text>
              </View>
            )}

            {/* Product tools */}
            <View style={styles.card}>
              <Text style={styles.kicker}>Product tools · personal stylist</Text>
              <Text style={styles.footnote}>
                Buy/caution/skip verdicts, wardrobe management, outfit building, shade matching,
                size hints, and try-on prompts. Powered by the personal-stylist API on :8090.
              </Text>
              <View style={styles.toolRow}>
                <TouchableOpacity onPress={runVerdict} style={styles.toolBtn}>
                  <Text style={styles.toolBtnText}>Verdict</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={runWardrobe} style={styles.toolBtn}>
                  <Text style={styles.toolBtnText}>Wardrobe</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={runOutfit} style={styles.toolBtn}>
                  <Text style={styles.toolBtnText}>Outfit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={runShadeMatch} style={styles.toolBtn}>
                  <Text style={styles.toolBtnText}>Shade Match</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={runSizeHint} style={styles.toolBtn}>
                  <Text style={styles.toolBtnText}>Size Hint</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={runTryOnPrompt} style={styles.toolBtn}>
                  <Text style={styles.toolBtnText}>Try-on Prompt</Text>
                </TouchableOpacity>
              </View>
              {verdictRes && <View style={styles.toolResult}><Text style={styles.toolResultTitle}>Verdict: {verdictRes.verdict}</Text><Text style={styles.toolResultText}>Match {verdictRes.match_pct}% · {verdictRes.risk_count} risk signal(s) · {verdictRes.route}</Text>{verdictRes.reasons?.slice(1).map((r: any) => <Text key={r.signal} style={styles.toolResultReason}>[{r.severity}] {r.reason}</Text>)}</View>}
              {wardrobeRes && <View style={styles.toolResult}><Text style={styles.toolResultTitle}>Wardrobe</Text><Text style={styles.toolResultText}>{wardrobeRes.active_count} active · {wardrobeRes.near_duplicates.length} near-duplicates · Gaps: {wardrobeRes.gaps.map((g: any) => g.slot).join(", ") || "none"}</Text></View>}
              {outfitRes && <View style={styles.toolResult}><Text style={styles.toolResultTitle}>Outfit Builder</Text><Text style={styles.toolResultText}>{outfitRes.outfits.length} outfit(s) from {outfitRes.wardrobe_size} wardrobe items</Text></View>}
              {shadeMatchRes && <View style={styles.toolResult}><Text style={styles.toolResultTitle}>Shade Match</Text><Text style={styles.toolResultText}>{shadeMatchRes.match_quality || "none"} · ΔE {shadeMatchRes.delta_e ?? "—"}</Text><Text style={styles.toolResultReason}>{shadeMatchRes.recommendation || ""}</Text></View>}
              {sizeHintRes && <View style={styles.toolResult}><Text style={styles.toolResultTitle}>Size Hint</Text><Text style={styles.toolResultText}>{sizeHintRes.suggested_size ?? "none"} · {sizeHintRes.based_on_events} event(s) · {sizeHintRes.confidence}</Text></View>}
              {tryOnPromptRes && <View style={styles.toolResult}><Text style={styles.toolResultTitle}>Try-on Prompt</Text><Text style={styles.toolResultText} numberOfLines={2}>{tryOnPromptRes.prompt?.slice(0, 120)}…</Text></View>}
            </View>

            <Text style={styles.poolNote}>{data.pool.note}</Text>
            {data.pool.occasion_filter?.note && <Text style={styles.poolNote}>{data.pool.occasion_filter.note}</Text>}
            {!data.taste.available && (
              <Text style={styles.poolNote}>
                Your own taste is not in this yet. Upload pins and ALTIER will lead with what you save.
              </Text>
            )}
          </>
        )}

        {/* Ask ALTIER */}
        <View style={styles.card}>
          <Text style={styles.kicker}>Ask ALTIER · cited or refused</Text>
          <Text style={styles.footnote}>
            Answers come only from the sourced rule bases, every sentence cited and every citation
            checked. A question they cannot answer is refused, not improvised.
          </Text>
          <View style={styles.askRow}>
            <TextInput
              style={styles.askField}
              value={askQ}
              onChangeText={setAskQ}
              onSubmitEditing={askAltier}
              returnKeyType="send"
              placeholder="e.g. which necklines suit me, and why?"
              placeholderTextColor={colors.quiet}
            />
            <TouchableOpacity onPress={askAltier} hitSlop={space.sm} disabled={asking}>
              <Ionicons name={asking ? "hourglass" : "arrow-forward-circle"} size={28} color={colors.ink} />
            </TouchableOpacity>
          </View>
          {askRes && (
            <>
              <Text style={styles.reason}>{askRes.answer}</Text>
              {askRes.citations.map((c) => (
                <Text key={c.n} style={styles.ruleMeta}>[{c.n}] {c.title}{c.section ? ` › ${c.section}` : ""}</Text>
              ))}
              <Text style={styles.footnote}>
                {askRes.source === "gemini"
                  ? "Written by the model from the cited sources; citations verified."
                  : askRes.source === "retrieval-only"
                  ? "The matching rules themselves — no model text was used."
                  : "Refused: nothing in the sources is close enough to answer this."}
                {askRes.profile_used ? ` Read against your profile: ${askRes.profile_used}.` : ""}
              </Text>
            </>
          )}
        </View>

        <View style={{ height: space.xxxl }} />
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.nav}>
        <Ionicons name="home" size={26} color={colors.ink} />
        <Ionicons name="shirt" size={26} color={colors.muted} />
        <View style={styles.navPlus}><Ionicons name="add" size={28} color="#fff" /></View>
        <Ionicons name="search" size={26} color={colors.muted} />
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={styles.navAvatar} />
          : <View style={styles.navAvatarEmpty}><Text style={styles.navAvatarText}>{userName.charAt(0).toUpperCase()}</Text></View>}
        {onProfile ? <TouchableOpacity onPress={onProfile} style={styles.navProfileBtn} /> : null}
      </View>
    </SafeAreaView>
  );
}

/* ---------------- FaceFeatureRows ---------------- */

function FaceFeatureRows({ features }: { features: FaceFeatures }) {
  const { colors, space, radius, type, shadows } = Theme;
  const groups: (keyof Omit<FaceFeatures, "saturated">)[] = ["eyes", "brows", "cheeks", "lips"];
  return (
    <View style={styles.features}>
      {groups.map((group) => (
        <View key={group} style={styles.featureRow}>
          <Text style={styles.featureGroup}>{group}</Text>
          <View style={styles.featureChips}>
            {Object.entries(features[group]).map(([key, value]) => {
              const dead = features.saturated.includes(`${group}.${key}`);
              return (
                <View key={key} style={[styles.featureChip, dead && styles.featureChipDead]}>
                  <Text style={[styles.featureText, dead && styles.featureTextDead]}>
                    {key.replace(/_/g, " ")} {value}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {features.saturated.length > 0 && (
        <Text style={styles.footnote}>
          Struck-through values sat on a measurement limit, so they describe the measuring code
          rather than your face. Ignore them.
        </Text>
      )}
    </View>
  );
}

/* ---------------- AdviceCard ---------------- */

function AdviceCard({
  kicker,
  standing,
  advice,
  emptyLabel,
}: {
  kicker: string;
  standing: string;
  advice?: Advice;
  emptyLabel: string;
}) {
  const { colors, space, radius, type, shadows } = Theme;
  
  if (!advice) return null;

  if (!advice.rules.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.footnote}>{advice.note ?? emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.footnote}>{standing}</Text>

      {advice.rules.map((rule) => (
        <View key={rule.id} style={styles.advice}>
          <View style={styles.rowBetween}>
            <Text style={styles.adviceKeyedOn}>{rule.keyed_on ?? rule.goal}</Text>
            <Text style={styles.ruleConf}>{Math.round(rule.confidence * 100)}%</Text>
          </View>
          <Text style={styles.adviceText}>{rule.recommends}</Text>
          {rule.avoid ? <Text style={styles.adviceAvoid}>Not: {rule.avoid}</Text> : null}
          <Text style={styles.ruleMeta}>{rule.reason}</Text>
          <Text style={styles.ruleMeta}>{rule.source_detail?.name}</Text>
        </View>
      ))}

      {advice.conflicts?.map((conflict, i) => (
        <Text key={i} style={styles.conflict}>
          Your {conflict.also_matched.because.join(" and ")} suggested the opposite here:
          "{conflict.also_matched.recommends}" They disagree about {conflict.axis}, so the more
          confident one is shown.
        </Text>
      ))}
    </View>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.bg },
  scroll: { paddingHorizontal: Theme.layout.screenPadding, paddingTop: Theme.space.md, paddingBottom: Theme.space.xxxl + Theme.layout.navHeight },

  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topLeft: { flexDirection: "row", alignItems: "center", gap: Theme.space.sm },
  topRight: { flexDirection: "row", alignItems: "center", gap: Theme.space.md },
  streak: { flexDirection: "row", alignItems: "center", gap: Theme.space.xs },
  streakN: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.caption, color: Theme.colors.ink },
  wordmark: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.title, letterSpacing: 0.5, color: Theme.colors.ink },
  bellDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Theme.colors.accent },

  week: { flexDirection: "row", justifyContent: "space-between", marginTop: Theme.space.lg },
  day: { alignItems: "center", width: 40 },
  dayLabel: { fontSize: Theme.type.sizes.caption, fontWeight: Theme.type.weights.medium, color: Theme.colors.muted, letterSpacing: 0.4 },
  dayLabelOn: { color: Theme.colors.ink },
  dayNum: { fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium, color: Theme.colors.muted, marginTop: Theme.space.xs },
  dayNumOn: { color: Theme.colors.ink, fontWeight: Theme.type.weights.semibold },
  dayTile: { width: 36, height: 50, borderRadius: Theme.radius.control, marginTop: Theme.space.xs, backgroundColor: Theme.colors.line, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" },
  dayTileGhost: { backgroundColor: Theme.colors.raised },
  dayChip: { width: "50%", height: "50%" },
  dayUnderline: { width: 24, height: 2, borderRadius: 1, backgroundColor: Theme.colors.ink, marginTop: Theme.space.xs },

  askPill: { flexDirection: "row", alignItems: "center", gap: Theme.space.sm, backgroundColor: Theme.colors.card, borderRadius: Theme.radius.control, paddingHorizontal: Theme.space.md, paddingVertical: Theme.space.sm, marginTop: Theme.space.md },
  askInput: { flex: 1, fontSize: Theme.type.sizes.body, color: Theme.colors.ink, padding: 0 },

  greetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: Theme.space.xl, gap: Theme.space.md },
  greet: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.headline, lineHeight: Theme.type.sizes.headline * Theme.type.lineHeights.tight, color: Theme.colors.ink, flexShrink: 1 },
  vibeBox: { alignItems: "flex-end", maxWidth: 140 },
  vibeLabel: { fontSize: Theme.type.sizes.caption, letterSpacing: 0.4, color: Theme.colors.muted, fontWeight: Theme.type.weights.medium },
  vibePhrase: { fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.semibold, color: Theme.colors.ink, textAlign: "right", marginTop: Theme.space.xs },
  vibeTag: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, marginTop: Theme.space.xs },

  sectionLabel: { fontSize: Theme.type.sizes.caption, letterSpacing: 0.4, color: Theme.colors.muted, fontWeight: Theme.type.weights.medium, marginTop: Theme.space.xl, marginBottom: Theme.space.sm },

  pillRow: { flexDirection: "row" },
  pill: { paddingHorizontal: Theme.space.md, paddingVertical: Theme.space.xs, borderRadius: Theme.radius.control, backgroundColor: Theme.colors.card, marginRight: Theme.space.xs },
  pillOn: { backgroundColor: Theme.colors.ink },
  pillText: { fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium, color: Theme.colors.ink, textTransform: "capitalize" },
  pillTextOn: { color: "#fff" },

  chipRow: { flexDirection: "row", marginTop: Theme.space.xs },
  chip: { paddingHorizontal: Theme.space.sm, paddingVertical: Theme.space.xs, borderRadius: Theme.radius.control, marginRight: Theme.space.xs, borderWidth: 1, borderColor: Theme.colors.line },
  chipOn: { backgroundColor: Theme.colors.accentSoft, borderColor: Theme.colors.accent },
  chipText: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, textTransform: "capitalize" },
  chipTextOn: { color: Theme.colors.ink, fontWeight: Theme.type.weights.medium },

  skeletonWrap: { marginTop: Theme.space.lg, gap: Theme.space.md, alignItems: "center" },
  skeletonRow: { flexDirection: "row", gap: Theme.space.md, alignSelf: "stretch" },
  skeleton: { flex: 1, backgroundColor: Theme.colors.card, borderRadius: Theme.radius.control, opacity: 0.4 },

  card: { backgroundColor: Theme.colors.card, borderRadius: Theme.radius.card, padding: Theme.layout.cardPadding, marginTop: Theme.space.md, ...Theme.shadows.card },
  cardTitle: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.title, color: Theme.colors.ink, marginBottom: Theme.space.sm },

  lookTitle: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.title, lineHeight: Theme.type.sizes.title * Theme.type.lineHeights.tight, color: Theme.colors.ink, marginTop: Theme.space.lg },

  flatlay: { flexDirection: "row", flexWrap: "wrap", gap: Theme.space.md, marginTop: Theme.space.md },
  tile: { flexGrow: 1, flexBasis: "45%", backgroundColor: Theme.colors.card, borderRadius: Theme.radius.control, padding: Theme.space.sm },
  tileImage: { borderRadius: Theme.radius.control, overflow: "hidden", flexDirection: "row", backgroundColor: Theme.colors.raised },
  tileImg: { width: "100%", height: "100%" },
  tileBand: { flex: 1 },
  tileSlot: { fontSize: Theme.type.sizes.caption, letterSpacing: 0.4, textTransform: "uppercase", color: Theme.colors.accent, fontWeight: Theme.type.weights.medium, marginTop: Theme.space.xs },
  tileName: { fontSize: Theme.type.sizes.body, lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed, color: Theme.colors.ink, fontWeight: Theme.type.weights.medium, marginTop: Theme.space.xs },

  attrRow: { flexDirection: "row", flexWrap: "wrap", gap: Theme.space.xs, marginTop: Theme.space.xs },
  attrChip: { backgroundColor: Theme.colors.raised, borderRadius: Theme.radius.keycap, paddingHorizontal: Theme.space.xs, paddingVertical: 2 },
  attrText: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted },

  tilePrice: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, fontWeight: Theme.type.weights.medium, marginTop: Theme.space.xs },
  buyBtn: { backgroundColor: Theme.colors.ink, borderRadius: Theme.radius.keycap, paddingHorizontal: Theme.space.sm, paddingVertical: Theme.space.xs, marginTop: Theme.space.xs, alignSelf: "flex-start" },
  buyText: { fontSize: Theme.type.sizes.caption, color: "#fff", fontWeight: Theme.type.weights.medium },
  asSearched: { fontSize: Theme.type.sizes.caption, color: Theme.colors.quiet, marginTop: Theme.space.xs },

  secondaryBtnWide: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Theme.space.xs, backgroundColor: Theme.colors.raised, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius.control, paddingVertical: Theme.space.sm, marginTop: Theme.space.md },
  secondaryBtnText: { color: Theme.colors.ink, fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium },

  promptOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Theme.colors.overlay, zIndex: Theme.zIndex.modal, justifyContent: "center", alignItems: "center", padding: Theme.space.lg },
  promptCard: { backgroundColor: Theme.colors.card, borderRadius: Theme.radius.panel, padding: Theme.space.xl, width: "100%", maxWidth: 400, ...Theme.shadows.floating },
  promptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Theme.space.md },
  promptText: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, marginTop: Theme.space.md, fontFamily: "monospace", lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed },

  divider: { flexDirection: "row", alignItems: "center", gap: Theme.space.md, marginTop: Theme.space.xl, marginBottom: Theme.space.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Theme.colors.line },
  dividerText: { fontSize: Theme.type.sizes.caption, letterSpacing: 0.4, textTransform: "uppercase", color: Theme.colors.muted, fontWeight: Theme.type.weights.medium },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  kicker: { fontSize: Theme.type.sizes.caption, letterSpacing: 0.4, textTransform: "uppercase", color: Theme.colors.muted, fontWeight: Theme.type.weights.medium, marginBottom: Theme.space.xs },
  badge: { fontSize: Theme.type.sizes.caption, color: Theme.colors.accent, fontWeight: Theme.type.weights.medium },
  reason: { fontSize: Theme.type.sizes.body, lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed, color: Theme.colors.ink, marginTop: Theme.space.xs },

  voteRow: { flexDirection: "row", gap: Theme.space.md, marginTop: Theme.space.md },
  vote: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Theme.space.xs, backgroundColor: Theme.colors.raised, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius.control, paddingVertical: Theme.space.sm },
  voteOn: { backgroundColor: Theme.colors.accentSoft, borderColor: Theme.colors.accent },
  voteText: { fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium, color: Theme.colors.ink },
  voteTextOn: { color: Theme.colors.accent },

  swatchWrap: { flexDirection: "row", flexWrap: "wrap", gap: Theme.space.sm, marginTop: Theme.space.sm },
  swatchCol: { width: 48, alignItems: "center" },
  swatch: { width: 36, height: 36, borderRadius: Theme.radius.control, marginBottom: Theme.space.xs, borderWidth: 1, borderColor: Theme.colors.line },
  swatchName: { fontSize: Theme.type.sizes.micro, color: Theme.colors.muted, textAlign: "center", width: 44 },

  guidance: { fontSize: Theme.type.sizes.body, lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed, color: Theme.colors.muted, marginTop: Theme.space.sm },

  readLine: { fontSize: Theme.type.sizes.bodyLarge, fontWeight: Theme.type.weights.medium, color: Theme.colors.ink, marginTop: Theme.space.sm },
  footnote: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, lineHeight: Theme.type.sizes.caption * Theme.type.lineHeights.relaxed, marginTop: Theme.space.xs },

  borderline: { backgroundColor: Theme.colors.accentSoft, borderRadius: Theme.radius.control, padding: Theme.space.sm, marginTop: Theme.space.sm },
  borderlineTitle: { fontSize: Theme.type.sizes.caption, fontWeight: Theme.type.weights.semibold, color: Theme.colors.ink, marginBottom: Theme.space.xs },
  borderlineText: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, lineHeight: Theme.type.sizes.caption * Theme.type.lineHeights.relaxed },

  hr: { height: 1, backgroundColor: Theme.colors.line, marginVertical: Theme.space.md },

  estimate: { marginTop: Theme.space.md },
  estimateTitle: { fontSize: Theme.type.sizes.caption, fontWeight: Theme.type.weights.semibold, color: Theme.colors.ink, marginBottom: Theme.space.xs },
  estimateLine: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, marginBottom: Theme.space.xs },
  estimateNote: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, marginTop: Theme.space.xs, lineHeight: Theme.type.sizes.caption * Theme.type.lineHeights.relaxed },

  rule: { paddingVertical: Theme.space.sm, borderTopWidth: 1, borderTopColor: Theme.colors.line },
  ruleAttr: { fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium, color: Theme.colors.ink },
  ruleConf: { fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium, color: Theme.colors.accent, fontVariant: ["tabular-nums"] },
  ruleText: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, marginTop: Theme.space.xs },
  ruleMeta: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, marginTop: Theme.space.xs },

  dissentCard: { borderWidth: 1, borderColor: Theme.colors.accent, backgroundColor: Theme.colors.accentSoft },
  poolNote: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, marginTop: Theme.space.md, lineHeight: Theme.type.sizes.caption * Theme.type.lineHeights.relaxed },

  askRow: { flexDirection: "row", alignItems: "center", gap: Theme.space.xs, marginTop: Theme.space.sm, backgroundColor: Theme.colors.raised, borderRadius: Theme.radius.control, paddingHorizontal: Theme.space.sm, paddingVertical: Theme.space.xs },
  askField: { flex: 1, fontSize: Theme.type.sizes.body, color: Theme.colors.ink, padding: 0 },

  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: Theme.space.xs, marginTop: Theme.space.md },
  toolBtn: { backgroundColor: Theme.colors.raised, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius.control, paddingHorizontal: Theme.space.md, paddingVertical: Theme.space.sm },
  toolBtnText: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, fontWeight: Theme.type.weights.medium },
  toolResult: { marginTop: Theme.space.md, padding: Theme.space.md, backgroundColor: Theme.colors.raised, borderRadius: Theme.radius.control },
  toolResultTitle: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.body, color: Theme.colors.ink, marginBottom: Theme.space.xs },
  toolResultText: { fontSize: Theme.type.sizes.body, color: Theme.colors.muted, lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed },
  toolResultReason: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, marginTop: Theme.space.xs },

  features: { marginTop: Theme.space.sm },
  featureRow: { marginBottom: Theme.space.sm },
  featureGroup: { fontSize: Theme.type.sizes.caption, fontWeight: Theme.type.weights.medium, color: Theme.colors.muted, marginBottom: Theme.space.xs },
  featureChips: { flexDirection: "row", flexWrap: "wrap", gap: Theme.space.xs },
  featureChip: { backgroundColor: Theme.colors.raised, borderRadius: Theme.radius.keycap, paddingHorizontal: Theme.space.xs, paddingVertical: 2 },
  featureChipDead: { opacity: 0.4 },
  featureText: { fontSize: Theme.type.sizes.micro, color: Theme.colors.ink },
  featureTextDead: { textDecorationLine: "line-through", color: Theme.colors.quiet },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Theme.space.xs, backgroundColor: Theme.colors.ink, borderRadius: Theme.radius.control, paddingVertical: Theme.space.md },
  primaryBtnText: { color: "#fff", fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium },

  advice: { marginTop: Theme.space.sm, paddingTop: Theme.space.sm, borderTopWidth: 1, borderTopColor: Theme.colors.line },
  adviceKeyedOn: { fontSize: Theme.type.sizes.caption, color: Theme.colors.accent, fontWeight: Theme.type.weights.medium },
  adviceText: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, marginTop: Theme.space.xs },
  adviceAvoid: { fontSize: Theme.type.sizes.caption, color: Theme.colors.negative, marginTop: Theme.space.xs },
  conflict: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, marginTop: Theme.space.sm, lineHeight: Theme.type.sizes.caption * Theme.type.lineHeights.relaxed },

  nav: { position: "absolute", bottom: 0, left: 0, right: 0, height: Theme.layout.navHeight, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: Theme.colors.card, borderTopWidth: 1, borderTopColor: Theme.colors.line },
  navPlus: { width: 48, height: 48, borderRadius: 24, backgroundColor: Theme.colors.ink, alignItems: "center", justifyContent: "center", marginBottom: Theme.space.md },
  navAvatar: { width: 32, height: 32, borderRadius: 16 },
  navAvatarEmpty: { width: 32, height: 32, borderRadius: 16, backgroundColor: Theme.colors.ink, alignItems: "center", justifyContent: "center" },
  navAvatarText: { fontSize: Theme.type.sizes.bodyLarge, fontWeight: Theme.type.weights.semibold, color: "#fff" },
  navProfileBtn: { position: "absolute", right: Theme.space.md, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});