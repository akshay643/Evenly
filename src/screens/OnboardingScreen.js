// src/screens/OnboardingScreen.js
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  // ❌ REMOVE: FlatList — don't import regular FlatList
  Animated,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    emoji: "💰",
    title: "Split Expenses\nEffortlessly",
    subtitle:
      "Create groups, add expenses, and let Evynly figure out who owes what — no math needed.",
    accent: "#6366F1",
    bgDots: "#6366F120",
  },
  {
    id: "2",
    emoji: "📊",
    title: "Track Every\nRupee Spent",
    subtitle:
      "Beautiful analytics show spending patterns, category breakdowns, and monthly trends.",
    accent: "#EC4899",
    bgDots: "#EC489920",
  },
  {
    id: "3",
    emoji: "⚡",
    title: "Settle Up\nInstantly",
    subtitle:
      "Smart debt simplification calculates the minimum transactions needed. One tap to settle.",
    accent: "#10B981",
    bgDots: "#10B98120",
  },
  {
    id: "4",
    emoji: "🔒",
    title: "Secure &\nPrivate",
    subtitle:
      "Your financial data is encrypted and never shared. Bank-grade security built in.",
    accent: "#F59E0B",
    bgDots: "#F59E0B20",
  },
  {
    id: "5",
    emoji: "✨",
    title: "Ready to\nSplit Smart?",
    subtitle:
      "Join thousands who stopped arguing about money. Your first group is just seconds away.",
    accent: "#8B5CF6",
    bgDots: "#8B5CF620",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = useCallback(() => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    if (isLast) {
      onComplete();
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  }, [currentIndex, isLast, onComplete, buttonScale]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const renderSlide = ({ item, index }) => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];

    const iconScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: "clamp",
    });

    const iconOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    });

    const titleTranslateY = scrollX.interpolate({
      inputRange,
      outputRange: [40, 0, -40],
      extrapolate: "clamp",
    });

    const titleOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    });

    const subtitleTranslateY = scrollX.interpolate({
      inputRange,
      outputRange: [60, 0, -60],
      extrapolate: "clamp",
    });

    const subtitleOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    });

    return (
      <View style={[styles.slide, { width }]}>
        {/* Decorative circles */}
        <View style={[styles.bgCircle, { backgroundColor: item.bgDots }]} />
        <View
          style={[styles.bgCircleSmall, { backgroundColor: item.bgDots }]}
        />

        {/* Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: iconScale }],
              opacity: iconOpacity,
            },
          ]}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: item.accent + "15" }]}
          >
            <View style={[styles.iconInner, { backgroundColor: item.accent }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
          </View>
          <View
            style={[styles.glowRing1, { borderColor: item.accent + "20" }]}
          />
          <View
            style={[styles.glowRing2, { borderColor: item.accent + "10" }]}
          />
        </Animated.View>

        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              transform: [{ translateY: titleTranslateY }],
              opacity: titleOpacity,
            },
          ]}
        >
          {item.title}
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          style={[
            styles.subtitle,
            {
              transform: [{ translateY: subtitleTranslateY }],
              opacity: subtitleOpacity,
            },
          ]}
        >
          {item.subtitle}
        </Animated.Text>
      </View>
    );
  };

  const currentAccent = SLIDES[currentIndex]?.accent || "#6366F1";

  return (
    <View style={styles.container}>
      {/* Skip */}
      {!isLast && (
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + 12 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {/* ✅ FIX: Use Animated.FlatList instead of FlatList */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Bottom controls */}
      <View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Pagination dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ],
              outputRange: [1, 4, 1], // scales instead of width
              extrapolate: "clamp",
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ],
              outputRange: [0.25, 1, 0.25],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    transform: [{ scaleX: dotWidth }], // ✅ native-driver safe
                    opacity: dotOpacity,
                    backgroundColor: currentAccent,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* CTA Button */}
        <Animated.View
          style={[styles.ctaWrapper, { transform: [{ scale: buttonScale }] }]}
        >
          <TouchableOpacity
            style={[
              styles.ctaButton,
              { backgroundColor: currentAccent },
              isLast && styles.ctaButtonLast,
            ]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>
              {isLast ? "Let's Go!" : "Continue"}
            </Text>
            <View style={styles.ctaIconCircle}>
              <Ionicons
                name={isLast ? "checkmark" : "arrow-forward"}
                size={18}
                color={currentAccent}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Page indicator */}
        <Text style={styles.pageIndicator}>
          {currentIndex + 1} / {SLIDES.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  skipButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    gap: 2,
  },
  skipText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
    position: "relative",
    overflow: "hidden",
  },
  bgCircle: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -40,
    right: -80,
  },
  bgCircleSmall: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: 80,
    left: -60,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  iconInner: {
    width: 96,
    height: 96,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  emoji: {
    fontSize: 44,
  },
  glowRing1: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 52,
    borderWidth: 2,
  },
  glowRing2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 64,
    borderWidth: 1.5,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
    lineHeight: 42,
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 8,
    maxWidth: 320,
  },
  bottomSection: {
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaWrapper: {
    width: "100%",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: "100%",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
    gap: 12,
  },
  ctaButtonLast: {
    shadowOpacity: 0.4,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  ctaIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  pageIndicator: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 16,
    letterSpacing: 1,
  },
});
