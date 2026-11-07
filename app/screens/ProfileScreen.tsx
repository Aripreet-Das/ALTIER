/**
 * ALTIER · app/screens/ProfileScreen.tsx
 * --------------------------------------
 * View your saved profile: colour read, body read, palette, taste.
 *
 * Hallmark build: scaffold → hero → sections → sweep
 * Theme: tailor-studio-v1 | dealt: calm, exact, a little warm
 * Gates: F1-F10 pass, R1-R8 pass, F100-F108 answered
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Theme } from "./design";

/* ---------------- types ---------------- */

type ProfileScreenProps = {
  accessToken?: string | null;
  apiBase?: string;
  onBack?: () => void;
};

type Swatch = { hex: string; name: string; kind: string };

/* ---------------- screen ---------------- */

export default function ProfileScreen({
  accessToken,
  apiBase = process.env.EXPO_PUBLIC_ALTIER_API ?? (globalThis as any).ALTIER_API_BASE ?? "http://localhost:8000",
  onBack,
}: ProfileScreenProps) {
  const { colors, space, radius, type, shadows, layout, macrostructure } = Theme;
const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/today`, {
        method: "POST",
        headers,
        body: JSON.stringify({ occasion: null, mood: null, special: null, k: 1 }),
      });
      if (!res.ok) {
        setError(`Could not load profile (${res.status})`);
        return;
      }
      const data = await res.json();
      setProfile({
        body: data.body,
        coloring: data.coloring,
        face_shape: data.face_shape,
        palette_swatches: data.palette_swatches,
        taste: data.taste,
        pool: data.pool,
      });
    } catch {
      setError(`Could not reach ALTIER at ${apiBase}`);
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: insets.top }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={36} color={colors.negative} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backRow}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const body = profile?.body ?? {};
  const coloring = profile?.coloring ?? {};
  const face = profile?.face_shape ?? {};
  const swatches = profile?.palette_swatches ?? [];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>Self-knowledge from your onboarding reads</Text>
        </View>

        {/* Colour read — measured */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Colour read · measured</Text>
            <Text style={styles.sectionSub}>CIELAB hue angle + ITA depth</Text>
          </View>
          <View style={styles.readRow}>
            <View style={styles.readItem}>
              <Text style={styles.readLabel}>Undertone</Text>
              <Text style={styles.readValue}>{coloring.undertone ?? "—"}</Text>
            </View>
            <View style={styles.readItem}>
              <Text style={styles.readLabel}>Depth</Text>
              <Text style={styles.readValue}>{coloring.depth ?? "—"}</Text>
            </View>
            <View style={styles.readItem}>
              <Text style={styles.readLabel}>Contrast</Text>
              <Text style={styles.readValue}>{coloring.contrast ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.swatchWrap}>
            {swatches.map((sw: Swatch) => (
              <View key={sw.hex} style={styles.swatchCol}>
                <View style={[styles.swatch, { backgroundColor: sw.hex }]} />
                <Text style={styles.swatchName}>{sw.name}</Text>
              </View>
            ))}
          </View>
          {coloring.line && <Text style={styles.readLine}>{coloring.line}</Text>}
          <Text style={styles.honesty}>
            Measured from your photo — CIELAB hue angle (undertone) and ITA
            degrees (depth). The words warm/cool and fair/medium/deep are
            craft cuts across those measured axes.
          </Text>
        </View>

        {/* Face shape */}
        {face.shape && (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Face shape · convention</Text>
              <Text style={styles.sectionSub}>Four ratios from your face mesh</Text>
            </View>
            <View style={styles.readRow}>
              <View style={styles.readItem}>
                <Text style={styles.readLabel}>Shape</Text>
                <Text style={styles.readValue}>{face.shape}</Text>
              </View>
              <View style={styles.readItem}>
                <Text style={styles.readLabel}>Confidence</Text>
                <Text style={styles.readValue}>{face.confidence != null ? Math.round(face.confidence * 100) + "%" : "—"}</Text>
              </View>
            </View>
            <Text style={styles.honesty}>
              The ratios are measured and scale-free. The shape word is a
              convention cut across them — uncalibrated thresholds.
            </Text>
          </View>
        )}

        {/* Body read */}
        {body.shape || body.ratios && (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Body read · ratios measured</Text>
              <Text style={styles.sectionSub}>Shoulder : waist : hip from silhouette</Text>
            </View>
            <View style={styles.readRow}>
              <View style={styles.readItem}>
                <Text style={styles.readLabel}>Shape</Text>
                <Text style={styles.readValue}>{body.shape ?? "—"}</Text>
              </View>
              <View style={styles.readItem}>
                <Text style={styles.readLabel}>Confidence</Text>
                <Text style={styles.readValue}>{body.confidence != null ? Math.round(body.confidence * 100) + "%" : "—"}</Text>
              </View>
            </View>
            {body.ratios && (
              <View style={styles.ratiosWrap}>
                <Text style={styles.ratioLabel}>Ratios</Text>
                {Object.entries(body.ratios as Record<string, number>).map(([key, val]) => (
                  <View key={key} style={styles.ratioRow}>
                    <Text style={styles.ratioKey}>{key.replace(/_/g, " ")}</Text>
                    <Text style={styles.ratioVal}>{val.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
            {body.size_estimate && (
              <View style={styles.estimateCard}>
                <Text style={styles.estimateTitle}>Rough estimate — not a measurement</Text>
                {Object.entries(body.size_estimate.cm as Record<string, number>).map(([part, cm]) => {
                  const range = (body.size_estimate as any).cm_range?.[part];
                  return (
                    <Text key={part} style={styles.estimateLine}>
                      {part.replace(/_/g, " ")}: about {cm} cm
                      {range ? ` (${range[0]}–${range[1]})` : ""}
                    </Text>
                  );
                })}
                <Text style={styles.estimateNote}>
                  Centimetres from photos are a noisy estimate — never buy to
                  these numbers. Measure with a tape if the size matters.
                </Text>
              </View>
            )}
            <Text style={styles.honesty}>
              Ratios are measured from your silhouette at landmark heights —
              scale-free and reliable. The shape word and centimetre estimate
              are convention and estimate, never exact.
            </Text>
          </View>
        )}

        {/* Taste */}
        {profile?.taste && (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Taste · interpretation</Text>
              <Text style={styles.sectionSub}>Mean of images you've saved</Text>
            </View>
            <View style={styles.readRow}>
              <View style={styles.readItem}>
                <Text style={styles.readLabel}>Pins</Text>
                <Text style={styles.readValue}>{profile.taste.pins ?? 0}</Text>
              </View>
              <View style={styles.readItem}>
                <Text style={styles.readLabel}>Available</Text>
                <Text style={styles.readValue}>{profile.taste.available ? "yes" : "no"}</Text>
              </View>
            </View>
            <Text style={styles.honesty}>
              Your taste vector is the mean of SigLIP embeddings of images you
              saved. It represents images you saved — not clothes you like —
              and makes no correctness claim.
            </Text>
          </View>
        )}

        <View style={{ height: space.xl }} />
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backRow}>
            <Text style={styles.backText}>← Back to today's fit</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: space.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.bg },
  scroll: { paddingHorizontal: Theme.layout.screenPadding, paddingTop: Theme.space.md, paddingBottom: Theme.space.xxxl },

  header: { alignItems: "center", marginTop: Theme.space.sm },
  title: {
    fontWeight: Theme.type.weights.semibold,
    fontSize: Theme.type.sizes.hero,
    lineHeight: Theme.type.sizes.hero * Theme.type.lineHeights.tight,
    color: Theme.colors.ink,
    marginTop: Theme.space.sm,
    letterSpacing: Theme.type.tracking.tight,
  },
  subtitle: {
    fontSize: Theme.type.sizes.body,
    color: Theme.colors.muted,
    textAlign: "center",
    marginTop: Theme.space.xs,
    lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed,
    paddingHorizontal: Theme.space.md,
  },

  card: { backgroundColor: Theme.colors.card, borderRadius: Theme.radius.card, padding: Theme.layout.cardPadding, marginTop: Theme.space.md, ...Theme.shadows.card },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: Theme.space.sm },
  sectionTitle: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.bodyLarge, color: Theme.colors.ink },
  sectionSub: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, fontWeight: Theme.type.weights.medium, textTransform: "uppercase", letterSpacing: 0.4 },

  readRow: { flexDirection: "row", gap: Theme.space.sm, marginBottom: Theme.space.sm },
  readItem: { flex: 1, backgroundColor: Theme.colors.raised, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius.control, padding: Theme.space.md, alignItems: "center" },
  readLabel: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: Theme.space.xs },
  readValue: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.bodyLarge, color: Theme.colors.ink },

  readLine: { fontSize: Theme.type.sizes.body, fontWeight: Theme.type.weights.medium, color: Theme.colors.ink, marginTop: Theme.space.sm },

  swatchWrap: { flexDirection: "row", flexWrap: "wrap", gap: Theme.space.sm, marginTop: Theme.space.md },
  swatchCol: { width: 48, alignItems: "center" },
  swatch: { width: 36, height: 36, borderRadius: Theme.radius.control, marginBottom: Theme.space.xs, borderWidth: 1, borderColor: Theme.colors.line },
  swatchName: { fontSize: Theme.type.sizes.micro, color: Theme.colors.muted, textAlign: "center", width: 44 },

  ratiosWrap: { marginTop: Theme.space.xs },
  ratioLabel: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: Theme.space.xs },
  ratioRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Theme.space.xs },
  ratioKey: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink },
  ratioVal: { fontWeight: Theme.type.weights.semibold, fontSize: Theme.type.sizes.body, color: Theme.colors.accent, fontVariant: ["tabular-nums"] },

  estimateCard: { backgroundColor: Theme.colors.accentSoft, borderRadius: Theme.radius.control, padding: Theme.space.md, marginTop: Theme.space.md },
  estimateTitle: { fontSize: Theme.type.sizes.caption, fontWeight: Theme.type.weights.semibold, color: Theme.colors.ink, marginBottom: Theme.space.xs },
  estimateLine: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, marginBottom: Theme.space.xs },
  estimateNote: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, marginTop: Theme.space.xs, lineHeight: Theme.type.sizes.caption * Theme.type.lineHeights.relaxed },

  honesty: { fontSize: Theme.type.sizes.caption, color: Theme.colors.muted, lineHeight: Theme.type.sizes.caption * Theme.type.lineHeights.relaxed, marginTop: Theme.space.md },

  errorCard: { backgroundColor: Theme.colors.accentSoft, borderRadius: Theme.radius.control, padding: Theme.space.md, marginTop: Theme.space.md, flexDirection: "row", alignItems: "flex-start", gap: Theme.space.md },
  errorText: { fontSize: Theme.type.sizes.body, color: Theme.colors.ink, lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed, flex: 1 },

  backRow: { marginTop: Theme.space.lg, alignItems: "center" },
  backText: { fontSize: Theme.type.sizes.body, color: Theme.colors.accent, fontWeight: Theme.type.weights.medium },
});