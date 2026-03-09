// src/components/PremiumGate.js
import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumContext } from "../context/PremiumContext";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get('window');

/**
 * Feature-specific configurations for better UX
 */
const FEATURE_CONFIG = {
  analytics: {
    icon: "bar-chart",
    title: "Analytics Dashboard",
    description: "See where your money goes with beautiful charts and spending insights.",
    emoji: "📊",
  },
  advancedSplits: {
    icon: "pie-chart",
    title: "Advanced Split Methods",
    description: "Split by percentage, exact amounts, or custom share ratios.",
    emoji: "🧮",
  },
  groupChat: {
    icon: "chatbubbles",
    title: "Group Chat",
    description: "Discuss expenses and coordinate payments with your group in real-time.",
    emoji: "💬",
  },
  receiptScanning: {
    icon: "scan",
    title: "Receipt Scanning",
    description: "Scan any receipt and auto-fill expense details with AI.",
    emoji: "📸",
  },
  exportCSV: {
    icon: "download",
    title: "Export Reports",
    description: "Download detailed CSV/PDF reports for your records or tax filing.",
    emoji: "📁",
  },
  paymentProof: {
    icon: "camera",
    title: "Payment Proof",
    description: "Attach payment screenshots as proof when settling up.",
    emoji: "🧾",
  },
  recurringExpenses: {
    icon: "repeat",
    title: "Recurring Expenses",
    description: "Auto-add monthly rent, subscriptions, and bills.",
    emoji: "🔄",
  },
  multiCurrency: {
    icon: "cash",
    title: "Multi-Currency",
    description: "Track expenses in different currencies for international trips.",
    emoji: "💱",
  },
  budgetLimits: {
    icon: "shield-checkmark",
    title: "Budget Limits",
    description: "Set spending limits and get alerts when you're close.",
    emoji: "🎯",
  },
  default: {
    icon: "diamond",
    title: "Premium Feature",
    description: "Unlock this feature and many more with Premium.",
    emoji: "💎",
  },
};

/**
 * All premium features for the full-page gate
 */
const ALL_PREMIUM_FEATURES = [
  { icon: "infinite", text: "Unlimited Groups & Expenses" },
  { icon: "pie-chart", text: "Advanced Split Methods" },
  { icon: "chatbubbles", text: "Group Chat" },
  { icon: "scan", text: "Receipt Scanning with AI" },
  { icon: "bar-chart", text: "Analytics Dashboard" },
  { icon: "download", text: "Export CSV/PDF Reports" },
  { icon: "camera", text: "Payment Proof Attachments" },
  { icon: "repeat", text: "Recurring Expenses" },
  { icon: "notifications", text: "Unlimited Reminders" },
  { icon: "eye-off", text: "Ad-free Experience" },
];

/**
 * Wrap any premium feature with this component.
 * If user has access → renders children
 * If not → shows upgrade prompt
 *
 * Usage:
 * <PremiumGate feature="analytics">
 *   <AnalyticsContent />
 * </PremiumGate>
 * 
 * <PremiumGate feature="receiptScanning" mini>
 *   <ScanButton />
 * </PremiumGate>
 */
export default function PremiumGate({
  feature,
  children,
  fallbackMessage,
  mini = false,
  compact = false,
  style,
}) {
  const { hasFeature, isPremium, planName } = useContext(PremiumContext);
  const navigation = useNavigation();

  // User has access to this feature
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // Get feature-specific config
  const featureConfig = FEATURE_CONFIG[feature] || FEATURE_CONFIG.default;

  // ========================================
  // Mini inline banner version
  // ========================================
  if (mini) {
    return (
      <TouchableOpacity
        style={[s.miniBanner, style]}
        onPress={() => navigation.navigate("Premium")}
        activeOpacity={0.7}
      >
        <View style={s.miniBannerIcon}>
          <Ionicons name="lock-closed" size={12} color="#F59E0B" />
        </View>
        <Text style={s.miniBannerTxt}>
          {fallbackMessage || `${featureConfig.title} — Premium`}
        </Text>
        <View style={s.miniBannerBadge}>
          <Text style={s.miniBannerBadgeText}>₹149</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color="#F59E0B"
        />
      </TouchableOpacity>
    );
  }

  // ========================================
  // Compact card version (for inline use)
  // ========================================
  if (compact) {
    return (
      <View style={[s.compactCard, style]}>
        <View style={s.compactHeader}>
          <View style={s.compactIconCircle}>
            <Text style={{ fontSize: 24 }}>{featureConfig.emoji}</Text>
          </View>
          <View style={s.compactLock}>
            <Ionicons name="lock-closed" size={12} color="#fff" />
          </View>
        </View>
        
        <Text style={s.compactTitle}>{featureConfig.title}</Text>
        <Text style={s.compactDesc}>{featureConfig.description}</Text>
        
        <TouchableOpacity
          style={s.compactBtn}
          onPress={() => navigation.navigate("Premium")}
          activeOpacity={0.8}
        >
          <Ionicons name="diamond" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={s.compactBtnText}>Unlock — ₹149</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ========================================
  // Full page upgrade prompt
  // ========================================
  return (
    <View style={s.page}>
      <View style={[s.container, style]}>
        {/* Feature-specific header */}
        <View style={s.featureHeader}>
          <View style={s.iconCircle}>
            <Text style={{ fontSize: 36 }}>{featureConfig.emoji}</Text>
          </View>
          <View style={s.lockBadge}>
            <Ionicons name="lock-closed" size={14} color="#fff" />
          </View>
        </View>

        {/* Title */}
        <Text style={s.title}>{featureConfig.title}</Text>

        {/* Description */}
        <Text style={s.desc}>{featureConfig.description}</Text>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>Included with Premium</Text>
          <View style={s.dividerLine} />
        </View>

        {/* All Premium features list */}
        <View style={s.features}>
          {ALL_PREMIUM_FEATURES.slice(0, 6).map((item) => (
            <View key={item.text} style={s.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={s.featureText}>{item.text}</Text>
            </View>
          ))}
          <Text style={s.moreFeatures}>
            +{ALL_PREMIUM_FEATURES.length - 6} more features
          </Text>
        </View>

        {/* Price highlight */}
        <View style={s.priceBox}>
          <View style={s.priceLeft}>
            <Text style={s.priceLabel}>One-time payment</Text>
            <View style={s.priceRow}>
              <Text style={s.priceCurrency}>₹</Text>
              <Text style={s.priceAmount}>149</Text>
              <Text style={s.priceForever}>forever</Text>
            </View>
          </View>
          <View style={s.priceDivider} />
          <View style={s.priceRight}>
            <View style={s.priceFeature}>
              <Ionicons name="checkmark" size={14} color="#10B981" />
              <Text style={s.priceFeatureText}>Lifetime access</Text>
            </View>
            <View style={s.priceFeature}>
              <Ionicons name="checkmark" size={14} color="#10B981" />
              <Text style={s.priceFeatureText}>No subscriptions</Text>
            </View>
            <View style={s.priceFeature}>
              <Ionicons name="checkmark" size={14} color="#10B981" />
              <Text style={s.priceFeatureText}>Free updates</Text>
            </View>
          </View>
        </View>

        {/* Upgrade button */}
        <TouchableOpacity
          style={s.upgradeBtn}
          onPress={() => navigation.navigate("Premium")}
          activeOpacity={0.8}
        >
          <Ionicons name="diamond" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.upgradeBtnTxt}>Upgrade to Premium</Text>
        </TouchableOpacity>

        {/* Guarantee */}
        <View style={s.guarantee}>
          <Ionicons name="shield-checkmark" size={16} color="#10B981" />
          <Text style={s.guaranteeText}>7-day money-back guarantee</Text>
        </View>

        {/* Current plan info */}
        <View style={s.planBadge}>
          <Ionicons name="person" size={12} color="#9CA3AF" />
          <Text style={s.planInfo}>Current plan: {planName || 'Free'}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Standalone Premium Prompt - For use anywhere
 */
export function PremiumPrompt({ 
  feature, 
  onUpgrade, 
  style,
  showFeatures = true 
}) {
  const navigation = useNavigation();
  const featureConfig = FEATURE_CONFIG[feature] || FEATURE_CONFIG.default;

  return (
    <View style={[s.promptCard, style]}>
      <View style={s.promptHeader}>
        <Text style={{ fontSize: 28 }}>{featureConfig.emoji}</Text>
        <View style={s.promptLockIcon}>
          <Ionicons name="lock-closed" size={10} color="#F59E0B" />
        </View>
      </View>
      
      <Text style={s.promptTitle}>{featureConfig.title}</Text>
      <Text style={s.promptDesc}>{featureConfig.description}</Text>

      {showFeatures && (
        <View style={s.promptFeatures}>
          <View style={s.promptFeatureRow}>
            <Ionicons name="checkmark" size={14} color="#10B981" />
            <Text style={s.promptFeatureText}>One-time ₹149</Text>
          </View>
          <View style={s.promptFeatureRow}>
            <Ionicons name="checkmark" size={14} color="#10B981" />
            <Text style={s.promptFeatureText}>Lifetime access</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={s.promptBtn}
        onPress={() => {
          if (onUpgrade) onUpgrade();
          navigation.navigate("Premium");
        }}
        activeOpacity={0.8}
      >
        <Text style={s.promptBtnText}>Unlock Now</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Premium Badge - Small indicator
 */
export function PremiumBadge({ style, size = 'normal' }) {
  const navigation = useNavigation();
  
  const isSmall = size === 'small';
  
  return (
    <TouchableOpacity
      style={[
        s.badge,
        isSmall && s.badgeSmall,
        style
      ]}
      onPress={() => navigation.navigate("Premium")}
      activeOpacity={0.7}
    >
      <Ionicons 
        name="diamond" 
        size={isSmall ? 10 : 12} 
        color="#F59E0B" 
      />
      <Text style={[s.badgeText, isSmall && s.badgeTextSmall]}>PRO</Text>
    </TouchableOpacity>
  );
}

/**
 * Premium Lock Icon - For buttons/features
 */
export function PremiumLock({ size = 16, style }) {
  return (
    <View style={[s.lockIcon, style]}>
      <Ionicons name="lock-closed" size={size * 0.6} color="#F59E0B" />
    </View>
  );
}

const s = StyleSheet.create({
  // ========================================
  // Full page container
  // ========================================
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
  },

  container: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },

  // Feature header with icon
  featureHeader: {
    position: 'relative',
    marginBottom: 16,
  },

  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FDE68A",
  },

  lockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },

  desc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Features list
  features: {
    alignSelf: "stretch",
    marginBottom: 20,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },

  featureText: {
    marginLeft: 10,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },

  moreFeatures: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  // Price box
  priceBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },

  priceLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  priceLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  priceCurrency: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  priceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  priceForever: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },

  priceDivider: {
    width: 1,
    backgroundColor: '#FDE68A',
    marginHorizontal: 16,
  },

  priceRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },

  priceFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  priceFeatureText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },

  // Upgrade button
  upgradeBtn: {
    flexDirection: "row",
    backgroundColor: "#F59E0B",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },

  upgradeBtnTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Guarantee
  guarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },

  guaranteeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },

  // Plan badge
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 4,
  },

  planInfo: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  // ========================================
  // Mini banner styles
  // ========================================
  miniBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FDE68A",
  },

  miniBannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  miniBannerTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    flex: 1,
  },

  miniBannerBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },

  miniBannerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // ========================================
  // Compact card styles
  // ========================================
  compactCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  compactHeader: {
    position: 'relative',
    marginBottom: 12,
  },

  compactIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  compactLock: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  compactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },

  compactDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },

  compactBtn: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },

  compactBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // ========================================
  // Prompt card styles (standalone)
  // ========================================
  promptCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },

  promptHeader: {
    position: 'relative',
    marginBottom: 12,
  },

  promptLockIcon: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFBEB',
  },

  promptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
    textAlign: 'center',
  },

  promptDesc: {
    fontSize: 13,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },

  promptFeatures: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },

  promptFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  promptFeatureText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },

  promptBtn: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
  },

  promptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // ========================================
  // Badge styles
  // ========================================
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },

  badgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },

  badgeTextSmall: {
    fontSize: 8,
  },

  // Lock icon
  lockIcon: {
    backgroundColor: '#FEF3C7',
    borderRadius: 100,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});