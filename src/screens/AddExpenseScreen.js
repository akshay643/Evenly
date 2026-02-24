// src/screens/AddExpenseScreen.js
import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  sendPushNotification,
  NotificationTemplates,
} from "../services/notificationService";
import { haptic } from "../utils/haptics";
import { PremiumContext } from "../context/PremiumContext";
import { usePremiumLimit, LimitIndicator } from "../components/PremiumLimitCheck";
import { useGroupExpenseCount } from "../hooks/useGroupExpenseCount";
import { AuthContext } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase.config";
import SplitMethodPicker from "../components/SplitMethodPicker";

export default function AddExpenseScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const { hasFeature } = useContext(PremiumContext);
  const { checkLimit } = usePremiumLimit();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Member data + split selection
  const [membersData, setMembersData] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Real-time count of user's expenses in selected group
  const { count: userExpenseCount, loading: countLoading } =
    useGroupExpenseCount(user?.uid, selectedGroup?.id);

  // Split data from SplitMethodPicker
  const [splitData, setSplitData] = useState({
    method: "equal",
    splitAmounts: {},
    isValid: true,
  });

  useEffect(() => {
    loadGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup);
    } else {
      setMembersData([]);
      setSelectedMembers([]);
    }
  }, [selectedGroup?.id]);

  const loadGroups = async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const q = query(
        collection(db, "groups"),
        where("members", "array-contains", user.uid)
      );
      const snapshot = await getDocs(q);
      const groupsData = [];
      snapshot.forEach((d) => {
        groupsData.push({ id: d.id, ...d.data() });
      });
      setGroups(groupsData);

      if (route?.params?.groupId) {
        const pre = groupsData.find((g) => g.id === route.params.groupId);
        if (pre) {
          setSelectedGroup(pre);
          return;
        }
      }
      if (groupsData.length > 0) setSelectedGroup(groupsData[0]);
    } catch (error) {
      Alert.alert("Error", "Failed to load groups");
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchGroupMembers = async (group) => {
    if (!group?.members?.length) return;
    setLoadingMembers(true);
    try {
      const members = await Promise.all(
        group.members.map(async (mid) => {
          const d = await getDoc(doc(db, "users", mid));
          return d.exists()
            ? { id: mid, ...d.data() }
            : { id: mid, name: null, email: "Unknown" };
        })
      );
      setMembersData(members);
      setSelectedMembers(members.map((m) => m.id));
    } catch (e) {
      console.error("Error loading members:", e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const getCurrencySymbol = () => {
    const map = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      INR: "₹",
      JPY: "¥",
      AUD: "A$",
      CAD: "C$",
    };
    return map[selectedGroup?.currency] || "₹";
  };

  const sym = getCurrencySymbol();
  const parsedAmount = parseFloat(amount) || 0;

  // Check if split method is allowed based on plan
  const isSplitMethodAllowed = (method) => {
    if (method === "equal") return true;
    if (method === "exact") return hasFeature("unequalSplit");
    if (method === "percentage") return hasFeature("percentageSplit");
    if (method === "shares") return hasFeature("sharesSplit");
    return false;
  };

  const handleAddExpense = async () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return;
    }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (!selectedGroup) {
      Alert.alert("Error", "Please select a group");
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert("Error", "Select at least one member to split with");
      return;
    }
    if (!splitData.isValid) {
      Alert.alert(
        "Invalid Split",
        "The split amounts don't add up correctly. Please fix before adding."
      );
      return;
    }

    // Check split method is allowed by plan
    if (!isSplitMethodAllowed(splitData.method)) {
      Alert.alert(
        "🔒 Premium Feature",
        `${splitData.method.charAt(0).toUpperCase() + splitData.method.slice(1)} split requires a Pro or Premium plan.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "⭐ Upgrade", onPress: () => navigation.navigate("Premium") },
        ]
      );
      return;
    }

    // Check per-group expense limit
    if (!checkLimit("maxExpensesPerGroup", userExpenseCount)) {
      return;
    }

    setLoading(true);
    try {
      const expenseDoc = {
        description: description.trim(),
        amount: parsedAmount,
        groupId: selectedGroup.id,
        paidBy: user.uid,
        paidByEmail: user.email,
        splitBetween: selectedMembers,
        splitMethod: splitData.method,
        createdAt: Date.now(),
        settled: false,
      };

      if (splitData.method !== "equal") {
        expenseDoc.splitAmounts = splitData.splitAmounts;
      }

      await addDoc(collection(db, "expenses"), expenseDoc);
      haptic.success();

      // Send push notifications
      const template = NotificationTemplates.newExpense(
        user.email,
        parsedAmount,
        selectedGroup.name,
        sym
      );
      for (const memberId of selectedMembers) {
        if (memberId === user.uid) continue;
        try {
          const mDoc = await getDoc(doc(db, "users", memberId));
          const mData = mDoc.data();
          if (mData?.pushToken) {
            await sendPushNotification(mData.pushToken, {
              ...template,
              data: { ...template.data, groupId: selectedGroup.id },
            });
          }
        } catch (e) {
          console.log("Push to", memberId, "failed:", e.message);
        }
      }

      Alert.alert("Success", "Expense added!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to add expense: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Limit indicator — shows only for free users */}
        {selectedGroup && !countLoading && (
          <LimitIndicator
            limitKey="maxExpensesPerGroup"
            currentCount={userExpenseCount}
            label={`Your expenses in ${selectedGroup.name}`}
          />
        )}

        <View style={styles.form}>
          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{sym}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="What was this expense for?"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Group */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group</Text>
            {loadingGroups ? (
              <ActivityIndicator
                size="small"
                color="#6366F1"
                style={{ marginVertical: 10 }}
              />
            ) : groups.length === 0 ? (
              <Text style={styles.noGroupsText}>
                No groups available. Create a group first.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupChip,
                      selectedGroup?.id === group.id &&
                        styles.groupChipSelected,
                    ]}
                    onPress={() => setSelectedGroup(group)}
                  >
                    <Text style={styles.groupChipEmoji}>
                      {group.icon || "👥"}
                    </Text>
                    <Text
                      style={[
                        styles.groupChipText,
                        selectedGroup?.id === group.id &&
                          styles.groupChipTextSelected,
                      ]}
                    >
                      {group.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Split Method Picker */}
          {selectedGroup && !loadingMembers && membersData.length > 0 && (
            <View style={styles.inputGroup}>
              <SplitMethodPicker
                members={membersData}
                totalAmount={parsedAmount}
                currentUserId={user.uid}
                currencySymbol={sym}
                selectedMembers={selectedMembers}
                onSelectedMembersChange={setSelectedMembers}
                onSplitDataChange={setSplitData}
              />
            </View>
          )}

          {loadingMembers && (
            <ActivityIndicator
              size="small"
              color="#6366F1"
              style={{ marginVertical: 16 }}
            />
          )}

          {/* Paid by info */}
          {selectedGroup && (
            <View style={styles.paidByInfo}>
              <Ionicons name="wallet-outline" size={18} color="#6366F1" />
              <Text style={styles.paidByText}>
                Paid by <Text style={{ fontWeight: "bold" }}>you</Text>
                {selectedMembers.length > 0 &&
                  `, split with ${selectedMembers.length} ${
                    selectedMembers.length === 1 ? "person" : "people"
                  }`}
                {splitData.method !== "equal" && ` (${splitData.method})`}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.addButton,
            (loading || !splitData.isValid) && styles.addButtonDisabled,
          ]}
          onPress={handleAddExpense}
          disabled={loading || !splitData.isValid}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="add-circle"
                size={22}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addButtonText}>Add Expense</Text>
              {parsedAmount > 0 &&
                selectedMembers.length > 0 &&
                splitData.method === "equal" && (
                  <Text style={styles.addButtonSub}>
                    {"  •  "}
                    {sym}
                    {(parsedAmount / selectedMembers.length).toFixed(2)}
                    /person
                  </Text>
                )}
            </View>
          )}
        </TouchableOpacity>

        {!splitData.isValid && (
          <View style={styles.footerWarning}>
            <Ionicons
              name="alert-circle"
              size={16}
              color="#EF4444"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.footerWarningTxt}>
              Split amounts don't add up — fix before adding
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollView: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1F2937" },
  form: { padding: 20 },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#6366F1",
    marginRight: 10,
  },
  amountInput: { flex: 1, fontSize: 48, fontWeight: "bold", color: "#1F2937" },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  groupChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  groupChipSelected: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  groupChipEmoji: { fontSize: 20, marginRight: 8 },
  groupChipText: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  groupChipTextSelected: { color: "white" },
  noGroupsText: { color: "#6B7280", fontSize: 14, fontStyle: "italic" },
  paidByInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  paidByText: {
    marginLeft: 10,
    color: "#4338CA",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  footer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  addButton: {
    backgroundColor: "#6366F1",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  addButtonSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "500",
  },
  footerWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    padding: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  footerWarningTxt: { fontSize: 12, color: "#991B1B", fontWeight: "600" },
});