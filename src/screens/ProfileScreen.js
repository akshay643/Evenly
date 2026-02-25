// src/screens/ProfileScreen.js
import React, { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import PremiumBadge from "../components/PremiumBadge";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase.config";
import { AuthContext } from "../context/AuthContext";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { PremiumContext } from "../context/PremiumContext";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentPlan, isFree, isPro, isPremium } = useContext(PremiumContext);

  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  const [stats, setStats] = useState({
    totalGroups: 0,
    totalExpenses: 0,
    totalSettlements: 0,
    dailyAvg: 0,
    weeklyTotal: 0,
    monthlyTotal: 0,
    allTimeTotal: 0,
    largestExpense: 0,
    mostActiveGroup: null,
    totalOwed: 0,
    totalOwe: 0,
  });

  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === "number") return new Date(ts);
    return new Date(ts);
  };

  useEffect(() => {
    if (!user) return;
    loadUserProfile();
    calculateStats();
  }, [user]);

  useEffect(() => {
    if (userData) {
      setUpiId(userData.upiId || "");
      setBankAccount(userData.bankAccount || "");
      setBankIfsc(userData.bankIfsc || "");
    }
  }, [userData]);

  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setUserData({ id: userDoc.id, ...userDoc.data() });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const calculateStats = async () => {
    if (!user) return;
    try {
      const groupsSnap = await getDocs(
        query(
          collection(db, "groups"),
          where("members", "array-contains", user.uid)
        )
      );
      const groups = [];
      groupsSnap.forEach((d) => groups.push({ id: d.id, ...d.data() }));

      let allExpenses = [];
      for (const g of groups) {
        const expSnap = await getDocs(
          query(collection(db, "expenses"), where("groupId", "==", g.id))
        );
        expSnap.forEach((d) => {
          allExpenses.push({ id: d.id, ...d.data(), groupName: g.name });
        });
      }

      let allSettlements = [];
      for (const g of groups) {
        const setSnap = await getDocs(
          query(collection(db, "settlements"), where("groupId", "==", g.id))
        );
        setSnap.forEach((d) => allSettlements.push({ id: d.id, ...d.data() }));
      }

      const userExpenses = allExpenses.filter(
        (e) => e.paidBy === user.uid || e.splitBetween?.includes(user.uid)
      );

      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let dailyTotal = 0;
      let weeklyTotal = 0;
      let monthlyTotal = 0;
      let allTimeTotal = 0;
      let largestExpense = 0;
      const groupExpenseCount = {};

      userExpenses.forEach((exp) => {
        const expDate = toDate(exp.createdAt);
        const userShare = exp.splitBetween?.includes(user.uid)
          ? exp.amount / exp.splitBetween.length
          : 0;

        allTimeTotal += userShare;
        if (expDate >= dayAgo) dailyTotal += userShare;
        if (expDate >= weekAgo) weeklyTotal += userShare;
        if (expDate >= monthAgo) monthlyTotal += userShare;
        if (exp.amount > largestExpense) largestExpense = exp.amount;

        groupExpenseCount[exp.groupId] =
          (groupExpenseCount[exp.groupId] || 0) + 1;
      });

      let mostActiveGroup = null;
      let maxCount = 0;
      Object.entries(groupExpenseCount).forEach(([groupId, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostActiveGroup = groups.find((g) => g.id === groupId);
        }
      });

      const firstExpense =
        userExpenses.length > 0
          ? userExpenses.reduce((earliest, exp) => {
              const expDate = toDate(exp.createdAt);
              return expDate < earliest ? expDate : earliest;
            }, toDate(userExpenses[0].createdAt))
          : now;
      const daysSinceFirst = Math.max(
        1,
        Math.ceil((now - firstExpense) / (24 * 60 * 60 * 1000))
      );
      const dailyAvg = allTimeTotal / daysSinceFirst;

      let totalOwed = 0;
      let totalOwe = 0;

      for (const g of groups) {
        const groupExpenses = allExpenses.filter((e) => e.groupId === g.id);
        const groupSettlements = allSettlements.filter(
          (s) => s.groupId === g.id
        );

        groupExpenses.forEach(({ paidBy, amount, splitBetween }) => {
          if (!paidBy || !splitBetween) return;
          const share = amount / splitBetween.length;
          if (paidBy === user.uid) {
            splitBetween.forEach((m) => {
              if (m !== user.uid) totalOwed += share;
            });
          }
          if (splitBetween.includes(user.uid) && paidBy !== user.uid) {
            totalOwe += share;
          }
        });

        groupSettlements.forEach(({ from, to, amount }) => {
          if (from === user.uid) totalOwe -= amount;
          if (to === user.uid) totalOwed -= amount;
        });
      }

      setStats({
        totalGroups: groups.length,
        totalExpenses: userExpenses.length,
        totalSettlements: allSettlements.filter(
          (s) => s.from === user.uid || s.to === user.uid
        ).length,
        dailyAvg,
        weeklyTotal,
        monthlyTotal,
        allTimeTotal,
        largestExpense,
        mostActiveGroup,
        totalOwed: Math.max(0, totalOwed),
        totalOwe: Math.max(0, totalOwe),
      });

      setLoading(false);
    } catch (error) {
      console.error("Error calculating stats:", error);
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow access to photos to update profile picture"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await updateDoc(doc(db, "users", user.uid), {
          photoURL: imageUri,
        });
        setUserData({ ...userData, photoURL: imageUri });
        Alert.alert("Success", "Profile picture updated!");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to update profile picture");
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (error) {
            console.error("Sign out error:", error);
            Alert.alert("Error", "Failed to sign out");
          }
        },
      },
    ]);
  };

  const StatCard = ({ icon, label, value, color, trend }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {trend && (
          <View
            style={[
              styles.trendBadge,
              { backgroundColor: trend > 0 ? "#FEE2E2" : "#D1FAE5" },
            ]}
          >
            <Ionicons
              name={trend > 0 ? "trending-up" : "trending-down"}
              size={12}
              color={trend > 0 ? "#EF4444" : "#10B981"}
            />
          </View>
        )}
      </View>
    </View>
  );

  const InfoRow = ({ icon, label, value, color = "#6366F1" }) => (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const netBalance = stats.totalOwed - stats.totalOwe;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={calculateStats} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ═══ Profile Section with PremiumBadge ═══ */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={handleImagePick}
            style={styles.avatarContainer}
          >
            {userData?.photoURL ? (
              <Image
                source={{ uri: userData.photoURL }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {userData?.name?.charAt(0)?.toUpperCase() ||
                    user?.email?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* ✅ Name + Inline Premium Badge */}
          <View style={styles.nameRow}>
            <Text style={styles.userName}>
              {userData?.name || "User"}
            </Text>
            <PremiumBadge size="small" />
          </View>

          <Text style={styles.userEmail}>{user?.email}</Text>

          {/* ✅ Plan badge (tappable, shows for all users) */}
          <TouchableOpacity
            style={[
              styles.planBadge,
              {
                backgroundColor: currentPlan.color + "20",
                borderColor: currentPlan.color,
              },
            ]}
            onPress={() => navigation.navigate("Premium")}
          >
            <Text style={{ fontSize: 16, marginRight: 4 }}>
              {currentPlan.icon}
            </Text>
            <Text
              style={[styles.planBadgeText, { color: currentPlan.color }]}
            >
              {currentPlan.name} Plan
            </Text>
            {isFree && (
              <Ionicons
                name="chevron-forward"
                size={14}
                color={currentPlan.color}
                style={{ marginLeft: 4 }}
              />
            )}
          </TouchableOpacity>

          {/* Net Balance Badge */}
          <View
            style={[
              styles.balanceBadge,
              { backgroundColor: netBalance >= 0 ? "#D1FAE5" : "#FEE2E2" },
            ]}
          >
            <Text
              style={[
                styles.balanceText,
                { color: netBalance >= 0 ? "#10B981" : "#EF4444" },
              ]}
            >
              {netBalance >= 0 ? "💰 " : "⚠️ "}
              Net Balance: ₹{Math.abs(netBalance).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ✅ Upgrade Banner — only for free users */}
        {isFree && (
          <View style={styles.bannerSection}>
            <PremiumBadge size="banner" tappable animate />
          </View>
        )}

        {/* Expense Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💸 Expense Insights</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="calendar-outline"
              label="Daily Average"
              value={`₹${stats.dailyAvg.toFixed(0)}`}
              color="#8B5CF6"
            />
            <StatCard
              icon="calendar"
              label="This Week"
              value={`₹${stats.weeklyTotal.toFixed(0)}`}
              color="#3B82F6"
            />
            <StatCard
              icon="calendar-number"
              label="This Month"
              value={`₹${stats.monthlyTotal.toFixed(0)}`}
              color="#10B981"
            />
            <StatCard
              icon="wallet"
              label="All Time"
              value={`₹${stats.allTimeTotal.toFixed(0)}`}
              color="#F59E0B"
            />
          </View>
        </View>

        {/* Balance Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Balance Overview</Text>
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Ionicons name="arrow-down-circle" size={28} color="#10B981" />
                <Text style={styles.balanceLabel}>Owed to You</Text>
                <Text style={[styles.balanceAmount, { color: "#10B981" }]}>
                  ₹{stats.totalOwed.toFixed(2)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.balanceItem}>
                <Ionicons name="arrow-up-circle" size={28} color="#EF4444" />
                <Text style={styles.balanceLabel}>You Owe</Text>
                <Text style={[styles.balanceAmount, { color: "#EF4444" }]}>
                  ₹{stats.totalOwe.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Activity Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Activity Statistics</Text>
          <View style={styles.card}>
            <InfoRow
              icon="people"
              label="Groups Joined"
              value={stats.totalGroups}
              color="#6366F1"
            />
            <InfoRow
              icon="receipt"
              label="Total Expenses"
              value={stats.totalExpenses}
              color="#8B5CF6"
            />
            <InfoRow
              icon="checkmark-circle"
              label="Settlements Made"
              value={stats.totalSettlements}
              color="#10B981"
            />
            <InfoRow
              icon="trending-up"
              label="Largest Expense"
              value={`₹${stats.largestExpense.toFixed(2)}`}
              color="#F59E0B"
            />
            {stats.mostActiveGroup && (
              <InfoRow
                icon="star"
                label="Most Active Group"
                value={`${stats.mostActiveGroup.icon} ${stats.mostActiveGroup.name}`}
                color="#EC4899"
              />
            )}
          </View>
        </View>

        {/* Friends */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.friendsCard}
            onPress={() => navigation.navigate("Friends")}
            activeOpacity={0.7}
          >
            <View style={styles.friendsCardLeft}>
              <View style={styles.friendsIconContainer}>
                <Ionicons name="people" size={28} color="#6366F1" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.friendsCardTitle}>My Friends</Text>
                <Text style={styles.friendsCardSubtitle}>
                  Manage your friends list for quick group additions
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Smart Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Smart Insights</Text>
          <View style={styles.card}>
            {stats.dailyAvg > 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="analytics" size={20} color="#6366F1" />
                <Text style={styles.insightText}>
                  You spend an average of ₹{stats.dailyAvg.toFixed(0)} per day
                </Text>
              </View>
            )}
            {stats.monthlyTotal > 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="trending-up" size={20} color="#10B981" />
                <Text style={styles.insightText}>
                  Your monthly spending is ₹{stats.monthlyTotal.toFixed(0)}
                </Text>
              </View>
            )}
            {netBalance < 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={styles.insightText}>
                  You owe ₹{Math.abs(netBalance).toFixed(2)} overall. Consider
                  settling up!
                </Text>
              </View>
            )}
            {netBalance > 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.insightText}>
                  You're owed ₹{netBalance.toFixed(2)}. Others should settle
                  with you!
                </Text>
              </View>
            )}
            {stats.totalExpenses === 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="information-circle" size={20} color="#6366F1" />
                <Text style={styles.insightText}>
                  Start adding expenses to track your spending!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ✅ Subscription Management Row */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.subscriptionRow}
            onPress={() => navigation.navigate("Premium")}
            activeOpacity={0.7}
          >
            <View style={styles.subscriptionLeft}>
              <View
                style={[
                  styles.subscriptionIcon,
                  { backgroundColor: currentPlan.color + "15" },
                ]}
              >
                <Ionicons
                  name={isFree ? "sparkles" : "star"}
                  size={22}
                  color={currentPlan.color}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.subscriptionTitleRow}>
                  <Text style={styles.subscriptionTitle}>
                    {isFree ? "Upgrade to Pro" : "Manage Subscription"}
                  </Text>
                  <PremiumBadge size="inline" showIfFree />
                </View>
                <Text style={styles.subscriptionSubtitle}>
                  {isFree
                    ? "Unlock all features & remove limits"
                    : `${currentPlan.name} plan active`}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* Payment Information */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons
              name="card-outline"
              size={20}
              color="#6366F1"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.sectionTitle}>Payment Information</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Share your payment details so group members can pay you easily. This
            info is only visible to your group members.
          </Text>

          <View style={styles.paymentCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>UPI ID</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="yourname@upi"
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bank Account Number</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="business-outline"
                  size={18}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Account number"
                  value={bankAccount}
                  onChangeText={setBankAccount}
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>IFSC Code</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="code-working-outline"
                  size={18}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="IFSC code"
                  value={bankIfsc}
                  onChangeText={setBankIfsc}
                  autoCapitalize="characters"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.savePaymentBtn}
              onPress={async () => {
                try {
                  await updateDoc(doc(db, "users", user.uid), {
                    upiId: upiId.trim(),
                    bankAccount: bankAccount.trim(),
                    bankIfsc: bankIfsc.trim().toUpperCase(),
                    updatedAt: Date.now(),
                  });
                  Alert.alert(
                    "Saved!",
                    "Payment information updated successfully."
                  );
                } catch (e) {
                  Alert.alert("Error", e.message);
                }
              }}
            >
              <Ionicons
                name="save-outline"
                size={18}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.savePaymentBtnTxt}>Save Payment Info</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
  },
  refreshBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#fff",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },

  // ✅ NEW: Name row with badge
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  balanceBadge: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 8,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // ✅ NEW: Banner section
  bannerSection: {
    marginBottom: 8,
  },

  // ✅ NEW: Subscription row
  subscriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  subscriptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  subscriptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  subscriptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subscriptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  subscriptionSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },

  section: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  sectionDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 14,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    alignSelf: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
    textAlign: "center",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  trendBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  balanceItem: {
    flex: 1,
    alignItems: "center",
  },
  divider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  friendsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
  },
  friendsCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  friendsIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  friendsCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  friendsCardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: "#4B5563",
    marginLeft: 12,
    lineHeight: 20,
  },
  paymentCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1F2937",
  },
  savePaymentBtn: {
    flexDirection: "row",
    backgroundColor: "#6366F1",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  savePaymentBtnTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  signOutButton: {
    flexDirection: "row",
    backgroundColor: "#EF4444",
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});