// src/components/PremiumBadge.js
import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { PremiumContext } from '../context/PremiumContext';

/*
 ┌────────────────────────────────────────────────────────┐
 │                   PremiumBadge Usage                    │
 ├────────────────────────────────────────────────────────┤
 │                                                        │
 │  <PremiumBadge />                  → auto (hidden if   │
 │                                      free, shows plan) │
 │  <PremiumBadge size="tiny" />      → 8px dot           │
 │  <PremiumBadge size="icon" />      → 22px icon circle  │
 │  <PremiumBadge size="small" />     → pill: ⭐ PRO      │
 │  <PremiumBadge size="medium" />    → larger pill        │
 │  <PremiumBadge size="large" />     → card with info     │
 │  <PremiumBadge size="banner" />    → full-width banner  │
 │                                                        │
 │  <PremiumBadge tappable />         → opens Premium      │
 │  <PremiumBadge showIfFree />       → shows FREE badge   │
 │  <PremiumBadge animate />          → pulse animation    │
 │  <PremiumBadge forcePlan="pro" />  → force plan display │
 │                                                        │
 └────────────────────────────────────────────────────────┘
*/

// ── Plan visual config ──
const BADGE_CONFIG = {
  free: {
    label: 'FREE',
    title: 'Free Plan',
    subtitle: 'Basic features included',
    icon: 'person-outline',
    bg: '#F3F4F6',
    bgLight: '#F9FAFB',
    border: '#E5E7EB',
    iconColor: '#6B7280',
    textColor: '#6B7280',
    titleColor: '#6B7280',
    shadowColor: '#6B7280',
  },
  pro: {
    label: 'PRO',
    title: 'Pro Plan',
    subtitle: 'All premium features unlocked',
    icon: 'star',
    bg: '#EEF2FF',
    bgLight: '#F5F3FF',
    border: '#C7D2FE',
    iconColor: '#6366F1',
    textColor: '#6366F1',
    titleColor: '#6366F1',
    shadowColor: '#6366F1',
  },
  premium: {
    label: 'PREMIUM',
    title: 'Premium Plan',
    subtitle: 'Everything + priority support',
    icon: 'diamond',
    bg: '#FEF3C7',
    bgLight: '#FFFBEB',
    border: '#FCD34D',
    iconColor: '#F59E0B',
    textColor: '#D97706',
    titleColor: '#D97706',
    shadowColor: '#F59E0B',
  },
};

export default function PremiumBadge({
  size = 'small',
  tappable = false,
  showIfFree = false,
  animate = false,
  forcePlan,
  style,
  onPress: customOnPress,
}) {
  const { currentPlan, isFree } = useContext(PremiumContext);
  const navigation = useNavigation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Determine which plan config to show
  const planId = forcePlan || currentPlan?.id || 'free';
  const config = BADGE_CONFIG[planId] || BADGE_CONFIG.free;

  // Don't render for free users unless forced
  if (isFree && !forcePlan && !showIfFree) return null;

  // ── Pulse animation ──
  useEffect(() => {
    if (!animate) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [animate, pulseAnim]);

  // ── Press handler ──
  const handlePress = () => {
    if (customOnPress) {
      customOnPress();
    } else if (tappable) {
      navigation.navigate('Premium');
    }
  };

  const Wrapper = tappable || customOnPress ? TouchableOpacity : View;
  const wrapperProps =
    tappable || customOnPress
      ? { onPress: handlePress, activeOpacity: 0.7 }
      : {};

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIZE: tiny — 8px colored dot
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (size === 'tiny') {
    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Wrapper
          {...wrapperProps}
          style={[
            styles.tinyDot,
            { backgroundColor: config.iconColor },
            style,
          ]}
        />
      </Animated.View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIZE: icon — 22px icon circle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (size === 'icon') {
    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Wrapper
          {...wrapperProps}
          style={[
            styles.iconBadge,
            { backgroundColor: config.bg },
            style,
          ]}
        >
          <Ionicons name={config.icon} size={12} color={config.iconColor} />
        </Wrapper>
      </Animated.View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIZE: small — compact pill
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (size === 'small') {
    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Wrapper
          {...wrapperProps}
          style={[
            styles.smallBadge,
            { backgroundColor: config.bg },
            style,
          ]}
        >
          <Ionicons name={config.icon} size={10} color={config.iconColor} />
          <Text style={[styles.smallText, { color: config.textColor }]}>
            {config.label}
          </Text>
        </Wrapper>
      </Animated.View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIZE: medium — standard pill
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (size === 'medium') {
    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Wrapper
          {...wrapperProps}
          style={[
            styles.mediumBadge,
            { backgroundColor: config.bg },
            style,
          ]}
        >
          <Ionicons name={config.icon} size={14} color={config.iconColor} />
          <Text style={[styles.mediumText, { color: config.textColor }]}>
            {config.label}
          </Text>
        </Wrapper>
      </Animated.View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIZE: large — card with details
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (size === 'large') {
    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Wrapper
          {...wrapperProps}
          style={[
            styles.largeBadge,
            {
              backgroundColor: config.bgLight,
              borderColor: config.border,
            },
            style,
          ]}
        >
          <View
            style={[
              styles.largeIconCircle,
              { backgroundColor: config.bg },
            ]}
          >
            <Ionicons name={config.icon} size={18} color={config.iconColor} />
          </View>
          <View style={styles.largeContent}>
            <Text style={[styles.largeTitle, { color: config.titleColor }]}>
              {config.title}
            </Text>
            <Text style={styles.largeSubtitle}>{config.subtitle}</Text>
          </View>
          {(tappable || customOnPress) && (
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          )}
        </Wrapper>
      </Animated.View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIZE: banner — full-width upgrade prompt
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (size === 'banner') {
    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Wrapper
          {...wrapperProps}
          style={[styles.bannerBadge, style]}
        >
          {/* Left side */}
          <View style={styles.bannerLeft}>
            <View style={styles.bannerIconCircle}>
              <Ionicons name="sparkles" size={20} color="#F59E0B" />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>
                {isFree ? 'Upgrade to Pro' : config.title}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {isFree
                  ? 'Unlock all features & remove limits'
                  : config.subtitle}
              </Text>
            </View>
          </View>

          {/* Right arrow */}
          <View style={styles.bannerArrow}>
            <Ionicons name="arrow-forward" size={14} color="#6366F1" />
          </View>
        </Wrapper>
      </Animated.View>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIZE: inline — for use inside text rows
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (size === 'inline') {
    return (
      <Wrapper
        {...wrapperProps}
        style={[
          styles.inlineBadge,
          { backgroundColor: config.bg },
          style,
        ]}
      >
        <Ionicons name={config.icon} size={9} color={config.iconColor} />
        <Text style={[styles.inlineText, { color: config.textColor }]}>
          {config.label}
        </Text>
      </Wrapper>
    );
  }

  // Default fallback → small
  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.smallBadge,
        { backgroundColor: config.bg },
        style,
      ]}
    >
      <Ionicons name={config.icon} size={10} color={config.iconColor} />
      <Text style={[styles.smallText, { color: config.textColor }]}>
        {config.label}
      </Text>
    </Wrapper>
  );
}

// ─────────────────────────────────────────
const styles = StyleSheet.create({
  // Tiny
  tinyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Icon
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Small
  smallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  smallText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Medium
  mediumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  mediumText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Large
  largeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  largeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeContent: {
    flex: 1,
    marginLeft: 14,
  },
  largeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  largeSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Banner
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  bannerArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Inline
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
    marginLeft: 6,
  },
  inlineText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});