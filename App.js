// App.js
import React, { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Text, Image, StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { PremiumProvider } from "./src/context/PremiumContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NotifierWrapper } from "react-native-notifier";
import { ConfirmProvider } from "./src/context/ConfirmContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";

// Custom Navigation Theme
const LightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#6366F1",
    background: "#F9FAFB",
    card: "#FFFFFF",
    text: "#1F2937",
    border: "#E5E7EB",
  },
};

const DarkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#818CF8",
    background: "#111827",
    card: "#1F2937",
    text: "#F9FAFB",
    border: "#374151",
  },
};

// Inner App Component (has access to ThemeContext)
function AppContent({ onboardingDone, completeOnboarding }) {
  const { theme, isDark } = useTheme();

  return (
    <NavigationContainer 
      theme={isDark ? DarkNavigationTheme : LightNavigationTheme}
    >
      <ConfirmProvider>
        <AppNavigator
          onboardingDone={onboardingDone}
          completeOnboarding={completeOnboarding}
        />
        <StatusBar style={isDark ? "light" : "dark"} />
      </ConfirmProvider>
    </NavigationContainer>
  );
}

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const done = await AsyncStorage.getItem("@evynly_onboarding_complete");
        setOnboardingDone(done === "true");
        
        // Minimum splash for branding
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.warn("Bootstrap error:", e);
        setOnboardingDone(false);
      } finally {
        setAppReady(true);
      }
    }

    bootstrap();
  }, []);


  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem("@evynly_onboarding_complete", "true");
    setOnboardingDone(true);
  }, []);

  if (!appReady) {
    return (
      <View style={splashStyles.container}>
        <Image
          source={require("./assets/splash-icon.png")}
          style={splashStyles.logo}
          resizeMode="contain"
        />
        <Text style={splashStyles.name}>evynly</Text>
        <Text style={splashStyles.tagline}>Split expenses. Stay friends.</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NotifierWrapper>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <PremiumProvider>
                <AppContent
                  onboardingDone={onboardingDone}
                  completeOnboarding={completeOnboarding}
                />
              </PremiumProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </NotifierWrapper>
    </GestureHandlerRootView>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F23",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  name: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: "#6B7280",
    letterSpacing: 0.3,
  },
});