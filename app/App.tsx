/**
 * ALTIER · app/App.tsx
 * --------------------
 * App shell with navigation between onboarding, today's fit, and profile.
 *
 * Pages 2-4 (Buy-or-not, Try, Profile) are referenced in the original spec.
 * Profile is now built here. Buy-or-not and Try remain stubs.
 *
 * THE API RUNS ON YOUR MAC. Nothing here talks to a server you do not own.
 * EXPO_PUBLIC_ALTIER_API points at the Mac's address on your wifi.
 */
import React, { useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet } from "react-native";

import OnboardingScreen from "./screens/OnboardingScreen";
import TodayScreen from "./screens/TodayScreen";
import ProfileScreen from "./screens/ProfileScreen";

type Screen = "onboarding" | "today" | "profile";

export default function App() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [accessToken, setAccessToken] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      {screen === "onboarding" ? (
        <OnboardingScreen
          accessToken={accessToken}
          onComplete={() => setScreen("today")}
        />
      ) : screen === "profile" ? (
        <ProfileScreen
          accessToken={accessToken}
          onBack={() => setScreen("today")}
        />
      ) : (
        <TodayScreen
          accessToken={accessToken}
          userName="you"
          onProfile={() => setScreen("profile")}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FBECF1" },
});
