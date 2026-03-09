// src/components/SplitMethodPicker.js
import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumContext } from "../context/PremiumContext";
import { useNavigation } from "@react-navigation/native";
import { useConfirm } from "../context/ConfirmContext";
import Notify from "../utils/notify";

export default function SplitMethodPicker({
  members,
  totalAmount,
  currentUserId,
  currencySymbol,
  selectedMembers,
  onSelectedMembersChange,
  onSplitDataChange,
}) {
  const { hasFeature, isPremium } = useContext(PremiumContext);
  const navigation = useNavigation();
  const { premium } = useConfirm();  // ← Using useConfirm hook
  
  const [method, setMethod] = useState("equal");
  const [exactAmounts, setExactAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [shares, setShares] = useState({});

  // Check if advanced splits are available
  const canUseAdvancedSplits = hasFeature("advancedSplits");

  const METHODS = [
    {
      key: "equal",
      label: "Equal",
      icon: "git-compare-outline",
      desc: "Split equally",
      premium: false,
    },
    {
      key: "exact",
      label: "Exact",
      icon: "cash-outline",
      desc: "Enter amounts",
      premium: true,
    },
    {
      key: "percentage",
      label: "Percent",
      icon: "pie-chart-outline",
      desc: "By percentage",
      premium: true,
    },
    {
      key: "shares",
      label: "Shares",
      icon: "layers-outline",
      desc: "By ratio",
      premium: true,
    },
  ];

  // Handle method selection with premium check
  const handleMethodSelect = (methodKey) => {
    const methodInfo = METHODS.find(m => m.key === methodKey);
    
    // If it's a premium method and user doesn't have access
    if (methodInfo?.premium && !canUseAdvancedSplits) {
      premium(
        `${methodInfo.label} split`,
        () => navigation.navigate("Premium")
      );
      return;
    }
    
    setMethod(methodKey);
  };

  // Reset inputs when members change
  useEffect(() => {
    const initExact = {};
    const initPct = {};
    const initShares = {};
    const perPerson = totalAmount / (selectedMembers.length || 1);
    const pctEach = parseFloat(
      (100 / (selectedMembers.length || 1)).toFixed(2),
    );

    selectedMembers.forEach((uid) => {
      initExact[uid] = perPerson.toFixed(2);
      initPct[uid] = pctEach.toFixed(1);
      initShares[uid] = 1;
    });

    setExactAmounts(initExact);
    setPercentages(initPct);
    setShares(initShares);
  }, [selectedMembers.length]);

  // Recalculate and emit split data to parent
  useEffect(() => {
    const splitAmounts = {};

    if (method === "equal") {
      const share = totalAmount / (selectedMembers.length || 1);
      selectedMembers.forEach((uid) => {
        splitAmounts[uid] = parseFloat(share.toFixed(2));
      });
    } else if (method === "exact") {
      selectedMembers.forEach((uid) => {
        splitAmounts[uid] = parseFloat(exactAmounts[uid]) || 0;
      });
    } else if (method === "percentage") {
      selectedMembers.forEach((uid) => {
        const pct = parseFloat(percentages[uid]) || 0;
        splitAmounts[uid] = parseFloat(((pct / 100) * totalAmount).toFixed(2));
      });
    } else if (method === "shares") {
      const totalSharesCount = selectedMembers.reduce(
        (s, uid) => s + (parseFloat(shares[uid]) || 0),
        0,
      );
      selectedMembers.forEach((uid) => {
        const sh = parseFloat(shares[uid]) || 0;
        splitAmounts[uid] =
          totalSharesCount > 0
            ? parseFloat(((sh / totalSharesCount) * totalAmount).toFixed(2))
            : 0;
      });
    }

    onSplitDataChange?.({
      method,
      splitAmounts,
      isValid: getValidation().valid,
    });
  }, [method, exactAmounts, percentages, shares, totalAmount, selectedMembers]);

  // Validation
  const getValidation = () => {
    if (method === "equal" || method === "shares") {
      return { valid: true, diff: 0, total: totalAmount, label: "" };
    }

    if (method === "exact") {
      const total = selectedMembers.reduce(
        (s, uid) => s + (parseFloat(exactAmounts[uid]) || 0),
        0,
      );
      const diff = totalAmount - total;
      return {
        valid: Math.abs(diff) < 0.02,
        diff,
        total,
        label:
          Math.abs(diff) < 0.02
            ? `Total matches: ${currencySymbol}${total.toFixed(2)}`
            : `${currencySymbol}${Math.abs(diff).toFixed(2)} ${diff > 0 ? "remaining" : "over"}`,
      };
    }

    if (method === "percentage") {
      const total = selectedMembers.reduce(
        (s, uid) => s + (parseFloat(percentages[uid]) || 0),
        0,
      );
      const diff = 100 - total;
      return {
        valid: Math.abs(diff) < 0.5,
        diff,
        total,
        label:
          Math.abs(diff) < 0.5
            ? `Total: ${total.toFixed(1)}%`
            : `${Math.abs(diff).toFixed(1)}% ${diff > 0 ? "remaining" : "over"}`,
      };
    }

    return { valid: true, diff: 0, total: 0, label: "" };
  };

  const validation = getValidation();

  const getName = (uid) => {
    if (uid === currentUserId) return "You";
    const m = members.find((x) => x.id === uid);
    return m?.name || m?.email?.split("@")[0] || "Unknown";
  };

  const toggleMember = (uid) => {
    if (selectedMembers.includes(uid)) {
      if (selectedMembers.length <= 1) {
        Notify.error("At least one person must be in the split");
        return;
      }
      onSelectedMembersChange(selectedMembers.filter((id) => id !== uid));
    } else {
      onSelectedMembersChange([...selectedMembers, uid]);
    }
  };

  // Auto-distribute remaining for exact amounts
  const autoDistributeExact = () => {
    if (selectedMembers.length === 0) return;
    const perPerson = (totalAmount / selectedMembers.length).toFixed(2);
    const newAmounts = {};
    selectedMembers.forEach((uid) => {
      newAmounts[uid] = perPerson;
    });
    // Fix rounding — add remainder to first person
    const sum = selectedMembers.length * parseFloat(perPerson);
    const remainder = totalAmount - sum;
    if (Math.abs(remainder) >= 0.01) {
      newAmounts[selectedMembers[0]] = (
        parseFloat(perPerson) + remainder
      ).toFixed(2);
    }
    setExactAmounts(newAmounts);
    Notify.success("Split distributed equally");
  };

  // Auto-distribute remaining for percentages
  const autoDistributePercent = () => {
    if (selectedMembers.length === 0) return;
    const pctEach = (100 / selectedMembers.length).toFixed(1);
    const newPcts = {};
    selectedMembers.forEach((uid) => {
      newPcts[uid] = pctEach;
    });
    const sum = selectedMembers.length * parseFloat(pctEach);
    const remainder = 100 - sum;
    if (Math.abs(remainder) >= 0.1) {
      newPcts[selectedMembers[0]] = (parseFloat(pctEach) + remainder).toFixed(
        1,
      );
    }
    setPercentages(newPcts);
    Notify.success("Percentages distributed equally");
  };

  // Calculate what each person's amount is (for display)
  const getPersonAmount = (uid) => {
    if (method === "equal") {
      return totalAmount / (selectedMembers.length || 1);
    }
    if (method === "exact") {
      return parseFloat(exactAmounts[uid]) || 0;
    }
    if (method === "percentage") {
      const pct = parseFloat(percentages[uid]) || 0;
      return (pct / 100) * totalAmount;
    }
    if (method === "shares") {
      const totalSharesCount = selectedMembers.reduce(
        (s, id) => s + (parseFloat(shares[id]) || 0),
        0,
      );
      const sh = parseFloat(shares[uid]) || 0;
      return totalSharesCount > 0 ? (sh / totalSharesCount) * totalAmount : 0;
    }
    return 0;
  };

  return (
    <View style={st.container}>
      {/* ═══ Method selector ═══ */}
      <Text style={st.sectionLabel}>Split Method</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.methodScroll}
      >
        {METHODS.map((m) => {
          const isLocked = m.premium && !canUseAdvancedSplits;
          const isSelected = method === m.key;
          
          return (
            <TouchableOpacity
              key={m.key}
              style={[
                st.methodChip, 
                isSelected && st.methodChipActive,
                isLocked && st.methodChipLocked,
              ]}
              onPress={() => handleMethodSelect(m.key)}
            >
              <Ionicons
                name={m.icon}
                size={16}
                color={isSelected ? "#fff" : isLocked ? "#9CA3AF" : "#6366F1"}
                style={{ marginRight: 5 }}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={[
                      st.methodChipLabel,
                      isSelected && st.methodChipLabelActive,
                      isLocked && st.methodChipLabelLocked,
                    ]}
                  >
                    {m.label}
                  </Text>
                  {/* Premium badge */}
                  {isLocked && (
                    <View style={st.premiumBadge}>
                      <Ionicons name="diamond" size={10} color="#F59E0B" />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    st.methodChipDesc,
                    isSelected && { color: "rgba(255,255,255,0.7)" },
                    isLocked && { color: "#D1D5DB" },
                  ]}
                >
                  {m.desc}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ═══ Premium upsell banner ═══ */}
      {!canUseAdvancedSplits && (
        <TouchableOpacity 
          style={st.premiumBanner}
          onPress={() => navigation.navigate("Premium")}
          activeOpacity={0.7}
        >
          <View style={st.premiumBannerIcon}>
            <Ionicons name="diamond" size={18} color="#F59E0B" />
          </View>
          <View style={st.premiumBannerContent}>
            <Text style={st.premiumBannerTitle}>Unlock Advanced Splits</Text>
            <Text style={st.premiumBannerDesc}>
              Exact, Percentage & Share splits with Premium
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
        </TouchableOpacity>
      )}

      {/* ═══ Quick actions ═══ */}
      <View style={st.quickRow}>
        <TouchableOpacity
          style={[
            st.quickPill,
            selectedMembers.length === members.length && st.quickPillActive,
          ]}
          onPress={() => onSelectedMembersChange(members.map((m) => m.id))}
        >
          <Ionicons
            name="people"
            size={14}
            color={
              selectedMembers.length === members.length ? "#fff" : "#6366F1"
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              st.quickPillTxt,
              selectedMembers.length === members.length &&
                st.quickPillTxtActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            st.quickPill,
            selectedMembers.length === 1 &&
              selectedMembers[0] === currentUserId &&
              st.quickPillActive,
          ]}
          onPress={() => onSelectedMembersChange([currentUserId])}
        >
          <Text
            style={[
              st.quickPillTxt,
              selectedMembers.length === 1 &&
                selectedMembers[0] === currentUserId &&
                st.quickPillTxtActive,
            ]}
          >
            Only Me
          </Text>
        </TouchableOpacity>

        {/* Auto-distribute button for exact/percentage */}
        {(method === "exact" || method === "percentage") && canUseAdvancedSplits && (
          <TouchableOpacity
            style={[st.quickPill, { borderColor: "#10B981" }]}
            onPress={
              method === "exact" ? autoDistributeExact : autoDistributePercent
            }
          >
            <Ionicons
              name="refresh"
              size={14}
              color="#10B981"
              style={{ marginRight: 4 }}
            />
            <Text style={[st.quickPillTxt, { color: "#10B981" }]}>
              Auto Split
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ═══ Split count ═══ */}
      <View style={st.splitCountRow}>
        <Text style={st.splitCountTxt}>
          {selectedMembers.length} of {members.length} selected
        </Text>
      </View>

      {/* ═══ Members list ═══ */}
      <View style={st.memberList}>
        {members.map((m) => {
          const isSelected = selectedMembers.includes(m.id);
          const isMe = m.id === currentUserId;
          const personAmt = isSelected ? getPersonAmount(m.id) : 0;

          return (
            <View
              key={m.id}
              style={[st.memberRow, !isSelected && st.memberRowDim]}
            >
              {/* Checkbox */}
              <TouchableOpacity
                style={[st.checkbox, isSelected && st.checkboxChecked]}
                onPress={() => toggleMember(m.id)}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </TouchableOpacity>

              {/* Avatar */}
              <View
                style={[
                  st.avatar,
                  isSelected
                    ? { backgroundColor: "#6366F1" }
                    : { backgroundColor: "#E5E7EB" },
                ]}
              >
                <Text
                  style={[st.avatarTxt, !isSelected && { color: "#9CA3AF" }]}
                >
                  {getName(m.id)[0].toUpperCase()}
                </Text>
              </View>

              {/* Name */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={[st.memberName, !isSelected && { color: "#9CA3AF" }]}
                    numberOfLines={1}
                  >
                    {getName(m.id)}
                  </Text>
                  {isMe && (
                    <View style={st.youBadge}>
                      <Text style={st.youBadgeTxt}>You</Text>
                    </View>
                  )}
                </View>
                {/* Show calculated amount below name */}
                {isSelected && totalAmount > 0 && (
                  <Text style={st.personAmtBelow}>
                    {currencySymbol}
                    {personAmt.toFixed(2)}
                  </Text>
                )}
              </View>

              {/* ═══ Input area (varies by method) ═══ */}
              {isSelected && method === "equal" && totalAmount > 0 && (
                <View style={st.equalBadge}>
                  <Text style={st.equalBadgeTxt}>
                    {currencySymbol}
                    {(totalAmount / selectedMembers.length).toFixed(2)}
                  </Text>
                  <Text style={st.equalPctTxt}>
                    {((1 / selectedMembers.length) * 100).toFixed(0)}%
                  </Text>
                </View>
              )}

              {isSelected && method === "exact" && (
                <View style={st.inputBox}>
                  <Text style={st.inputPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={st.numInput}
                    keyboardType="decimal-pad"
                    value={String(exactAmounts[m.id] || "")}
                    onChangeText={(v) =>
                      setExactAmounts((prev) => ({ ...prev, [m.id]: v }))
                    }
                    placeholder="0.00"
                    placeholderTextColor="#D1D5DB"
                    selectTextOnFocus
                  />
                </View>
              )}

              {isSelected && method === "percentage" && (
                <View style={st.inputBox}>
                  <TextInput
                    style={st.numInput}
                    keyboardType="decimal-pad"
                    value={String(percentages[m.id] || "")}
                    onChangeText={(v) =>
                      setPercentages((prev) => ({ ...prev, [m.id]: v }))
                    }
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    selectTextOnFocus
                  />
                  <Text style={st.inputSuffix}>%</Text>
                  {totalAmount > 0 && (
                    <Text style={st.pctAmtHint}>
                      = {currencySymbol}
                      {(
                        ((parseFloat(percentages[m.id]) || 0) / 100) *
                        totalAmount
                      ).toFixed(2)}
                    </Text>
                  )}
                </View>
              )}

              {isSelected && method === "shares" && (
                <View style={st.sharesBox}>
                  <TouchableOpacity
                    style={st.sharesBtn}
                    onPress={() => {
                      const curr = parseInt(shares[m.id]) || 1;
                      if (curr > 1)
                        setShares((prev) => ({
                          ...prev,
                          [m.id]: curr - 1,
                        }));
                    }}
                  >
                    <Ionicons name="remove" size={16} color="#6366F1" />
                  </TouchableOpacity>
                  <Text style={st.sharesValue}>{shares[m.id] || 1}x</Text>
                  <TouchableOpacity
                    style={st.sharesBtn}
                    onPress={() => {
                      const curr = parseInt(shares[m.id]) || 1;
                      setShares((prev) => ({
                        ...prev,
                        [m.id]: curr + 1,
                      }));
                    }}
                  >
                    <Ionicons name="add" size={16} color="#6366F1" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ═══ Validation bar ═══ */}
      {(method === "exact" || method === "percentage") && (
        <View
          style={[
            st.validationBar,
            validation.valid ? st.validationOk : st.validationErr,
          ]}
        >
          <Ionicons
            name={validation.valid ? "checkmark-circle" : "alert-circle"}
            size={16}
            color={validation.valid ? "#10B981" : "#EF4444"}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              st.validationTxt,
              validation.valid ? { color: "#065F46" } : { color: "#991B1B" },
            ]}
          >
            {validation.label}
          </Text>
        </View>
      )}

      {/* ═══ Visual split bar ═══ */}
      {totalAmount > 0 && selectedMembers.length > 0 && (
        <View style={st.splitBarOuter}>
          <View style={st.splitBarContainer}>
            {selectedMembers.map((uid, idx) => {
              const amt = getPersonAmount(uid);
              const widthPct = totalAmount > 0 ? (amt / totalAmount) * 100 : 0;
              const colors = [
                "#6366F1",
                "#10B981",
                "#F59E0B",
                "#EF4444",
                "#8B5CF6",
                "#EC4899",
                "#14B8A6",
                "#F97316",
              ];
              const color = colors[idx % colors.length];

              return (
                <View
                  key={uid}
                  style={{
                    width: `${Math.max(widthPct, 2)}%`,
                    height: 10,
                    backgroundColor: color,
                    borderTopLeftRadius: idx === 0 ? 5 : 0,
                    borderBottomLeftRadius: idx === 0 ? 5 : 0,
                    borderTopRightRadius:
                      idx === selectedMembers.length - 1 ? 5 : 0,
                    borderBottomRightRadius:
                      idx === selectedMembers.length - 1 ? 5 : 0,
                  }}
                />
              );
            })}
          </View>

          {/* Legend */}
          <View style={st.legendRow}>
            {selectedMembers.map((uid, idx) => {
              const colors = [
                "#6366F1",
                "#10B981",
                "#F59E0B",
                "#EF4444",
                "#8B5CF6",
                "#EC4899",
                "#14B8A6",
                "#F97316",
              ];
              const color = colors[idx % colors.length];
              const amt = getPersonAmount(uid);
              return (
                <View key={uid} style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: color }]} />
                  <Text style={st.legendTxt} numberOfLines={1}>
                    {getName(uid)} ({currencySymbol}
                    {amt.toFixed(2)})
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ═══ Summary ═══ */}
      {totalAmount > 0 && selectedMembers.length > 0 && (
        <View style={st.summaryBar}>
          <Ionicons
            name="calculator-outline"
            size={18}
            color="#6366F1"
            style={{ marginRight: 8 }}
          />
          <Text style={st.summaryTxt}>
            {currencySymbol}
            {totalAmount.toFixed(2)} split between {selectedMembers.length}{" "}
            {selectedMembers.length === 1 ? "person" : "people"}
            {method === "equal" &&
              ` = ${currencySymbol}${(totalAmount / selectedMembers.length).toFixed(2)} each`}
          </Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { marginTop: 4 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 10,
  },

  /* Method chips */
  methodScroll: { marginBottom: 10 },
  methodChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    marginRight: 8,
    minWidth: 100,
  },
  methodChipActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  methodChipLocked: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  methodChipLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366F1",
  },
  methodChipLabelActive: { color: "#fff" },
  methodChipLabelLocked: { color: "#9CA3AF" },
  methodChipDesc: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 1,
  },

  /* Premium badge on method chip */
  premiumBadge: {
    backgroundColor: "#FFFBEB",
    borderRadius: 6,
    padding: 2,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },

  /* Premium upsell banner */
  premiumBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    marginBottom: 12,
  },
  premiumBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  premiumBannerContent: {
    flex: 1,
  },
  premiumBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 2,
  },
  premiumBannerDesc: {
    fontSize: 12,
    color: "#B45309",
  },

  /* Quick actions */
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    marginRight: 8,
    marginBottom: 6,
  },
  quickPillActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  quickPillTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
  },
  quickPillTxtActive: { color: "#fff" },

  /* Split count */
  splitCountRow: {
    marginBottom: 8,
  },
  splitCountTxt: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "600",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    overflow: "hidden",
  },

  /* Member list */
  memberList: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  memberRowDim: { opacity: 0.45 },

  /* Checkbox */
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },

  /* Avatar */
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  avatarTxt: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },

  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  personAmtBelow: {
    fontSize: 11,
    color: "#6366F1",
    fontWeight: "500",
    marginTop: 1,
  },

  youBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  youBadgeTxt: {
    fontSize: 10,
    color: "#1E40AF",
    fontWeight: "700",
  },

  /* Equal badge */
  equalBadge: {
    alignItems: "flex-end",
    marginLeft: "auto",
  },
  equalBadgeTxt: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6366F1",
  },
  equalPctTxt: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 1,
  },

  /* Input boxes */
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginLeft: "auto",
  },
  numInput: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    width: 55,
    textAlign: "right",
    paddingVertical: 6,
  },
  inputPrefix: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 2,
  },
  inputSuffix: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 2,
  },
  pctAmtHint: {
    fontSize: 10,
    color: "#9CA3AF",
    marginLeft: 6,
    fontWeight: "500",
  },

  /* Shares stepper */
  sharesBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginLeft: "auto",
  },
  sharesBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  sharesValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6366F1",
    minWidth: 30,
    textAlign: "center",
  },

  /* Validation */
  validationBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  validationOk: { backgroundColor: "#D1FAE5" },
  validationErr: { backgroundColor: "#FEE2E2" },
  validationTxt: { fontSize: 13, fontWeight: "600" },

  /* Visual bar */
  splitBarOuter: { marginTop: 12 },
  splitBarContainer: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendTxt: {
    fontSize: 11,
    color: "#6B7280",
    maxWidth: 120,
  },

  /* Summary */
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  summaryTxt: {
    flex: 1,
    color: "#4338CA",
    fontSize: 13,
    fontWeight: "500",
  },
});