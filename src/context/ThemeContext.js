// src/context/ThemeContext.js
import React, { createContext, useState, useEffect, useContext } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ThemeContext = createContext();

const THEME_STORAGE_KEY = "@evynly_theme_mode";

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState("system"); // light | dark | system
  const [theme, setTheme] = useState("light"); // actual applied theme
  const [isLoading, setIsLoading] = useState(true);

  // Get system theme
  const getSystemTheme = () => Appearance.getColorScheme() || "light";

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode) {
          setMode(savedMode);
          if (savedMode === "system") {
            setTheme(getSystemTheme());
          } else {
            setTheme(savedMode);
          }
        } else {
          // Default to system
          setTheme(getSystemTheme());
        }
      } catch (e) {
        console.warn("Error loading theme:", e);
        setTheme(getSystemTheme());
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTheme();
  }, []);

  // Apply theme based on mode
  useEffect(() => {
    if (mode === "system") {
      setTheme(getSystemTheme());
    } else {
      setTheme(mode);
    }
  }, [mode]);

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (mode === "system") {
        setTheme(colorScheme || "light");
      }
    });

    return () => subscription.remove();
  }, [mode]);

  // Change theme mode
  const changeMode = async (newMode) => {
    setMode(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.warn("Error saving theme:", e);
    }
  };

  // Toggle between light and dark (ignores system)
  const toggleTheme = async () => {
    const newMode = theme === "light" ? "dark" : "light";
    await changeMode(newMode);
  };

  // Theme colors helper
  const colors = {
    light: {
      background: "#F9FAFB",
      surface: "#FFFFFF",
      text: "#1F2937",
      textSecondary: "#6B7280",
      border: "#E5E7EB",
      primary: "#6366F1",
      card: "#FFFFFF",
    },
    dark: {
      background: "#111827",
      surface: "#1F2937",
      text: "#F9FAFB",
      textSecondary: "#9CA3AF",
      border: "#374151",
      primary: "#818CF8",
      card: "#1F2937",
    },
  };

  const value = {
    theme,                    // "light" or "dark"
    mode,                     // "light", "dark", or "system"
    setMode: changeMode,      // Change mode with persistence
    toggleTheme,              // Quick toggle
    isDark: theme === "dark", // Boolean helper
    colors: colors[theme],    // Current theme colors
    isLoading,               // Loading state
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for easy access
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};