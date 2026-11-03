/**
 * ALTIER · app/screens/ProfileScreen.tsx
 * ------------------------------------------
 * View your saved profile: colour read, body read, palette, taste.
 *
 * Everything here comes from the profile saved at /onboard. Labels are shown
 * with their honesty class — MEASURED, convention over measured, or noisy
 * estimate — so nothing reads as a verdict.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const C = {
  pink: "#FBECF1",
  pink2: "#F6DBE3",
  rose: "#D97A94",
  roseDark: "#C25E7B",
  ink: "#141110",
  muted: "#B29AA1",
  card: "#FFFFFF",
  line: "#F1DDE4",
};

const API_BASE =
  process.env.EXPO_PUBLIC_ALTIER_API ??
  (globalThis as any).ALTIER_API_BASE ??
  "http://localhost:8000";

type ProfileScreenProps = {
  accessToken?: string | null;
  apiBase?: string;
  onBack?: () => void;
};

type Swatch = { hex: string; name: string; kind: string };

export default function ProfileScreen({
  accessToken,
  apiBase = API_BASE,
  onBack,
}: ProfileScreenProps) {
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
      // No dedicated /profile endpoint — read back via /today which returns
      // the stored profile fields, or we can hit /onboard's GET equivalent.
      // TodayScreen gets everything from /today; here we reuse that shape.
      const res = await fetch(`${apiBase}/today`, {
        method: "POST",
        headers,
        body: JSON.stringify({ occasion: null, mood: null, special: null, k: 1 }),
      });
      if (!res.ok) {
        setError(`could not load profile (${res.status})`);
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
      setError(`could not reach ALTIER at ${apiBase}`);
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading) {
    return (
      <View style={s.root}>
        <ActivityIndicator size="large" color={C.roseDark} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color={C.roseDark} />
            <Text style={s.errorText}>{error}</Text>
          </View>
          <View style={s.backRow}>
            <Text onPress={onBack} style={s.backTxt}>Back</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const body = profile?.body ?? {};
  const coloring = profile?.coloring ?? {};
  const face = profile?.face_shape ?? {};
  const swatches = profile?.palette_swatches ?? [];

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Ionicons name="person-outline" size={32} color={C.roseDark} />
          <Text style={s.title}>Your profile</Text>
          <Text style={s.subtitle}>Self-knowledge from your onboarding reads</Text>
        </View>

        {/* Colour read — measured */}
        <View style={s.card}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>COLOUR READ · MEASURED</Text>
            <Text style={s.sectionSub}>CIELAB hue angle + ITA depth</Text>
          </View>
          <View style={s.readRow}>
            <View style={s.readItem}>
              <Text style={s.readLabel}>Undertone</Text>
              <Text style={s.readValue}>{coloring.undertone ?? "—"}</Text>
            </View>
            <View style={s.readItem}>
              <Text style={s.readLabel}>Depth</Text>
              <Text style={s.readValue}>{coloring.depth ?? "—"}</Text>
            </View>
            <View style={s.readItem}>
              <Text style={s.readLabel}>Contrast</Text>
              <Text style={s.readValue}>{coloring.contrast ?? "—"}</Text>
            </View>
          </View>
          <View style={s.swatchWrap}>
            {swatches.map((sw: Swatch) => (
              <View key={sw.hex} style={s.swatchCol}>
                <View style={[s.swatch, { backgroundColor: sw.hex }]} />
                <Text style={s.swatchName}>{sw.name}</Text>
              </View>
            ))}
          </View>
          {coloring.line && (
            <Text style={s.footnote}>{coloring.line}</Text>
          )}
          <Text style={s.honesty}>
            Measured from your photo — CIELAB hue angle (undertone) and ITA
            degrees (depth). The words warm/cool and fair/medium/deep are
            craft cuts across those measured axes.
          </Text>
        </View>

        {/* Face shape */}
        {face.shape && (
          <View style={s.card}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>FACE SHAPE · CONVENTION</Text>
              <Text style={s.sectionSub}>Four ratios from your face mesh</Text>
            </View>
            <View style={s.readRow}>
              <View style={s.readItem}>
                <Text style={s.readLabel}>Shape</Text>
                <Text style={s.readValue}>{face.shape}</Text>
              </View>
              <View style={s.readItem}>
                <Text style={s.readLabel}>Confidence</Text>
                <Text style={s.readValue}>{face.confidence != null ? Math.round(face.confidence * 100) + "%" : "—"}</Text>
              </View>
            </View>
            <Text style={s.footnote}>
              The ratios are measured and scale-free. The shape word is a
              convention cut across them — uncalibrated thresholds.
            </Text>
          </View>
        )}

        {/* Body read */}
        {body.shape || body.ratios && (
          <View style={s.card}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>BODY READ · RATIOS MEASURED</Text>
              <Text style={s.sectionSub}>Shoulder : waist : hip from silhouette</Text>
            </View>
            <View style={s.readRow}>
              <View style={s.readItem}>
                <Text style={s.readLabel}>Shape</Text>
                <Text style={s.readValue}>{body.shape ?? "—"}</Text>
              </View>
              <View style={s.readItem}>
                <Text style={s.readLabel}>Confidence</Text>
                <Text style={s.readValue}>{body.confidence != null ? Math.round(body.confidence * 100) + "%" : "—"}</Text>
              </View>
            </View>
            {body.ratios && (
              <View style={s.ratiosWrap}>
                <Text style={s.ratioLabel}>Ratios</Text>
                {Object.entries(body.ratios as Record<string, number>).map(([key, val]) => (
                  <View key={key} style={s.ratioRow}>
                    <Text style={s.ratioKey}>{key.replace(/_/g, " ")}</Text>
                    <Text style={s.ratioVal}>{val.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
            {body.size_estimate && (
              <View style={s.estimateCard}>
                <Text style={s.estimateTitle}>Rough estimate — NOT a measurement</Text>
                {Object.entries(body.size_estimate.cm as Record<string, number>).map(([part, cm]) => {
                  const range = (body.size_estimate as any).cm_range?.[part];
                  return (
                    <Text key={part} style={s.estimateLine}>
                      {part.replace(/_/g, " ")}: about {cm} cm
                      {range ? ` (${range[0]}–${range[1]})` : ""}
                    </Text>
                  );
                })}
                <Text style={s.estimateNote}>
                  Centimetres from photos are a noisy estimate — never buy to
                  these numbers. Measure with a tape if the size matters.
                </Text>
              </View>
            )}
            <Text style={s.honesty}>
              Ratios are measured from your silhouette at landmark heights —
              scale-free and reliable. The shape word and centimetre estimate
              are convention and estimate, never exact.
            </Text>
          </View>
        )}

        {/* Taste */}
        {profile?.taste && (
          <View style={s.card}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>TASTE · INTERPRETATION</Text>
              <Text style={s.sectionSub}>Mean of images you've saved</Text>
            </View>
            <View style={s.readRow}>
              <View style={s.readItem}>
                <Text style={s.readLabel}>Pins</Text>
                <Text style={s.readValue}>{profile.taste.pins ?? 0}</Text>
              </View>
              <View style={s.readItem}>
                <Text style={s.readLabel}>Available</Text>
                <Text style={s.readValue}>{profile.taste.available ? "yes" : "no"}</Text>
              </View>
            </View>
            <Text style={s.honesty}>
              Your taste vector is the mean of SigLIP embeddings of images you
              saved. It represents images you saved — not clothes you like —
              and makes no correctness claim.
            </Text>
          </View>
        )}

        <View style={{ height: 24 }} />
        {onBack && (
          <View style={s.backRow}>
            <Text onPress={onBack} style={s.backTxt}>← Back to today's fit</Text>
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pink },
  scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },

  header: { alignItems: "center", marginTop: 12 },
  title: { fontWeight: "800", fontSize: 24, lineHeight: 28, color: C.ink, marginTop: 10 },
  subtitle: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 6, lineHeight: 19, paddingHorizontal: 12 },

  card: { backgroundColor: C.card, borderRadius: 20, padding: 17, marginTop: 14 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  sectionTitle: { fontWeight: "800", fontSize: 15, color: C.ink },
  sectionSub: { fontSize: 10, color: C.muted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },

  readRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  readItem: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, alignItems: "center" },
  readLabel: { fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  readValue: { fontWeight: "800", fontSize: 15, color: C.ink },

  swatchWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 12 },
  swatchCol: { width: 50, alignItems: "center" },
  swatch: { width: 36, height: 36, borderRadius: 10, marginBottom: 4 },
  swatchName: { fontSize: 8.5, color: C.muted, textAlign: "center", width: 44 },

  ratiosWrap: { marginTop: 8 },
  ratioLabel: { fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  ratioRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  ratioKey: { fontSize: 12, color: C.ink },
  ratioVal: { fontWeight: "700", fontSize: 12, color: C.roseDark },

  estimateCard: { backgroundColor: "#FBF3E2", borderRadius: 12, padding: 12, marginTop: 12 },
  estimateTitle: { fontSize: 10, fontWeight: "800", color: C.ink, marginBottom: 8 },
  estimateLine: { fontSize: 12, color: C.ink, marginBottom: 4 },
  estimateNote: { fontSize: 10, color: C.muted, marginTop: 8, lineHeight: 15 },

  honesty: { fontSize: 10, color: C.muted, lineHeight: 16, marginTop: 12 },

  footnote: { fontSize: 11, color: C.muted, lineHeight: 17, marginTop: 8 },

  errorCard: { backgroundColor: "#FBF3E2", borderRadius: 14, padding: 14, marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  errorText: { fontSize: 12, color: C.ink, lineHeight: 17, flex: 1 },

  backRow: { marginTop: 16 },
  backTxt: { fontSize: 13, color: C.roseDark, fontWeight: "600" },
});
