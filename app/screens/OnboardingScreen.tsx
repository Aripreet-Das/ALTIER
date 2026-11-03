/**
 * ALTIER · app/screens/OnboardingScreen.tsx
 * ------------------------------------------
 * Face + body photos + height -> POST /onboard -> saved profile.
 *
 * ALTIER's honesty contract starts here: the body read is allowed to fail
 * without failing onboarding. A cropped body photo is a common mistake —
 * the colour read is still saved, and body.error tells the user what to
 * reshoot.
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

/* ---------------- tokens (match TodayScreen) ---------------- */
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

type PhotoSlot = "face" | "body_front" | "body_side";

type OnboardingScreenProps = {
  accessToken?: string | null;
  apiBase?: string;
  onComplete?: () => void;
};

/* ---------------- photo picker ---------------- */
async function pickImage(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== "granted") return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    aspect: [4, 5],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

async function uriToBase64(uri: string): Promise<string> {
  // file:// URIs on mobile need to be read via expo-file-system and converted
  // to base64 before sending to the API. Data URIs are returned as-is.
  if (uri.startsWith("data:")) return uri;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch {
    // Fallback: return the URI as-is if reading fails
    return uri;
  }
}

export default function OnboardingScreen({
  accessToken,
  apiBase = API_BASE,
  onComplete,
}: OnboardingScreenProps) {
  const [photos, setPhotos] = useState<Record<PhotoSlot, string | null>>({
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
    const uri = await pickImage();
    if (uri) {
      setPhotos((p) => ({ ...p, [slot]: uri }));
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
      const faceB64 = await uriToBase64(photos.face!);
      const body: any = {
        face_photo: faceB64,
      };
      if (photos.body_front) body.body_photo = await uriToBase64(photos.body_front);
      if (photos.body_side) body.body_photo_side = await uriToBase64(photos.body_side);
      if (height !== undefined) body.height_cm = height;

      const res = await fetch(`${apiBase}/onboard`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.detail ?? `onboard failed (${res.status})`);
        return;
      }
      setDone(true);
      onComplete?.();
    } catch {
      setError(`could not reach ALTIER at ${apiBase}`);
    } finally {
      setSubmitting(false);
    }
  }, [apiBase, headers, photos, heightCm, onComplete]);

  if (done) {
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={C.roseDark} />
            <Text style={s.successTitle}>Profile saved</Text>
            <Text style={s.successNote}>
              Your colour, body and palette reads are stored. Tap below to see
              today's fit built from them.
            </Text>
            <TouchableOpacity onPress={onComplete} style={s.blackBtn}>
              <Text style={s.blackBtnTxt}>Continue to Today's Fit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Ionicons name="camera" size={32} color={C.roseDark} />
          <Text style={s.title}>Tell ALTIER about you</Text>
          <Text style={s.subtitle}>
            One face photo, plus body photos and your height. That's everything
            the colour, body and palette engines need.
          </Text>
        </View>

        {/* Face photo (required) */}
        <View style={s.card}>
          <Text style={s.slotLabel}>FACE PHOTO · REQUIRED</Text>
          <Text style={s.slotNote}>
            Full face, front-on, good light. Used for undertone, depth and
            face shape.
          </Text>
          <View style={s.photoDrop}>
            {photos.face ? (
              <View style={s.photoPreview}>
                <Image source={{ uri: photos.face }} style={s.photoImg} />
                <TouchableOpacity
                  onPress={() => setPhotos((p) => ({ ...p, face: null }))}
                  style={s.removeBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={C.ink} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => handlePick("face")} style={s.photoPlaceholder}>
                <Ionicons name="image-outline" size={32} color={C.muted} />
                <Text style={s.placeholderText}>Tap to choose face photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Body photo front (optional) */}
        <View style={s.card}>
          <Text style={s.slotLabel}>BODY PHOTO · FRONT · OPTIONAL</Text>
          <Text style={s.slotNote}>
            Full body, head to feet, front-on. Used for body shape and ratios.
            Without it, body shape stays unread.
          </Text>
          <View style={s.photoDrop}>
            {photos.body_front ? (
              <View style={s.photoPreview}>
                <Image source={{ uri: photos.body_front }} style={s.photoImg} />
                <TouchableOpacity
                  onPress={() => setPhotos((p) => ({ ...p, body_front: null }))}
                  style={s.removeBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={C.ink} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handlePick("body_front")}
                style={s.photoPlaceholder}
              >
                <Ionicons name="image-outline" size={32} color={C.muted} />
                <Text style={s.placeholderText}>Tap to choose front body photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Body photo side (optional) */}
        <View style={s.card}>
          <Text style={s.slotLabel}>BODY PHOTO · SIDE · OPTIONAL</Text>
          <Text style={s.slotNote}>
            Side-on, full body. Without it, depth is assumed (0.72 × width) and
            the centimetre estimate is a rougher guess.
          </Text>
          <View style={s.photoDrop}>
            {photos.body_side ? (
              <View style={s.photoPreview}>
                <Image source={{ uri: photos.body_side }} style={s.photoImg} />
                <TouchableOpacity
                  onPress={() => setPhotos((p) => ({ ...p, body_side: null }))}
                  style={s.removeBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={C.ink} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handlePick("body_side")}
                style={s.photoPlaceholder}
              >
                <Ionicons name="image-outline" size={32} color={C.muted} />
                <Text style={s.placeholderText}>Tap to choose side body photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Height */}
        <View style={s.card}>
          <Text style={s.slotLabel}>HEIGHT (CM) · OPTIONAL</Text>
          <Text style={s.slotNote}>
            Needed for any centimetre estimate. Without it, only ratios and
            shape are returned.
          </Text>
          <TextInput
            style={s.heightInput}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="numeric"
            placeholder="e.g. 165"
            placeholderTextColor={C.muted}
          />
        </View>

        {error && (
          <View style={s.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color={C.roseDark} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !photos.face}
          style={(submitting || !photos.face) ? [s.blackBtn, s.blackBtnDisabled] : [s.blackBtn]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.blackBtnTxt}>
              {!photos.face ? "Add face photo first" : "Save profile"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

/* ---------------- styles ---------------- */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pink },
  scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },

  header: { alignItems: "center", marginTop: 12 },
  title: { fontWeight: "800", fontSize: 24, lineHeight: 28, color: C.ink, marginTop: 10 },
  subtitle: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 6, lineHeight: 19, paddingHorizontal: 12 },

  card: { backgroundColor: C.card, borderRadius: 20, padding: 17, marginTop: 14 },
  slotLabel: { fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase", color: C.roseDark, fontWeight: "700", marginBottom: 6 },
  slotNote: { fontSize: 11.5, color: C.muted, lineHeight: 17, marginBottom: 12 },

  photoDrop: { borderWidth: 2, borderColor: C.line, borderRadius: 14, borderStyle: "dashed", backgroundColor: "#fff", minHeight: 220, alignItems: "center", justifyContent: "center", position: "relative" },
  photoPreview: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
  photoImg: { width: "100%", height: 220, borderRadius: 12 },
  removeBtn: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(20,17,16,0.8)", borderRadius: 20, padding: 6 },
  photoPlaceholder: { alignItems: "center", gap: 10 },
  placeholderText: { fontSize: 13, color: C.muted, fontWeight: "600" },

  heightInput: { fontSize: 16, color: C.ink, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: "#fff" },

  errorCard: { backgroundColor: "#FBF3E2", borderRadius: 14, padding: 14, marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  errorText: { fontSize: 12, color: C.ink, lineHeight: 17, flex: 1 },

  blackBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.ink, borderRadius: 999, paddingVertical: 16, marginTop: 20 },
  blackBtnDisabled: { backgroundColor: C.muted },
  blackBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },

  successCard: { backgroundColor: C.card, borderRadius: 24, padding: 24, alignItems: "center", marginTop: 20 },
  successTitle: { fontWeight: "800", fontSize: 20, color: C.ink, marginTop: 12 },
  successNote: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 6, lineHeight: 19, paddingHorizontal: 12 },
});
