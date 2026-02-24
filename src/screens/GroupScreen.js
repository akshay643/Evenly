// src/screens/GroupScreen.js
import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { haptic } from "../utils/haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase.config";
import { AuthContext } from "../context/AuthContext";
import * as Contacts from "expo-contacts";
import GroupChat from "../components/GroupChat";
// ═══ NEW: Import categories ═══
import {
  getExpenseIcon,
  detectCategory,
  getCategoryInfo,
  getCategoryColor,
  EXPENSE_CATEGORIES,
} from "../constants/categories";

export default function GroupScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberInput, setMemberInput] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [searchingMember, setSearchingMember] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMemberForRole, setSelectedMemberForRole] = useState(null);
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(null);
  // ═══ NEW: Category filter state ═══
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);

  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === "number") return new Date(ts);
    return new Date(ts);
  };

  useEffect(() => {
    let unsubExpenses;
    let unsubSettlements;
    let unsubConfirmedSettlements;
    let unsubMessages;

    const init = async () => {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (!groupDoc.exists()) {
        setLoading(false);
        return;
      }

      const groupData = { id: groupDoc.id, ...groupDoc.data() };
      setGroup(groupData);

      const members = await Promise.all(
        (groupData.members || []).map(async (mid) => {
          const d = await getDoc(doc(db, "users", mid));
          return d.exists()
            ? { id: mid, ...d.data() }
            : { id: mid, email: "Unknown" };
        })
      );
      setMembersData(members);

      const expQ = query(
        collection(db, "expenses"),
        where("groupId", "==", groupId)
      );
      unsubExpenses = onSnapshot(expQ, (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
        setExpenses(list);
      });

      const settleQ = query(
        collection(db, "settlements"),
        where("groupId", "==", groupId)
      );
      unsubConfirmedSettlements = onSnapshot(settleQ, (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setSettlements(list);
      });

      const reqQ = query(
        collection(db, "settlementRequests"),
        where("groupId", "==", groupId)
      );
      unsubSettlements = onSnapshot(reqQ, (snap) => {
        const reqs = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.status === "pending") reqs.push({ id: d.id, ...data });
        });
        setPendingSettlements(reqs);
      });

      const msgRef = collection(db, "groups", groupId, "messages");
      const msgQ = query(msgRef);
      unsubMessages = onSnapshot(msgQ, (snap) => {
        if (activeTab !== "chat") {
          let count = 0;
          snap.forEach((d) => {
            const data = d.data();
            if (data.senderId !== user.uid) {
              const msgTime = data.createdAt?.toDate?.() || new Date(0);
              if (!lastReadTimestamp || msgTime > lastReadTimestamp) {
                count++;
              }
            }
          });
          setUnreadCount(count);
        }
      });

      setLoading(false);
    };

    init();
    return () => {
      unsubExpenses?.();
      unsubSettlements?.();
      unsubConfirmedSettlements?.();
      unsubMessages?.();
    };
  }, [groupId]);

  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadCount(0);
      setLastReadTimestamp(new Date());
    }
  }, [activeTab]);

  useEffect(() => {
    calcBalances(expenses, settlements);
  }, [expenses, settlements]);

  const calcBalances = (expenseList, settlementList) => {
    const map = {};
    expenseList.forEach(
      ({ paidBy, amount, splitBetween, splitAmounts, splitMethod }) => {
        if (!paidBy || !splitBetween) return;
        map[paidBy] = (map[paidBy] || 0) + amount;
        if (splitAmounts && splitMethod && splitMethod !== "equal") {
          splitBetween.forEach((m) => {
            const personAmount = splitAmounts[m] || 0;
            map[m] = (map[m] || 0) - personAmount;
          });
        } else {
          const share = amount / splitBetween.length;
          splitBetween.forEach((m) => {
            map[m] = (map[m] || 0) - share;
          });
        }
      }
    );
    settlementList.forEach(({ from, to, amount }) => {
      if (from && to) {
        map[from] = (map[from] || 0) + amount;
        map[to] = (map[to] || 0) - amount;
      }
    });
    setBalances(map);
  };

  const canDeleteExpense = (expense) => {
    if (expense.paidBy === user.uid) return true;
    if (getMemberRole(user.uid) === "admin") return true;
    if (getMemberRole(user.uid) === "treasurer") return true;
    return false;
  };

  const handleDeleteExpense = (expense) => {
    if (!canDeleteExpense(expense)) {
      Alert.alert(
        "Not Allowed",
        "Only the person who added this expense or a group admin can delete it."
      );
      return;
    }
    const sym = getCurrencySymbol();
    Alert.alert(
      "Delete Expense",
      `Are you sure you want to delete "${expense.description}" (${sym}${expense.amount.toFixed(2)})?\n\nThis cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingExpense(true);
            try {
              await deleteDoc(doc(db, "expenses", expense.id));
              setShowExpenseModal(false);
              setSelectedExpense(null);
              Alert.alert(
                "Deleted",
                "Expense removed. Balances updated automatically."
              );
            } catch (e) {
              Alert.alert("Error", "Failed to delete expense: " + e.message);
            } finally {
              setDeletingExpense(false);
            }
          },
        },
      ]
    );
  };

  const handleQuickDeleteExpense = (expense) => {
    if (!canDeleteExpense(expense)) {
      Alert.alert(
        "Not Allowed",
        "Only the person who added this expense or a group admin can delete it."
      );
      return;
    }
    handleDeleteExpense(expense);
    haptic.warning();
  };

  const openExpenseDetail = (expense) => {
    setSelectedExpense(expense);
    setShowExpenseModal(true);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete Group",
      `Are you sure you want to delete "${group?.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const expSnap = await getDocs(
                query(
                  collection(db, "expenses"),
                  where("groupId", "==", groupId)
                )
              );
              const batch = writeBatch(db);
              expSnap.forEach((d) => batch.delete(d.ref));
              const settleSnap = await getDocs(
                query(
                  collection(db, "settlementRequests"),
                  where("groupId", "==", groupId)
                )
              );
              settleSnap.forEach((d) => batch.delete(d.ref));
              batch.delete(doc(db, "groups", groupId));
              await batch.commit();
              Alert.alert("Deleted", "Group has been deleted.");
              navigation.goBack();
            } catch (e) {
              Alert.alert("Error", "Failed to delete group: " + e.message);
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    const myBalance = balances[user.uid] || 0;
    const hasUnsettled = Math.abs(myBalance) > 0.01;

    const warningMessage = hasUnsettled
      ? `⚠️ You have an unsettled balance of ${currencySymbol}${Math.abs(myBalance).toFixed(2)}.\n\nLeaving won't clear your debts. Please settle up first.\n\nAre you sure you want to leave "${group?.name}"?`
      : `Are you sure you want to leave "${group?.name}"?\n\nYou won't be able to see expenses or balances anymore.`;

    Alert.alert("Leave Group", warningMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: hasUnsettled ? "Leave Anyway" : "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            const ref = doc(db, "groups", groupId);
            await updateDoc(ref, { members: arrayRemove(user.uid) });

            const groupSnap = await getDoc(ref);
            if (groupSnap.exists()) {
              const groupData = groupSnap.data();
              if (groupData.roles && groupData.roles[user.uid]) {
                const updatedRoles = { ...groupData.roles };
                delete updatedRoles[user.uid];
                await updateDoc(ref, { roles: updatedRoles });
              }
            }

            Alert.alert("Left Group", `You have left "${group?.name}".`, [
              { text: "OK", onPress: () => navigation.goBack() },
            ]);
          } catch (e) {
            Alert.alert("Error", "Failed to leave group: " + e.message);
          }
        },
      },
    ]);
  };

  const ROLES = [
    { key: "admin", label: "Admin", icon: "shield", color: "#8B5CF6", desc: "Full control" },
    { key: "treasurer", label: "Treasurer", icon: "cash", color: "#10B981", desc: "Can settle up and manage expenses" },
    { key: "member", label: "Member", icon: "person", color: "#6366F1", desc: "Can add expenses and view balances" },
    { key: "viewer", label: "Viewer", icon: "eye", color: "#F59E0B", desc: "Read-only" },
  ];

  const getMemberRole = (uid) => {
    if (group?.createdBy === uid) return "admin";
    return group?.roles?.[uid] || "member";
  };
  const canManageRoles = () => getMemberRole(user.uid) === "admin";

  const handleSetRole = async (uid, role) => {
    try {
      await updateDoc(doc(db, "groups", groupId), { [`roles.${uid}`]: role });
      const updated = await getDoc(doc(db, "groups", groupId));
      setGroup({ id: updated.id, ...updated.data() });
      setShowRoleModal(false);
      setSelectedMemberForRole(null);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handlePickFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Allow contacts access in Settings.");
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });
    const suggestions = [];
    data.forEach((c) => {
      (c.phoneNumbers || []).forEach((p) => {
        suggestions.push({ name: c.name, value: p.number.replace(/\s|-|\(|\)/g, ""), type: "phone" });
      });
      (c.emails || []).forEach((e) => {
        suggestions.push({ name: c.name, value: e.email.toLowerCase(), type: "email" });
      });
    });
    setContactSuggestions(suggestions.slice(0, 50));
  };

  const handleSearchMember = async () => {
    const input = memberInput.trim().toLowerCase();
    if (!input) {
      Alert.alert("Error", "Enter an email or phone number");
      return;
    }
    setFoundUser(null);
    setSearchingMember(true);
    try {
      const field = input.includes("@") ? "email" : "phone";
      const snap = await getDocs(
        query(collection(db, "users"), where(field, "==", input))
      );
      if (snap.empty) {
        Alert.alert("Not Found", `No account found with that ${field}.`);
        setSearchingMember(false);
        return;
      }
      setFoundUser({ id: snap.docs[0].id, ...snap.docs[0].data() });
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSearchingMember(false);
    }
  };

  const handleConfirmAddMember = async () => {
    if (!foundUser) return;
    if (group.members.includes(foundUser.id)) {
      Alert.alert("Already a member");
      setFoundUser(null);
      return;
    }
    setAddingMember(true);
    try {
      const ref = doc(db, "groups", groupId);
      await updateDoc(ref, { members: arrayUnion(foundUser.id) });
      const updated = await getDoc(ref);
      const g = { id: updated.id, ...updated.data() };
      setGroup(g);
      const mems = await Promise.all(
        g.members.map(async (mid) => {
          const d = await getDoc(doc(db, "users", mid));
          return d.exists() ? { id: mid, ...d.data() } : { id: mid, email: "Unknown" };
        })
      );
      setMembersData(mems);
      Alert.alert("Done", `${foundUser.name || foundUser.email} added!`);
      setShowAddMemberModal(false);
      setMemberInput("");
      setFoundUser(null);
      setContactSuggestions([]);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setAddingMember(false);
    }
  };

  const getMemberName = (uid) => {
    const m = membersData.find((x) => x.id === uid);
    return m?.name || m?.email || "Unknown";
  };

  const getCurrencySymbol = () => {
    const map = { USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", AUD: "A$", CAD: "C$" };
    return map[group?.currency] || "₹";
  };

  const getUserBreakdown = () => {
    if (!expenses || !settlements || !user) {
      return { totalPaid: 0, totalShare: 0, settledTo: {}, totalSettled: 0 };
    }
    let totalPaid = 0;
    let totalShare = 0;
    const settledTo = {};

    expenses.forEach(({ paidBy, amount, splitBetween, splitAmounts, splitMethod }) => {
      if (!paidBy || !amount) return;
      if (paidBy === user.uid) totalPaid += amount;
      if (splitBetween?.includes(user.uid)) {
        if (splitAmounts && splitMethod && splitMethod !== "equal") {
          totalShare += splitAmounts[user.uid] || 0;
        } else {
          totalShare += amount / splitBetween.length;
        }
      }
    });

    settlements.forEach(({ from, to, amount }) => {
      if (!from || !to || !amount) return;
      if (from === user.uid) {
        settledTo[to] = (settledTo[to] || 0) + amount;
      }
    });

    const totalSettled = Object.values(settledTo).reduce((s, a) => s + a, 0);
    return { totalPaid, totalShare, settledTo, totalSettled };
  };

  // ═══ NEW: Category spending breakdown ═══
  const getCategoryBreakdown = () => {
    const catMap = {};
    expenses.forEach((exp) => {
      const cat = exp.category || detectCategory(exp.description);
      catMap[cat] = (catMap[cat] || 0) + exp.amount;
    });
    return Object.entries(catMap)
      .map(([key, total]) => ({
        key,
        total,
        ...getCategoryInfo(key),
        color: getCategoryColor(key),
      }))
      .sort((a, b) => b.total - a.total);
  };

  // ═══ NEW: Filter expenses by category ═══
  const getFilteredExpenses = () => {
    if (!selectedCategoryFilter) return expenses;
    return expenses.filter((exp) => {
      const cat = exp.category || detectCategory(exp.description);
      return cat === selectedCategoryFilter;
    });
  };

  const myRequests = pendingSettlements.filter((r) => r.to === user.uid);
  const totalExpensesAmt = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const userBalance = balances[user.uid] || 0;
  const breakdown = getUserBreakdown();
  const currencySymbol = getCurrencySymbol();
  const categoryBreakdown = getCategoryBreakdown();
  const filteredExpenses = getFilteredExpenses();

  if (loading)
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  if (!group)
    return (
      <View style={st.center}>
        <Text>Group not found</Text>
      </View>
    );

  const isCreator = group.createdBy === user.uid;

  return (
    <SafeAreaView style={st.root}>
      {/* ─── Header ─── */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={st.headerTitle} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {isCreator && (
            <TouchableOpacity onPress={handleDeleteGroup} style={st.headerBtn}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          )}
          {!isCreator && (
            <TouchableOpacity onPress={handleLeaveGroup} style={st.headerBtn}>
              <Ionicons name="exit-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowAddMemberModal(true)} style={st.headerBtn}>
            <Ionicons name="person-add" size={22} color="#6366F1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ TAB SWITCHER ═══ */}
      <View style={st.tabBar}>
        <TouchableOpacity
          style={[st.tab, activeTab === "expenses" && st.tabActive]}
          onPress={() => setActiveTab("expenses")}
        >
          <Ionicons
            name="receipt-outline"
            size={18}
            color={activeTab === "expenses" ? "#6366F1" : "#9CA3AF"}
            style={{ marginRight: 6 }}
          />
          <Text style={[st.tabText, activeTab === "expenses" && st.tabTextActive]}>
            Expenses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.tab, activeTab === "chat" && st.tabActive]}
          onPress={() => setActiveTab("chat")}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={activeTab === "chat" ? "#6366F1" : "#9CA3AF"}
            style={{ marginRight: 6 }}
          />
          <Text style={[st.tabText, activeTab === "chat" && st.tabTextActive]}>
            Chat
          </Text>
          {unreadCount > 0 && activeTab !== "chat" && (
            <View style={st.unreadBadge}>
              <Text style={st.unreadBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ═══ TAB CONTENT ═══ */}
      {activeTab === "chat" ? (
        <GroupChat groupId={groupId} membersData={membersData} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          {myRequests.length > 0 && (
            <TouchableOpacity
              style={st.banner}
              onPress={() => navigation.navigate("SettleUp", { groupId })}
            >
              <Ionicons name="notifications" size={20} color="#92400E" style={{ marginRight: 8 }} />
              <Text style={st.bannerText}>
                {myRequests.length} settlement request{myRequests.length > 1 ? "s" : ""} waiting
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#92400E" />
            </TouchableOpacity>
          )}

          <View style={st.summary}>
            <Text style={{ fontSize: 56 }}>{group.icon || "👥"}</Text>
            <Text style={st.summaryMembers}>
              {group.members.length} members • {expenses.length} expenses
            </Text>
            <Text style={st.summaryTotal}>
              Total spent: {currencySymbol}
              {totalExpensesAmt.toFixed(2)}
            </Text>
          </View>

          <View style={st.balanceCard}>
            <View style={st.balanceHeader}>
              <Text style={st.balanceLabel}>Your Summary</Text>
              <Text
                style={[
                  st.balanceAmt,
                  userBalance > 0.01 ? st.green : userBalance < -0.01 ? st.red : st.gray,
                ]}
              >
                {userBalance > 0.01
                  ? `+${currencySymbol}${userBalance.toFixed(2)}`
                  : userBalance < -0.01
                    ? `-${currencySymbol}${Math.abs(userBalance).toFixed(2)}`
                    : "Settled up ✓"}
              </Text>
              <Text style={st.balanceSub}>
                {userBalance > 0.01
                  ? "Others owe you"
                  : userBalance < -0.01
                    ? "You owe others"
                    : "All settled!"}
              </Text>
            </View>
            <View style={st.breakdownContainer}>
              <View style={st.breakdownDivider} />
              <View style={st.breakdownRow}>
                <Text style={st.breakdownLabel}>💰 You paid</Text>
                <Text style={st.breakdownValue}>
                  {currencySymbol}{breakdown.totalPaid.toFixed(2)}
                </Text>
              </View>
              <View style={st.breakdownRow}>
                <Text style={st.breakdownLabel}>📊 Your share</Text>
                <Text style={st.breakdownValue}>
                  {currencySymbol}{breakdown.totalShare.toFixed(2)}
                </Text>
              </View>
              {breakdown.totalSettled > 0 && (
                <View style={st.breakdownRow}>
                  <Text style={st.breakdownLabel}>✅ Settled</Text>
                  <Text style={[st.breakdownValue, st.green]}>
                    {currencySymbol}{breakdown.totalSettled.toFixed(2)}
                  </Text>
                </View>
              )}
              {Object.keys(breakdown.settledTo).length > 0 && (
                <View style={st.settledList}>
                  {Object.entries(breakdown.settledTo).map(([toId, amt]) => (
                    <Text key={toId} style={st.settledItem}>
                      • Paid {currencySymbol}{amt.toFixed(2)} to {getMemberName(toId)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* ═══════════════════════════════════════
              NEW: CATEGORY SPENDING BREAKDOWN
              ═══════════════════════════════════════ */}
          {categoryBreakdown.length > 0 && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Spending by Category</Text>
              <View style={st.categoryCard}>
                {categoryBreakdown.map((cat) => {
                  const percentage = totalExpensesAmt > 0
                    ? ((cat.total / totalExpensesAmt) * 100).toFixed(0)
                    : 0;
                  const isFilterActive = selectedCategoryFilter === cat.key;

                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        st.categoryRow,
                        isFilterActive && { backgroundColor: cat.color + '15', borderRadius: 10 },
                      ]}
                      onPress={() => {
                        setSelectedCategoryFilter(
                          isFilterActive ? null : cat.key
                        );
                        haptic.light();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={st.categoryLeft}>
                        <View style={[st.categoryIconBg, { backgroundColor: cat.color + '20' }]}>
                          <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={st.categoryName}>{cat.label}</Text>
                            {isFilterActive && (
                              <View style={[st.filterActiveBadge, { backgroundColor: cat.color }]}>
                                <Text style={st.filterActiveBadgeText}>Filtered</Text>
                              </View>
                            )}
                          </View>
                          {/* Progress bar */}
                          <View style={st.categoryBarBg}>
                            <View
                              style={[
                                st.categoryBarFill,
                                {
                                  width: `${percentage}%`,
                                  backgroundColor: cat.color,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[st.categoryAmount, { color: cat.color }]}>
                          {currencySymbol}{cat.total.toFixed(0)}
                        </Text>
                        <Text style={st.categoryPercent}>{percentage}%</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Clear filter button */}
                {selectedCategoryFilter && (
                  <TouchableOpacity
                    style={st.clearFilterBtn}
                    onPress={() => {
                      setSelectedCategoryFilter(null);
                      haptic.light();
                    }}
                  >
                    <Ionicons name="close-circle" size={16} color="#6366F1" style={{ marginRight: 6 }} />
                    <Text style={st.clearFilterText}>
                      Show all expenses ({expenses.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={st.actions}>
            <TouchableOpacity
              style={st.btnPrimary}
              onPress={() =>
                navigation.navigate("AddExpense", { groupId, groupName: group.name })
              }
            >
              <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={st.btnPrimaryTxt}>Add Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.btnOutline}
              onPress={() => navigation.navigate("SettleUp", { groupId })}
            >
              <Ionicons name="wallet" size={20} color="#6366F1" style={{ marginRight: 6 }} />
              <Text style={st.btnOutlineTxt}>Settle Up</Text>
            </TouchableOpacity>
          </View>

          <View style={st.section}>
            <Text style={st.sectionTitle}>Members ({membersData.length})</Text>
            {membersData.map((m) => {
              const role = getMemberRole(m.id);
              const roleInfo = ROLES.find((r) => r.key === role) || ROLES[2];
              return (
                <View key={m.id} style={st.memberRow}>
                  <View style={st.avatar}>
                    <Text style={st.avatarTxt}>
                      {(m.name || m.email || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.memberName}>{m.name || "User"}</Text>
                    <Text style={st.memberEmail}>{m.email}</Text>
                  </View>
                  <View
                    style={[
                      st.roleBadge,
                      { backgroundColor: roleInfo.color + "20", borderColor: roleInfo.color },
                    ]}
                  >
                    <Ionicons name={roleInfo.icon} size={12} color={roleInfo.color} style={{ marginRight: 3 }} />
                    <Text style={[st.roleBadgeTxt, { color: roleInfo.color }]}>
                      {roleInfo.label}
                    </Text>
                  </View>
                  {m.id === user.uid && (
                    <View style={[st.youBadge, { marginLeft: 6 }]}>
                      <Text style={st.youBadgeTxt}>You</Text>
                    </View>
                  )}
                  {canManageRoles() && m.id !== user.uid && (
                    <TouchableOpacity
                      style={st.roleEditBtn}
                      onPress={() => {
                        setSelectedMemberForRole(m);
                        setShowRoleModal(true);
                      }}
                    >
                      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* ═══ EXPENSES LIST (now with category icons + filter) ═══ */}
          <View style={st.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={st.sectionTitle}>
                {selectedCategoryFilter
                  ? `${getCategoryInfo(selectedCategoryFilter).icon} ${getCategoryInfo(selectedCategoryFilter).label}`
                  : 'Expenses'}{' '}
                ({filteredExpenses.length})
              </Text>
              {selectedCategoryFilter && (
                <TouchableOpacity onPress={() => setSelectedCategoryFilter(null)}>
                  <Text style={{ color: '#6366F1', fontSize: 13, fontWeight: '600' }}>Show All</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredExpenses.length === 0 ? (
              <View style={st.empty}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>
                  {selectedCategoryFilter ? getCategoryInfo(selectedCategoryFilter).icon : '💸'}
                </Text>
                <Text style={st.emptyTitle}>
                  {selectedCategoryFilter ? 'No expenses in this category' : 'No expenses yet'}
                </Text>
                <Text style={st.emptyBody}>
                  {selectedCategoryFilter
                    ? 'Try selecting a different category'
                    : 'Tap "Add Expense" to get started'}
                </Text>
              </View>
            ) : (
              filteredExpenses.map((exp) => {
                let myShare = 0;
                if (exp.splitBetween?.includes(user.uid)) {
                  if (exp.splitAmounts && exp.splitMethod && exp.splitMethod !== "equal") {
                    myShare = exp.splitAmounts[user.uid] || 0;
                  } else {
                    myShare = exp.amount / (exp.splitBetween?.length || 1);
                  }
                }
                const isPayer = exp.paidBy === user.uid;
                const isInvolved = exp.splitBetween?.includes(user.uid);
                const d = toDate(exp.createdAt);
                const dateStr = d.getTime() > 0
                  ? d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                  : "";
                const showDelete = canDeleteExpense(exp);
                const splitCount = exp.splitBetween?.length || 0;
                const totalMembers = group.members?.length || 0;
                const methodLabel = { equal: "", exact: "(exact)", percentage: "(%)", shares: "(shares)" }[exp.splitMethod] || "";

                // ═══ NEW: Get category icon and color ═══
                const expCatKey = exp.category || detectCategory(exp.description);
                const expCatIcon = getExpenseIcon(exp.description, exp.category);
                const expCatColor = getCategoryColor(expCatKey);
                const expCatInfo = getCategoryInfo(expCatKey);

                return (
                  <TouchableOpacity
                    key={exp.id}
                    style={st.expCard}
                    onPress={() => openExpenseDetail(exp)}
                    activeOpacity={0.7}
                  >
                    <View style={st.expLeft}>
                      {/* ═══ NEW: Category-colored icon ═══ */}
                      <View style={[st.expIcon, { backgroundColor: expCatColor + '15' }]}>
                        <Text style={{ fontSize: 18 }}>{expCatIcon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.expDesc}>{exp.description}</Text>
                        <Text style={st.expMeta}>
                          Paid by{" "}
                          {isPayer ? "you" : exp.paidByEmail || getMemberName(exp.paidBy)}
                          {dateStr ? `  •  ${dateStr}` : ""}
                        </Text>
                        {/* ═══ NEW: Category tag ═══ */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                          <View style={[st.expCategoryTag, { backgroundColor: expCatColor + '15' }]}>
                            <Text style={[st.expCategoryTagText, { color: expCatColor }]}>
                              {expCatInfo.label}
                            </Text>
                          </View>
                          {splitCount > 0 && splitCount < totalMembers && (
                            <Text style={[st.expSplitInfo, { marginTop: 0, marginLeft: 6 }]}>
                              {splitCount}/{totalMembers} {methodLabel}
                            </Text>
                          )}
                          {exp.splitMethod && exp.splitMethod !== "equal" && splitCount === totalMembers && (
                            <Text style={[st.expSplitInfo, { marginTop: 0, marginLeft: 6 }]}>
                              Unequal {methodLabel}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={st.expAmt}>
                        {currencySymbol}{exp.amount.toFixed(2)}
                      </Text>
                      {isPayer && <Text style={[st.expTag, st.green]}>You paid</Text>}
                      {!isPayer && isInvolved && (
                        <Text style={[st.expTag, st.red]}>
                          You owe {currencySymbol}{myShare.toFixed(2)}
                        </Text>
                      )}
                      {!isPayer && !isInvolved && (
                        <Text style={[st.expTag, st.gray]}>Not involved</Text>
                      )}
                    </View>
                    {showDelete && (
                      <TouchableOpacity
                        style={st.expDeleteBtn}
                        onPress={() => handleQuickDeleteExpense(exp)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* ═══ Expense Detail Modal (updated with category) ═══ */}
      <Modal
        visible={showExpenseModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowExpenseModal(false); setSelectedExpense(null); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => { setShowExpenseModal(false); setSelectedExpense(null); }}
          />
          {selectedExpense && (() => {
            const modalCatKey = selectedExpense.category || detectCategory(selectedExpense.description);
            const modalCatIcon = getExpenseIcon(selectedExpense.description, selectedExpense.category);
            const modalCatColor = getCategoryColor(modalCatKey);
            const modalCatInfo = getCategoryInfo(modalCatKey);

            return (
              <View style={st.expModalSheet}>
                <View style={st.expModalHead}>
                  <Text style={st.expModalTitle}>Expense Details</Text>
                  <TouchableOpacity onPress={() => { setShowExpenseModal(false); setSelectedExpense(null); }}>
                    <Ionicons name="close" size={26} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={st.expModalInfoCard}>
                    <View style={st.expModalIconRow}>
                      {/* ═══ NEW: Category icon in modal ═══ */}
                      <View style={[st.expModalBigIcon, { backgroundColor: modalCatColor + '15' }]}>
                        <Text style={{ fontSize: 28 }}>{modalCatIcon}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={st.expModalDesc}>{selectedExpense.description}</Text>
                        <Text style={st.expModalAmount}>
                          {currencySymbol}{selectedExpense.amount.toFixed(2)}
                        </Text>
                        {/* ═══ NEW: Category badge in modal ═══ */}
                        <View style={[st.modalCategoryBadge, { backgroundColor: modalCatColor + '15' }]}>
                          <Text style={{ fontSize: 12 }}>{modalCatIcon}</Text>
                          <Text style={[st.modalCategoryText, { color: modalCatColor }]}>
                            {modalCatInfo.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={st.expModalDivider} />
                    <View style={st.expModalDetailRow}>
                      <Ionicons name="wallet-outline" size={18} color="#6366F1" />
                      <Text style={st.expModalDetailLabel}>Paid by</Text>
                      <Text style={st.expModalDetailValue}>
                        {selectedExpense.paidBy === user.uid ? "You" : getMemberName(selectedExpense.paidBy)}
                      </Text>
                    </View>
                    <View style={st.expModalDetailRow}>
                      <Ionicons name="calendar-outline" size={18} color="#6366F1" />
                      <Text style={st.expModalDetailLabel}>Date</Text>
                      <Text style={st.expModalDetailValue}>
                        {toDate(selectedExpense.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                      </Text>
                    </View>
                    {/* ═══ NEW: Category row in modal ═══ */}
                    <View style={st.expModalDetailRow}>
                      <Text style={{ fontSize: 18 }}>{modalCatIcon}</Text>
                      <Text style={st.expModalDetailLabel}>Category</Text>
                      <Text style={[st.expModalDetailValue, { color: modalCatColor }]}>
                        {modalCatInfo.label}
                      </Text>
                    </View>
                    <View style={st.expModalDetailRow}>
                      <Ionicons name="people-outline" size={18} color="#6366F1" />
                      <Text style={st.expModalDetailLabel}>Split between</Text>
                      <Text style={st.expModalDetailValue}>
                        {selectedExpense.splitBetween?.length || 0} people
                      </Text>
                    </View>
                    <View style={st.expModalDetailRow}>
                      <Ionicons name="calculator-outline" size={18} color="#6366F1" />
                      <Text style={st.expModalDetailLabel}>Per person</Text>
                      <Text style={st.expModalDetailValue}>
                        {currencySymbol}{(selectedExpense.amount / (selectedExpense.splitBetween?.length || 1)).toFixed(2)}
                      </Text>
                    </View>
                    <View style={st.expModalDivider} />
                    <Text style={st.expModalSplitTitle}>Split Members</Text>
                    {(selectedExpense.splitBetween || []).map((uid) => {
                      const pp = selectedExpense.amount / (selectedExpense.splitBetween?.length || 1);
                      return (
                        <View key={uid} style={st.expModalMemberRow}>
                          <View style={[st.expModalMemberAvatar, uid === user.uid && { backgroundColor: "#6366F1" }]}>
                            <Text style={st.expModalMemberAvatarTxt}>{getMemberName(uid)[0].toUpperCase()}</Text>
                          </View>
                          <Text style={st.expModalMemberName}>{uid === user.uid ? "You" : getMemberName(uid)}</Text>
                          <Text style={st.expModalMemberShare}>{currencySymbol}{pp.toFixed(2)}</Text>
                        </View>
                      );
                    })}
                  </View>
                  {canDeleteExpense(selectedExpense) && (
                    <TouchableOpacity
                      style={st.expEditFullBtn}
                      onPress={() => {
                        setShowExpenseModal(false);
                        setSelectedExpense(null);
                        navigation.navigate("EditExpense", { expense: selectedExpense, groupId, membersData });
                      }}
                    >
                      <Ionicons name="create-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={st.expEditFullBtnTxt}>Edit Expense</Text>
                    </TouchableOpacity>
                  )}
                  {canDeleteExpense(selectedExpense) ? (
                    <TouchableOpacity
                      style={st.expDeleteFullBtn}
                      onPress={() => handleDeleteExpense(selectedExpense)}
                      disabled={deletingExpense}
                    >
                      {deletingExpense ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="trash" size={20} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={st.expDeleteFullBtnTxt}>Delete Expense</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={st.expNoDeleteInfo}>
                      <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                      <Text style={st.expNoDeleteTxt}>Only the creator or admin can delete this</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            );
          })()}
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Add Member Modal ═══ */}
      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddMemberModal(false); setFoundUser(null); setContactSuggestions([]); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setShowAddMemberModal(false); setFoundUser(null); setContactSuggestions([]); }} />
          <View style={st.modalSheet}>
            <View style={st.modalHead}>
              <Text style={st.modalTitle}>Add Member</Text>
              <TouchableOpacity onPress={() => { setShowAddMemberModal(false); setFoundUser(null); setContactSuggestions([]); }}>
                <Ionicons name="close" size={26} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={st.searchRow}>
              <TextInput
                style={[st.modalInput, { flex: 1, marginBottom: 0 }]}
                placeholder="Email or phone number"
                value={memberInput}
                onChangeText={(t) => { setMemberInput(t); setFoundUser(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={handleSearchMember}
              />
              <TouchableOpacity style={st.searchBtn} onPress={handleSearchMember} disabled={searchingMember}>
                {searchingMember ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={st.contactsBtn} onPress={handlePickFromContacts}>
              <Ionicons name="people" size={18} color="#6366F1" style={{ marginRight: 8 }} />
              <Text style={st.contactsBtnTxt}>Search from Contacts</Text>
            </TouchableOpacity>
            {contactSuggestions.length > 0 && !foundUser && (
              <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                {contactSuggestions.map((c, i) => (
                  <TouchableOpacity key={i} style={st.suggRow} onPress={() => { setMemberInput(c.value); setContactSuggestions([]); }}>
                    <View style={st.suggAvatar}>
                      <Text style={st.suggAvatarTxt}>{(c.name || "?")[0].toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, color: "#1F2937", fontWeight: "600" }}>{c.name}</Text>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>{c.value}</Text>
                    </View>
                    <Ionicons name="arrow-forward-outline" size={16} color="#9CA3AF" style={{ marginLeft: "auto" }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {foundUser && (
              <View style={st.previewCard}>
                <View style={st.previewHead}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={st.previewHeadTxt}>User found — verify before adding</Text>
                </View>
                <View style={st.previewBody}>
                  <View style={st.previewAvatar}>
                    <Text style={st.previewAvatarTxt}>{(foundUser.name || foundUser.email || "?")[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={st.previewName}>{foundUser.name || "No name"}</Text>
                    <Text style={st.previewEmail}>{foundUser.email}</Text>
                  </View>
                </View>
                <View style={st.previewActions}>
                  <TouchableOpacity
                    style={[st.modalBtn, { flex: 1, flexDirection: "row", marginBottom: 0 }]}
                    onPress={handleConfirmAddMember}
                    disabled={addingMember}
                  >
                    {addingMember ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="person-add" size={18} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={st.modalBtnTxt}>Add to Group</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={st.previewReject} onPress={() => { setFoundUser(null); setMemberInput(""); }}>
                    <Ionicons name="close" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {!foundUser && (
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 10, textAlign: "center" }}>
                Enter their email or phone, tap 🔍, verify, then confirm.
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Role Modal ═══ */}
      <Modal visible={showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
        <View style={st.roleOverlay}>
          <View style={st.roleSheet}>
            <View style={st.modalHead}>
              <View>
                <Text style={st.modalTitle}>Assign Role</Text>
                {selectedMemberForRole && (
                  <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    {selectedMemberForRole.name || selectedMemberForRole.email}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                <Ionicons name="close" size={26} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {ROLES.map((r) => {
              const current = selectedMemberForRole ? getMemberRole(selectedMemberForRole.id) : null;
              const isActive = current === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[st.roleOption, isActive && { borderColor: r.color, backgroundColor: r.color + "10" }]}
                  onPress={() => handleSetRole(selectedMemberForRole.id, r.key)}
                >
                  <View style={[st.roleOptionIcon, { backgroundColor: r.color + "20" }]}>
                    <Ionicons name={r.icon} size={20} color={r.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[st.roleOptionLabel, isActive && { color: r.color }]}>{r.label}</Text>
                    <Text style={st.roleOptionDesc}>{r.desc}</Text>
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={22} color={r.color} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ───────── Styles ───────── */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 0, borderBottomColor: "#E5E7EB" },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold", color: "#1F2937" },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#6366F1" },
  tabText: { fontSize: 15, fontWeight: "600", color: "#9CA3AF" },
  tabTextActive: { color: "#6366F1" },
  unreadBadge: { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 6, marginLeft: 6 },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  banner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", margin: 16, marginBottom: 0, padding: 14, borderRadius: 12 },
  bannerText: { flex: 1, fontSize: 14, color: "#92400E", fontWeight: "500" },
  summary: { alignItems: "center", paddingVertical: 16 },
  summaryMembers: { fontSize: 14, color: "#6B7280", marginTop: 6 },
  summaryTotal: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
  balanceCard: { backgroundColor: "#fff", marginHorizontal: 20, padding: 24, borderRadius: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  balanceHeader: { alignItems: "center", width: "100%" },
  balanceLabel: { fontSize: 13, color: "#6B7280", marginBottom: 6 },
  balanceAmt: { fontSize: 34, fontWeight: "bold" },
  balanceSub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  breakdownContainer: { width: "100%" },
  breakdownDivider: { width: "100%", height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8 },
  breakdownLabel: { fontSize: 14, color: "#6B7280" },
  breakdownValue: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  settledList: { width: "100%", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  settledItem: { fontSize: 12, color: "#6B7280", marginVertical: 2 },
  green: { color: "#10B981" },
  red: { color: "#EF4444" },
  gray: { color: "#6B7280" },

  // ═══ NEW: Category styles ═══
  categoryCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  categoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 6 },
  categoryLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 10 },
  categoryIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  categoryName: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  categoryBarBg: { height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, marginTop: 6, width: "100%" },
  categoryBarFill: { height: 4, borderRadius: 2 },
  categoryAmount: { fontSize: 15, fontWeight: "700" },
  categoryPercent: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  filterActiveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  filterActiveBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  clearFilterBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  clearFilterText: { color: "#6366F1", fontSize: 13, fontWeight: "600" },
  expCategoryTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  expCategoryTagText: { fontSize: 10, fontWeight: "700" },
  modalCategoryBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: "flex-start" },
  modalCategoryText: { fontSize: 12, fontWeight: "600", marginLeft: 4 },

  actions: { flexDirection: "row", paddingHorizontal: 20, marginTop: 18, marginBottom: 10 },
  btnPrimary: { flex: 1, flexDirection: "row", backgroundColor: "#6366F1", padding: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 5 },
  btnPrimaryTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },
  btnOutline: { flex: 1, flexDirection: "row", backgroundColor: "#fff", padding: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#6366F1", marginLeft: 5 },
  btnOutlineTxt: { color: "#6366F1", fontSize: 15, fontWeight: "600" },
  section: { paddingHorizontal: 20, paddingTop: 18 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", color: "#1F2937", marginBottom: 12 },
  memberRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 10, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#6366F1", justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  memberName: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  memberEmail: { fontSize: 12, color: "#6B7280" },
  youBadge: { backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  youBadgeTxt: { fontSize: 11, color: "#1E40AF", fontWeight: "700" },
  expCard: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1, position: "relative" },
  expLeft: { flexDirection: "row", flex: 1, alignItems: "center", marginRight: 10 },
  expIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: 10 },
  expDesc: { fontSize: 15, fontWeight: "600", color: "#1F2937", marginBottom: 2 },
  expMeta: { fontSize: 12, color: "#9CA3AF" },
  expAmt: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  expTag: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  expSplitInfo: { fontSize: 11, color: "#8B5CF6", marginTop: 2, fontWeight: "500" },
  expDeleteBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", zIndex: 10 },
  expEditFullBtn: { flexDirection: "row", backgroundColor: "#6366F1", padding: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 16 },
  expEditFullBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  expModalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: "80%" },
  expModalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  expModalTitle: { fontSize: 22, fontWeight: "bold", color: "#1F2937" },
  expModalInfoCard: { backgroundColor: "#F9FAFB", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: "#E5E7EB" },
  expModalIconRow: { flexDirection: "row", alignItems: "center" },
  expModalBigIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  expModalDesc: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 4 },
  expModalAmount: { fontSize: 28, fontWeight: "bold", color: "#6366F1" },
  expModalDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 14 },
  expModalDetailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  expModalDetailLabel: { fontSize: 14, color: "#6B7280", marginLeft: 10, flex: 1 },
  expModalDetailValue: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  expModalSplitTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", marginBottom: 10 },
  expModalMemberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  expModalMemberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center", marginRight: 10 },
  expModalMemberAvatarTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  expModalMemberName: { flex: 1, fontSize: 14, color: "#1F2937", fontWeight: "500" },
  expModalMemberShare: { fontSize: 14, fontWeight: "600", color: "#6366F1" },
  expDeleteFullBtn: { flexDirection: "row", backgroundColor: "#EF4444", padding: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 16 },
  expDeleteFullBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  expNoDeleteInfo: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 14, padding: 12, backgroundColor: "#F3F4F6", borderRadius: 10 },
  expNoDeleteTxt: { fontSize: 13, color: "#9CA3AF" },
  empty: { alignItems: "center", paddingVertical: 36 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#1F2937", marginBottom: 4 },
  emptyBody: { fontSize: 14, color: "#6B7280" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#1F2937" },
  modalInput: { backgroundColor: "#F3F4F6", padding: 14, borderRadius: 10, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  modalBtn: { backgroundColor: "#6366F1", padding: 16, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  modalBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "600" },
  searchRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  searchBtn: { backgroundColor: "#6366F1", padding: 14, borderRadius: 10, marginLeft: 8 },
  contactsBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#EEF2FF", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#C7D2FE" },
  contactsBtnTxt: { color: "#6366F1", fontWeight: "600", fontSize: 14 },
  suggRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  suggAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#6366F1", justifyContent: "center", alignItems: "center", marginRight: 10 },
  suggAvatarTxt: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  previewCard: { backgroundColor: "#F0FDF4", borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1.5, borderColor: "#10B981" },
  previewHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  previewHeadTxt: { fontSize: 13, fontWeight: "700", color: "#065F46" },
  previewBody: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  previewAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#6366F1", justifyContent: "center", alignItems: "center" },
  previewAvatarTxt: { color: "#fff", fontWeight: "bold", fontSize: 20 },
  previewName: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  previewEmail: { fontSize: 13, color: "#6B7280" },
  previewActions: { flexDirection: "row", alignItems: "center" },
  previewReject: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginLeft: 10 },
  roleBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginLeft: 6 },
  roleBadgeTxt: { fontSize: 11, fontWeight: "700" },
  roleEditBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  roleOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 20 },
  roleSheet: { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  roleOption: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", marginBottom: 10 },
  roleOptionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  roleOptionLabel: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  roleOptionDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});