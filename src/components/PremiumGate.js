// src/components/PremiumGate.js
import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumContext } from "../context/PremiumContext";
import { useNavigation } from "@react-navigation/native";

/**
 * Wrap any premium feature with this component.
 * If user has access → renders children
 * If not → shows upgrade prompt
 *
 * Usage:
 * <PremiumGate feature="analytics">
 *   <AnalyticsContent />
 * </PremiumGate>
 */
export default function PremiumGate({
  feature,
  children,
  fallbackMessage,
  mini = false, // compact inline version
  style,
}) {
  const { hasFeature, isPro, currentPlan } = useContext(PremiumContext);
  const navigation = useNavigation();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (mini) {
    return (
      <TouchableOpacity
        style={[s.miniBanner, style]}
        onPress={() => navigation.navigate("Premium")}
      >
        <Ionicons
          name="lock-closed"
          size={14}
          color="#F59E0B"
          style={{ marginRight: 6 }}
        />
        <Text style={s.miniBannerTxt}>
          {fallbackMessage || "Upgrade to Pro"}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color="#F59E0B"
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.page}>
      <View style={[s.container, style]}>
       <View style={s.lockCircle}>
  <Ionicons name="rocket" size={28} color="#F59E0B" />
</View>

<Text style={s.title}>Unlock Pro Features 🚀</Text>

<Text style={s.desc}>
  Upgrade to Pro to access powerful tools and boost your experience.
</Text>

{/* Feature list */}
<View style={s.features}>
  {[
    "Advanced Analytics",
    "Unlimited Groups",
    "Priority Support",
    "Export Reports",
    "Ad-free Experience",
  ].map((item) => (
    <View key={item} style={s.featureRow}>
      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
      <Text style={s.featureText}>{item}</Text>
    </View>
  ))}
</View>

{/* Plan info */}
<Text style={s.planInfo}>Current plan: Free</Text>

<TouchableOpacity
  style={s.upgradeBtn}
  onPress={() => navigation.navigate("Premium")}
>
  <Ionicons name="rocket" size={18} color="#fff" style={{ marginRight: 6 }} />
  <Text style={s.upgradeBtnTxt}>Start Free Trial</Text>
</TouchableOpacity>

<Text style={s.startingAt}>
  ₹149/month • Cancel anytime
</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16, // prevents edge touching
    backgroundColor: "#fff", // optional
  },
  container: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 28,
    width: "90%",
    maxWidth: 420,

    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    marginVertical: 8,
  },
  lockCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#92400E",
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    color: "#B45309",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  upgradeBtn: {
    flexDirection: "row",
    backgroundColor: "#F59E0B",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeBtnTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },features: {
  alignSelf: "stretch",
  marginBottom: 18,
},

featureRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 8,
},

featureText: {
  marginLeft: 8,
  fontSize: 14,
  color: "#92400E",
  fontWeight: "500",
},

planInfo: {
  fontSize: 13,
  color: "#B45309",
  marginBottom: 12,
},
  startingAt: {
    fontSize: 12,
    color: "#D97706",
    marginTop: 10,
  },
  miniBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingVertical: 10,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  miniBannerTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    flex: 1,
  },
});
