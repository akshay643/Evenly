import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { PremiumProvider } from "./src/context/PremiumContext";

export default function App() {
  return (
    <AuthProvider>
      <PremiumProvider>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </PremiumProvider>
    </AuthProvider>
  );
}