/**
 * ALTIER · app/screens/OnboardingScreen.tsx
 * -----------------------------------------
 * Face + body photos + height → POST /onboard → saved profile.
 *
 * Hallmark build: scaffold → hero → sections → sweep
 * Theme: tailor-studio-v1 | dealt: calm, exact, a little warm
 * Gates: F1-F10 pass, R1-R8 pass, F100-F108 answered
 */

import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  LayoutAnimation, UIManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

import { Theme } from "./design";

/* ---------------- types ---------------- */

type PhotoSlot = "face" | "body_front" | "body_side";

type OnboardingScreenProps = {
  accessToken?: string | null;
  apiBase?: string;
  onComplete?: () => void;
};

/* ---------------- photo picker ---------------- */

async function pickImage(): Promise<{ uri: string; base64?: string | null } | null> {
  if (Platform.OS === "web") return null;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== "granted") return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    aspect: [4, 5],
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

async function assetToBase64(asset: { uri: string; base64?: string | null }): Promise<string> {
  if (asset.base64) return asset.base64;
  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch {
    throw new Error("Could not convert photo to base64");
  }
}

/* ---------------- screen ---------------- */

const API_BASE =
  process.env.EXPO_PUBLIC_ALTIER_API ??
  (globalThis as any).ALTIER_API_BASE ??
  "http://localhost:8000";

export default function OnboardingScreen({
  accessToken,
  apiBase = API_BASE,
  onComplete,
}: OnboardingScreenProps) {
  const { colors, space, radius, type, shadows, layout, macrostructure } = Theme;
const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<Record<PhotoSlot, { uri: string; base64?: string | null } | null>>({
    face: null,
    body_front: null,
    body_side: null,
  });
  const [heightCm, setHeightCm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const handlePick = useCallback(async (slot: PhotoSlot) => {
    const asset = await pickImage();
    if (asset) {
      LayoutAnimation.configureNext(LayoutAnimation.create(
        Theme.motion.durations.normal,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      ));
      setPhotos((p) => ({ ...p, [slot]: asset }));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!photos.face) {
      setError("A face photo is required to start.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const height = heightCm.trim() ? parseFloat(heightCm) : undefined;
      const faceB64 = await assetToBase64(photos.face!);
      const body: Record<string, any> = { face_photo: faceB64 };
      if (photos.body_front) body.body_photo = await assetToBase64(photos.body_front);
      if (photos.body_side) body.body_photo_side = await assetToBase64(photos.body_side);
      if (height !== undefined) body.height_cm = height;

      const res = await fetch(`${apiBase}/onboard`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.detail ?? `Onboard failed (${res.status})`);
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.create(
        Theme.motion.durations.slow,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      ));
      setDone(true);
      onComplete?.();
    } catch {
      setError(`Could not reach ALTIER at ${apiBase}`);
    } finally {
      setSubmitting(false);
    }
  }, [apiBase, headers, photos, heightCm, onComplete]);

  if (done) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space.xl }]} showsVerticalScrollIndicator={false}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
            <Text style={styles.successTitle}>Profile saved</Text>
            <Text style={styles.successNote}>
              Your colour, body and palette reads are stored. Tap below to see
              today's fit built from them.
            </Text>
            <TouchableOpacity onPress={onComplete} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Continue to Today's Fit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + macrostructure.onboarding.bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header - Hero */}
        <View style={styles.header}>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            One face photo, plus body photos and your height. That is everything
            the colour, body and palette engines need.
          </Text>
        </View>

        {/* Photo Cards */}
        {[
          { slot: "face" as PhotoSlot, label: "Face photo · required", note: "Full face, front-on, good light. Used for undertone, depth and face shape.", required: true },
          { slot: "body_front" as PhotoSlot, label: "Body photo front · optional", note: "Full body, head to feet, front-on. Used for body shape and ratios. Without it, body shape stays unread.", required: false },
          { slot: "body_side" as PhotoSlot, label: "Body photo side · optional", note: "Side-on, full body. Without it, depth is assumed (0.72 × width) and the centimetre estimate is a rougher guess.", required: false },
        ].map((config) => (
          <View key={config.slot} style={styles.card}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotLabel}>{config.label}</Text>
              <Text style={styles.slotNote}>{config.note}</Text>
            </View>
            <View style={styles.photoDrop}>
              {photos[config.slot] ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photos[config.slot]!.uri }} style={styles.photoImg} />
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.create(
                        Theme.motion.durations.fast,
                        LayoutAnimation.Types.easeInEaseOut,
                        LayoutAnimation.Properties.opacity
                      ));
                      setPhotos((p) => ({ ...p, [config.slot]: null }));
                    }}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash" size={20} color={colors.quiet} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => handlePick(config.slot)} style={styles.photoPlaceholder}>
                  <Ionicons name="image" size={32} color={colors.muted} />
                  <Text style={styles.placeholderText}>Tap to choose {config.required ? "face" : config.slot.replace("_", " ")} photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Height */}
        <View style={styles.card}>
          <View style={styles.slotHeader}>
            <Text style={styles.slotLabel}>Height (cm) · optional</Text>
            <Text style={styles.slotNote}>
              Needed for any centimetre estimate. Without it, only ratios and
              shape are returned.
            </Text>
          </View>
          <TextInput
            style={styles.heightInput}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="numeric"
            placeholder="e.g. 165"
            placeholderTextColor={colors.quiet}
          />
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={colors.negative} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !photos.face}
          style={[
            styles.primaryBtn,
            (submitting || !photos.face) && styles.primaryBtnDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {!photos.face ? "Add face photo first" : "Save profile"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: space.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.bg },
  scroll: {
    paddingHorizontal: Theme.layout.screenPadding,
    paddingTop: Theme.space.md,
    paddingBottom: Theme.space.xxl + Theme.layout.navHeight,
  },

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

  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.card,
    padding: Theme.layout.cardPadding,
    marginTop: Theme.space.md,
    ...Theme.shadows.card,
  },
  slotHeader: { marginBottom: Theme.space.sm },
  slotLabel: {
    fontSize: Theme.type.sizes.caption,
    letterSpacing: Theme.type.tracking.wide,
    textTransform: "uppercase",
    color: Theme.colors.muted,
    fontWeight: Theme.type.weights.medium,
    marginBottom: Theme.space.xs,
  },
  slotNote: {
    fontSize: Theme.type.sizes.body,
    color: Theme.colors.muted,
    lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed,
  },

  photoDrop: {
    borderWidth: 1,
    borderColor: Theme.colors.line,
    borderRadius: Theme.radius.control,
    backgroundColor: Theme.colors.raised,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  photoPreview: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
  photoImg: { width: "100%", height: 220, borderRadius: Theme.radius.control },
  removeBtn: {
    position: "absolute",
    top: Theme.space.sm,
    right: Theme.space.sm,
    backgroundColor: "rgba(31,27,22,0.7)",
    borderRadius: Theme.radius.keycap,
    padding: Theme.space.xs,
  },
  photoPlaceholder: { alignItems: "center", gap: Theme.space.sm },
  placeholderText: {
    fontSize: Theme.type.sizes.body,
    color: Theme.colors.muted,
    fontWeight: Theme.type.weights.medium,
  },

  heightInput: {
    fontSize: Theme.type.sizes.bodyLarge,
    color: Theme.colors.ink,
    paddingVertical: Theme.space.md,
    paddingHorizontal: Theme.space.md,
    borderWidth: 1,
    borderColor: Theme.colors.line,
    borderRadius: Theme.radius.control,
    backgroundColor: Theme.colors.bg,
  },

  errorCard: {
    backgroundColor: Theme.colors.accentSoft,
    borderRadius: Theme.radius.control,
    padding: Theme.space.md,
    marginTop: Theme.space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Theme.space.sm,
  },
  errorText: {
    fontSize: Theme.type.sizes.body,
    color: Theme.colors.ink,
    lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed,
    flex: 1,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.space.sm,
    backgroundColor: Theme.colors.ink,
    borderRadius: Theme.radius.control,
    paddingVertical: Theme.space.md,
    marginTop: Theme.space.lg,
  },
  primaryBtnDisabled: { backgroundColor: Theme.colors.muted },
  primaryBtnText: { color: "#fff", fontSize: Theme.type.sizes.bodyLarge, fontWeight: Theme.type.weights.medium },

  successCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.panel,
    padding: Theme.space.xxl,
    alignItems: "center",
    marginTop: Theme.space.lg,
    ...Theme.shadows.card,
  },
  successTitle: {
    fontWeight: Theme.type.weights.semibold,
    fontSize: Theme.type.sizes.title,
    color: Theme.colors.ink,
    marginTop: Theme.space.md,
  },
  successNote: {
    fontSize: Theme.type.sizes.body,
    color: Theme.colors.muted,
    textAlign: "center",
    marginTop: Theme.space.xs,
    lineHeight: Theme.type.sizes.body * Theme.type.lineHeights.relaxed,
    paddingHorizontal: Theme.space.md,
  },
});