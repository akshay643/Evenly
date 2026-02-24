// src/screens/RecurringExpenseScreen.js
import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase.config";

export default function RecurringExpenseScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { user } = useContext(AuthContext);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [recurringList, setRecurringList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState(null);

  const FREQUENCIES = [
    { key: "daily", label: "Daily", icon: "today", color: "#EF4444" },
    {
      key: "weekly",
      label: "Weekly",
      icon: "calendar-outline",
      color: "#F59E0B",
    },
    { key: "monthly", label: "Monthly", icon: "calendar", color: "#6366F1" },
    { key: "yearly", label: "Yearly", icon: "globe-outline", color: "#10B981" },
  ];

  useEffect(() => {
    // Fetch group
    const fetchGroup = async () => {
      const gDoc = await getDocs(
        query(collection(db, "groups"), where("__name__", "==", groupId)),
      );
      // ... simplified
    };

    // Listen to recurring expenses
    const q = query(
      collection(db, "recurringExpenses"),
      where("groupId", "==", groupId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setRecurringList(list);
      setLoading(false);
    });

    return () => unsub();
  }, [groupId]);

  const handleAdd = async () => {
    if (!description.trim() || !amount) {
      Alert.alert("Error", "Fill in all fields");
      return;
    }
    setAdding(true);
    try {
      await addDoc(collection(db, "recurringExpenses"), {
        groupId,
        description: description.trim(),
        amount: parseFloat(amount),
        frequency,
        createdBy: user.uid,
        active: true,
        nextDue: Date.now(),
        createdAt: Date.now(),
      });
      setDescription("");
      setAmount("");
      Alert.alert("Added!", "Recurring expense created.");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (item) => {
    await updateDoc(doc(db, "recurringExpenses", item.id), {
      active: !item.active,
    });
  };

  const handleDelete = (item) => {
    Alert.alert("Delete", `Remove "${item.description}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteDoc(doc(db, "recurringExpenses", item.id)),
      },
    ]);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Recurring Expenses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Add form */}
        <View style={s.formCard}>
          <Text style={s.formTitle}>New Recurring Expense</Text>

          <TextInput
            style={s.input}
            placeholder="Description (e.g., Netflix, Rent)"
            value={description}
            onChangeText={setDescription}
            placeholderTextColor="#9CA3AF"
          />

          <TextInput
            style={s.input}
            placeholder="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholderTextColor="#9CA3AF"
          />

          {/* Frequency picker */}
          <Text style={s.label}>Frequency</Text>
          <View style={s.freqRow}>
            {FREQUENCIES.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  s.freqChip,
                  frequency === f.key && {
                    backgroundColor: f.color,
                    borderColor: f.color,
                  },
                ]}
                onPress={() => setFrequency(f.key)}
              >
                <Ionicons
                  name={f.icon}
                  size={14}
                  color={frequency === f.key ? "#fff" : f.color}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[s.freqTxt, frequency === f.key && { color: "#fff" }]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={s.addBtn}
            onPress={handleAdd}
            disabled={adding}
          >
            <Ionicons
              name="add-circle"
              size={20}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={s.addBtnTxt}>
              {adding ? "Adding..." : "Add Recurring"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Existing recurring expenses */}
        <Text style={s.sectionTitle}>
          Active ({recurringList.filter((r) => r.active).length})
        </Text>

        {recurringList.map((item) => {
          const freq = FREQUENCIES.find((f) => f.key === item.frequency);
          return (
            <View
              key={item.id}
              style={[s.itemCard, !item.active && { opacity: 0.5 }]}
            >
              <View
                style={[
                  s.itemIcon,
                  { backgroundColor: (freq?.color || "#6366F1") + "20" },
                ]}
              >
                <Ionicons
                  name={freq?.icon || "calendar"}
                  size={20}
                  color={freq?.color || "#6366F1"}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.itemName}>{item.description}</Text>
                <Text style={s.itemMeta}>
                  ₹{item.amount.toFixed(2)} • {freq?.label || item.frequency}
                </Text>
              </View>
              <Switch
                value={item.active}
                onValueChange={() => toggleActive(item)}
                trackColor={{ false: "#D1D5DB", true: "#A5B4FC" }}
                thumbColor={item.active ? "#6366F1" : "#9CA3AF"}
              />
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={{ marginLeft: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#F3F4F6",
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
    marginTop: 4,
  },

  freqRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  freqChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginRight: 8,
    marginBottom: 8,
  },
  freqTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },

  addBtn: {
    flexDirection: "row",
    backgroundColor: "#6366F1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
  },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  itemName: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  itemMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
