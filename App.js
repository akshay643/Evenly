// App.js
import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { PremiumProvider } from './src/context/PremiumContext';
import AppNavigator from './src/navigation/AppNavigator';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Smooth splash exit
SplashScreen.setOptions({
  duration: 800,
  fade: true,
});

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(null); // null = loading

  useEffect(() => {
    async function bootstrap() {
      try {
        // 1. Check if user completed onboarding before
        const done = await AsyncStorage.getItem('@evenly_onboarding_complete');
        setOnboardingDone(done === 'true');

        // 2. Preload anything else (fonts, assets, etc.)
        // await Font.loadAsync({ ... });

        // 3. Minimum splash for branding
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.warn('Bootstrap error:', e);
        setOnboardingDone(false);
      } finally {
        setAppReady(true);
      }
    }

    bootstrap();
  }, []);

  // Hide splash when ready
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  // Called when user finishes onboarding
  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem('@evenly_onboarding_complete', 'true');
    setOnboardingDone(true);
  }, []);

  if (!appReady) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PremiumProvider>
          <NavigationContainer>
            <AppNavigator
              onboardingDone={onboardingDone}
              completeOnboarding={completeOnboarding}
            />
            <StatusBar style="auto" />
          </NavigationContainer>
        </PremiumProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}