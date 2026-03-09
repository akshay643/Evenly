import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal as RNModal,
} from "react-native";
import { Linking, Share } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { PremiumContext } from "../context/PremiumContext";
import Notify from "../utils/notify";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, storage } from "../../firebase.config";
import {
  minimizeTransactions,
  calcNetBalances,
} from "../utils/minimizeTransactions";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  sendPushNotification,
  NotificationTemplates,
} from "../services/notificationService";
import { haptic } from "../utils/haptics";
import PaymentInfoCard from "../components/PaymentInfoCard";

/* ================================================================
   SettleUpScreen — Splitwise-style optimised settlements
   ================================================================ */
export default function SettleUpScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useContext(AuthContext);
  const { show, confirm } = useConfirm();
  const { hasFeature } = useContext(PremiumContext);

  const [group, setGroup] = useState(null);
  const [membersMap, setMembersMap] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [confirmedSettlements, setConfirmedSettlements] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [optimised, setOptimised] = useState([]);
  const [netBalances, setNetBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [proofPhotoUri, setProofPhotoUri] = useState(null);
  const [viewingProof, setViewingProof] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [paymentInfoMember, setPaymentInfoMember] = useState(null); // { memberData, amount }

  /* ── helpers ────────────────────────────────────── */
  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === "number") return new Date(ts);
    return new Date(ts);
  };

  const fmtDate = (ts) => {
    const d = toDate(ts);
    return d.getTime() > 0
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
  };
  const generateUPILink = (
    upiId,
    name,
    amount,
    note = "Settlement via SplitBill",
  ) => {
    if (!upiId) return null;
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
  };
  const openUPIPayment = async (upiId, name, amount) => {
    const upiLink = generateUPILink(upiId, name, amount);
    if (!upiLink) {
      Notify.warning(
        "No UPI ID available. Ask them to add it in their profile.",
      );
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(upiLink);
      if (canOpen) {
        await Linking.openURL(upiLink);
        haptic.success();
      } else {
        // Fallback: Show UPI ID to copy
        confirm(
          "Pay via UPI",
          `Send ₹${amount.toFixed(2)} to:\n\n${upiId}\n\nCopy this UPI ID and pay using any UPI app.`,
          () => {
            haptic.success();
            Notify.success("UPI ID copied!");
          },
          () => {
            haptic.success();
            Clipboard.setString(upiId);
            Notify.success("UPI ID copied!");
          },
        );
      }
    } catch (e) {
      Notify.error("Could not open UPI app: " + e.message);
    }
  };

  const shareViaWhatsApp = async (toName, amount, sym) => {
    const message = `Hey ${toName}! 👋

I just paid you ${sym}${amount.toFixed(2)} 💸

Please confirm the payment in SplitBill app:
https://play.google.com/store/apps/details?id=YOUR_APP_ID

Thanks! 🙏`;

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to regular share
        await Share.share({ message });
      }
    } catch (e) {
      // Fallback to regular share
      await Share.share({ message });
    }
  };
  const getCurrencySymbol = useCallback(() => {
    const map = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      INR: "₹",
      JPY: "¥",
      AUD: "A$",
      CAD: "C$",
    };
    return map[group?.currency] || "₹";
  }, [group]);

  const memberName = (uid) => {
    const m = membersMap[uid];
    return m?.name || m?.email || "Unknown";
  };

  /* ── loadAll ── */
  const loadAll = useCallback(async () => {
    try {
      const gDoc = await getDoc(doc(db, "groups", groupId));
      if (!gDoc.exists()) {
        setLoading(false);
        return;
      }
      const gData = { id: gDoc.id, ...gDoc.data() };
      setGroup(gData);

      const mMap = {};
      for (const mid of gData.members) {
        const d = await getDoc(doc(db, "users", mid));
        mMap[mid] = d.exists()
          ? { id: mid, ...d.data() }
          : { id: mid, email: "Unknown" };
      }
      setMembersMap(mMap);

      const expSnap = await getDocs(
        query(collection(db, "expenses"), where("groupId", "==", groupId)),
      );
      const exps = [];
      expSnap.forEach((d) => exps.push({ id: d.id, ...d.data() }));
      setExpenses(exps);

      const setSnap = await getDocs(
        query(collection(db, "settlements"), where("groupId", "==", groupId)),
      );
      const sets = [];
      setSnap.forEach((d) => sets.push({ id: d.id, ...d.data() }));
      setConfirmedSettlements(sets);

      const memberIds = gData.members;
      const net = calcNetBalances(exps, sets, memberIds);
      setNetBalances(net);
      const txns = minimizeTransactions(exps, sets, memberIds);
      setOptimised(txns);

      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      console.error("SettleUp load error:", e);
      Notify.error("Failed to load settlement data");
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadAll();

    const rq = query(
      collection(db, "settlementRequests"),
      where("groupId", "==", groupId),
    );
    const unsub = onSnapshot(rq, (snap) => {
      const reqs = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.status === "pending") reqs.push({ id: d.id, ...data });
      });
      setPendingRequests(reqs);
    });

    return () => unsub();
  }, [groupId, loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  /* ================================================================
     Actions
     ================================================================ */
  const hasPendingRequest = (fromId, toId) =>
    pendingRequests.some((r) => r.from === fromId && r.to === toId);

  const pickProofPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Notify.warning("Please allow photo access to attach payment proof");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsEditing: true,
      aspect: [4, 3],
      width: 800,
    });
    if (!result.canceled && result.assets?.[0]) {
      setProofPhotoUri(result.assets[0].uri);
      Notify.success("Photo attached! 📸");
    }
  };

  const takeProofPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Notify.warning("Please allow camera access to take a photo");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      allowsEditing: true,
      aspect: [4, 3],
      width: 800,
    });
    if (!result.canceled && result.assets?.[0]) {
      setProofPhotoUri(result.assets[0].uri);
      Notify.success("Photo captured! 📸");
    }
  };

  const handleAttachProof = () => {
    if (!hasFeature("paymentProof")) {
      show({
        type: "warning",
        title: "⭐ Pro Feature",
        message:
          "Attaching payment proof with cloud storage is a Pro feature. Upgrade to add photo evidence to your settlements.",
        confirmText: "Upgrade",
        cancelText: "Maybe Later",
        onConfirm: () => navigation.navigate("Premium"),
      });
      return;
    }
    show({
      type: "info",
      title: "Attach Payment Proof",
      message: "Choose how you want to add your payment proof",
      confirmText: "📷 Camera",
      cancelText: "🖼️ Gallery",
      onConfirm: takeProofPhoto,
      onCancel: pickProofPhoto,
    });
  };

  const sendSettlementRequest = async (toId, amount) => {
    const toUser = membersMap[toId];
    const fromUser = membersMap[user.uid];

    if (!toUser || !fromUser) {
      Notify.error("User data not found");
      return;
    }

    if (hasPendingRequest(user.uid, toId)) {
      Notify.warning(
        `You already have a pending request to ${memberName(toId)}. Please wait for confirmation.`,
      );
      return;
    }

    const sym = getCurrencySymbol();
    const message = `Send ${sym}${amount.toFixed(2)} to ${memberName(toId)}?\n\nThey'll need to confirm receipt.${
      proofPhotoUri ? "\n\n📸 Payment proof attached" : ""
    }`;

    show({
      type: "confirm",
      title: "Send Settlement Request",
      message: message,
      confirmText: "Send",
      cancelText: "Cancel",
      icon: "paper-plane", // Explicitly set the icon
      onConfirm: async () => {
        setProcessing(true);
        try {
          let uploadedPhotoUrl = null;

          if (proofPhotoUri) {
            setUploadingProof(true);
            const blob = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.onload = () => resolve(xhr.response);
              xhr.onerror = () =>
                reject(new Error("Failed to read photo file"));
              xhr.responseType = "blob";
              xhr.open("GET", proofPhotoUri, true);
              xhr.send(null);
            });

            const photoRef = ref(
              storage,
              `settlement-proofs/${groupId}/${user.uid}_${Date.now()}.jpg`,
            );
            await uploadBytes(photoRef, blob);
            uploadedPhotoUrl = await getDownloadURL(photoRef);
            blob.close?.();
            setUploadingProof(false);
          }

          await addDoc(collection(db, "settlementRequests"), {
            groupId,
            from: user.uid,
            fromName: fromUser.name || fromUser.email || "Unknown",
            to: toId,
            toName: toUser.name || toUser.email || "Unknown",
            amount: parseFloat(amount.toFixed(2)),
            status: "pending",
            createdAt: Date.now(),
            proofPhotoUri: uploadedPhotoUrl,
          });

          const recipientDoc = await getDoc(doc(db, "users", toId));
          const recipientData = recipientDoc.data();
          if (recipientData?.pushToken) {
            const template = NotificationTemplates.settlementRequest(
              fromUser.name || fromUser.email,
              amount,
              getCurrencySymbol(),
            );
            await sendPushNotification(recipientData.pushToken, {
              ...template,
              data: { ...template.data, groupId },
            });
          }

          setProofPhotoUri(null);
          haptic.success();
          Notify.success(`Settlement request sent to ${memberName(toId)}! 🎉`);
          await loadAll();
        } catch (e) {
          setUploadingProof(false);
          Notify.error("Failed to send request: " + e.message);
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const handleConfirm = async (req) => {
    const sym = getCurrencySymbol();

    confirm(
      "Confirm Payment Received",
      `Confirm that ${req.fromName} paid you ${sym}${req.amount.toFixed(2)}?\n\nThis will update your balances.`,
      async () => {
        setProcessing(true);
        try {
          await addDoc(collection(db, "settlements"), {
            groupId,
            from: req.from,
            to: req.to,
            amount: req.amount,
            createdAt: Date.now(),
            confirmedBy: user.uid,
          });

          await updateDoc(doc(db, "settlementRequests", req.id), {
            status: "confirmed",
            confirmedAt: Date.now(),
          });

          haptic.success();
          Notify.success("Payment confirmed! Balances updated ✅");
          await loadAll();
        } catch (e) {
          Notify.error("Failed to confirm: " + e.message);
        } finally {
          setProcessing(false);
        }
      },
    );
  };

  const handleReject = async (req) => {
    const sym = getCurrencySymbol();

    show({
      type: "warning",
      title: "Reject Settlement Request",
      message: `Are you sure you want to reject ${sym}${req.amount.toFixed(2)} from ${req.fromName}?`,
      confirmText: "Yes, Reject",
      cancelText: "Keep It",
      onConfirm: async () => {
        setProcessing(true);
        try {
          await updateDoc(doc(db, "settlementRequests", req.id), {
            status: "rejected",
            rejectedAt: Date.now(),
          });

          haptic.warning();
          Notify.info("Settlement request rejected");
          await loadAll();
        } catch (e) {
          Notify.error("Failed to reject: " + e.message);
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  /* ================================================================
     Derived data
     ================================================================ */
  const sym = getCurrencySymbol();
  const requestsToMe = pendingRequests.filter((r) => r.to === user.uid);
  const requestsFromMe = pendingRequests.filter((r) => r.from === user.uid);
  const myBalance = netBalances[user.uid] || 0;

  const iShouldPay = optimised.filter((t) => t.from === user.uid);
  const shouldPayMe = optimised.filter((t) => t.to === user.uid);

  const memberBreakdown = Object.keys(membersMap).map((uid) => {
    let totalPaid = 0;
    let totalShare = 0;
    expenses.forEach(({ paidBy, amount, splitBetween }) => {
      if (!paidBy || !amount || !splitBetween || splitBetween.length === 0)
        return;
      if (paidBy === uid) totalPaid += amount;
      if (splitBetween.includes(uid))
        totalShare += amount / splitBetween.length;
    });
    const net = netBalances[uid] || 0;
    return { uid, totalPaid, totalShare, net };
  });

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={st.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Settle Up</Text>
        <TouchableOpacity onPress={onRefresh} style={st.headerBtn}>
          <Ionicons name="refresh" size={22} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* Net Balance Summary */}
        <View style={st.summaryCard}>
          <Text style={st.summaryLabel}>Your Net Balance</Text>
          <Text
            style={[
              st.summaryAmount,
              myBalance > 0.01
                ? st.green
                : myBalance < -0.01
                  ? st.red
                  : st.gray,
            ]}
          >
            {myBalance > 0.01
              ? `+${sym}${myBalance.toFixed(2)}`
              : myBalance < -0.01
                ? `-${sym}${Math.abs(myBalance).toFixed(2)}`
                : "All settled ✓"}
          </Text>
          <Text style={st.summarySub}>
            {myBalance > 0.01
              ? "Others owe you"
              : myBalance < -0.01
                ? "You owe others"
                : "No pending debts!"}
          </Text>
        </View>

        {/* Optimal Settlement Plan */}
        {optimised.length > 0 ? (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="flash" size={20} color="#8B5CF6" />
              <Text
                style={[st.sectionTitle, { color: "#8B5CF6", marginLeft: 8 }]}
              >
                Smart Settlement Plan
              </Text>
            </View>
            <View style={st.planCard}>
              <Text style={st.planDesc}>
                Only {optimised.length} payment{optimised.length > 1 ? "s" : ""}{" "}
                needed to settle everyone:
              </Text>

              <TouchableOpacity
                style={st.breakdownToggle}
                onPress={() => setShowBreakdown((v) => !v)}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#8B5CF6"
                />
                <Text style={st.breakdownToggleTxt}>
                  How we calculated this
                </Text>
                <Ionicons
                  name={showBreakdown ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#8B5CF6"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {showBreakdown && (
                <View style={st.breakdownPanel}>
                  <Text style={st.bpStepTitle}>
                    Step 1 — Net balance per person
                  </Text>
                  <Text style={st.bpStepSub}>
                    Net = Total Paid − Fair Share
                  </Text>

                  <View style={st.bpTable}>
                    <View style={st.bpTableRow}>
                      <Text style={[st.bpCell, st.bpHdr, { flex: 2 }]}>
                        Person
                      </Text>
                      <Text style={[st.bpCell, st.bpHdr, { flex: 1.5 }]}>
                        Paid
                      </Text>
                      <Text style={[st.bpCell, st.bpHdr, { flex: 1.5 }]}>
                        Share
                      </Text>
                      <Text style={[st.bpCell, st.bpHdr, { flex: 1.5 }]}>
                        Net
                      </Text>
                    </View>
                    {memberBreakdown.map(
                      ({ uid, totalPaid, totalShare, net }) => (
                        <View
                          key={uid}
                          style={[
                            st.bpTableRow,
                            uid === user.uid && st.bpTableRowMe,
                          ]}
                        >
                          <View
                            style={{
                              flex: 2,
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <View
                              style={[
                                st.bpAvatar,
                                {
                                  backgroundColor:
                                    net > 0.01
                                      ? "#D1FAE5"
                                      : net < -0.01
                                        ? "#FEE2E2"
                                        : "#F3F4F6",
                                },
                              ]}
                            >
                              <Text style={st.bpAvatarTxt}>
                                {memberName(uid)[0].toUpperCase()}
                              </Text>
                            </View>
                            <Text style={st.bpCell} numberOfLines={1}>
                              {uid === user.uid ? "You" : memberName(uid)}
                            </Text>
                          </View>
                          <Text
                            style={[st.bpCell, { flex: 1.5, color: "#059669" }]}
                          >
                            {sym}
                            {totalPaid.toFixed(2)}
                          </Text>
                          <Text
                            style={[st.bpCell, { flex: 1.5, color: "#6B7280" }]}
                          >
                            {sym}
                            {totalShare.toFixed(2)}
                          </Text>
                          <Text
                            style={[
                              st.bpCell,
                              { flex: 1.5, fontWeight: "bold" },
                              net > 0.01
                                ? { color: "#10B981" }
                                : net < -0.01
                                  ? { color: "#EF4444" }
                                  : { color: "#6B7280" },
                            ]}
                          >
                            {net > 0.01 ? "+" : ""}
                            {sym}
                            {net.toFixed(2)}
                          </Text>
                        </View>
                      ),
                    )}
                  </View>

                  <View style={st.bpLegend}>
                    <View style={st.bpLegendRow}>
                      <View
                        style={[st.bpDot, { backgroundColor: "#10B981" }]}
                      />
                      <Text style={st.bpLegendTxt}>
                        Positive = group owes them (overpaid)
                      </Text>
                    </View>
                    <View style={st.bpLegendRow}>
                      <View
                        style={[st.bpDot, { backgroundColor: "#EF4444" }]}
                      />
                      <Text style={st.bpLegendTxt}>
                        Negative = they owe the group (underpaid)
                      </Text>
                    </View>
                  </View>

                  <Text style={[st.bpStepTitle, { marginTop: 14 }]}>
                    Step 2 — Minimize transactions
                  </Text>
                  <Text style={st.bpStepSub}>
                    Match the largest debtor to the largest creditor. Settle the
                    smaller of the two, then move to the next — just like
                    Splitwise.
                  </Text>

                  {optimised.map((txn, idx) => {
                    const isMe = txn.from === user.uid || txn.to === user.uid;
                    const isPayer = txn.from === user.uid;
                    const pending = hasPendingRequest(txn.from, txn.to);
                    const recipientData = membersMap[txn.to];
                    const hasUPI = !!recipientData?.upiId;

                    return (
                      <View
                        key={idx}
                        style={[st.planRow, isMe && st.planRowHighlight]}
                      >
                        <TouchableOpacity
                          style={[
                            st.planAvatar,
                            { backgroundColor: "#FEE2E2" },
                          ]}
                          onPress={() =>
                            isPayer &&
                            setPaymentInfoMember({
                              memberData: recipientData,
                              amount: txn.amount,
                            })
                          }
                          activeOpacity={isPayer ? 0.6 : 1}
                        >
                          <Text style={st.planAvatarTxt}>
                            {memberName(txn.from)[0].toUpperCase()}
                          </Text>
                        </TouchableOpacity>

                        <View style={st.planCenter}>
                          <Text style={st.planFrom}>
                            {txn.from === user.uid
                              ? "You"
                              : memberName(txn.from)}
                          </Text>
                          <View style={st.planArrowRow}>
                            <View style={st.planLine} />
                            <View style={st.planAmtBadge}>
                              <Text style={st.planAmtTxt}>
                                {sym}
                                {txn.amount.toFixed(2)}
                              </Text>
                            </View>
                            <View style={st.planLine} />
                            <Ionicons
                              name="arrow-forward"
                              size={14}
                              color="#8B5CF6"
                            />
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              isPayer &&
                              setPaymentInfoMember({
                                memberData: recipientData,
                                amount: txn.amount,
                              })
                            }
                            activeOpacity={isPayer ? 0.6 : 1}
                          >
                            <Text
                              style={[
                                st.planTo,
                                isPayer && {
                                  color: "#6366F1",
                                  textDecorationLine: "underline",
                                },
                              ]}
                            >
                              {txn.to === user.uid ? "You" : memberName(txn.to)}
                              {isPayer && hasUPI ? " 💳" : ""}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          style={[
                            st.planAvatar,
                            { backgroundColor: "#D1FAE5" },
                          ]}
                          onPress={() =>
                            isPayer &&
                            setPaymentInfoMember({
                              memberData: recipientData,
                              amount: txn.amount,
                            })
                          }
                          activeOpacity={isPayer ? 0.6 : 1}
                        >
                          <Text style={st.planAvatarTxt}>
                            {memberName(txn.to)[0].toUpperCase()}
                          </Text>
                        </TouchableOpacity>

                        {/* ✅ Action buttons for payer */}
                        {isPayer && (
                          <View style={st.planActions}>
                            {pending ? (
                              <View style={st.sentBadge}>
                                <Ionicons
                                  name="time"
                                  size={14}
                                  color="#92400E"
                                />
                                <Text style={st.sentTxt}>Sent</Text>
                              </View>
                            ) : (
                              <>
                                {/* ✅ UPI Pay Button */}
                                {hasUPI && (
                                  <TouchableOpacity
                                    style={st.upiBtn}
                                    onPress={() =>
                                      openUPIPayment(
                                        recipientData.upiId,
                                        memberName(txn.to),
                                        txn.amount,
                                      )
                                    }
                                  >
                                    <Text style={st.upiBtnTxt}>Pay</Text>
                                  </TouchableOpacity>
                                )}

                                {/* Settlement Request Button */}
                                <TouchableOpacity
                                  style={st.payBtn}
                                  onPress={() =>
                                    sendSettlementRequest(txn.to, txn.amount)
                                  }
                                  disabled={processing}
                                >
                                  <Ionicons
                                    name="paper-plane"
                                    size={14}
                                    color="#fff"
                                  />
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {optimised.map((txn, idx) => {
                const isMe = txn.from === user.uid || txn.to === user.uid;
                const isPayer = txn.from === user.uid;
                const pending = hasPendingRequest(txn.from, txn.to);

                return (
                  <View
                    key={idx}
                    style={[st.planRow, isMe && st.planRowHighlight]}
                  >
                    <TouchableOpacity
                      style={[st.planAvatar, { backgroundColor: "#FEE2E2" }]}
                      onPress={() =>
                        isPayer &&
                        setPaymentInfoMember({
                          memberData: membersMap[txn.to],
                          amount: txn.amount,
                        })
                      }
                      activeOpacity={isPayer ? 0.6 : 1}
                    >
                      <Text style={st.planAvatarTxt}>
                        {memberName(txn.from)[0].toUpperCase()}
                      </Text>
                    </TouchableOpacity>

                    <View style={st.planCenter}>
                      <Text style={st.planFrom}>
                        {txn.from === user.uid ? "You" : memberName(txn.from)}
                      </Text>
                      <View style={st.planArrowRow}>
                        <View style={st.planLine} />
                        <View style={st.planAmtBadge}>
                          <Text style={st.planAmtTxt}>
                            {sym}
                            {txn.amount.toFixed(2)}
                          </Text>
                        </View>
                        <View style={st.planLine} />
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color="#8B5CF6"
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          isPayer &&
                          setPaymentInfoMember({
                            memberData: membersMap[txn.to],
                            amount: txn.amount,
                          })
                        }
                        activeOpacity={isPayer ? 0.6 : 1}
                      >
                        <Text
                          style={[
                            st.planTo,
                            isPayer && {
                              color: "#6366F1",
                              textDecorationLine: "underline",
                            },
                          ]}
                        >
                          {txn.to === user.uid ? "You" : memberName(txn.to)}
                          {isPayer ? " 💳" : ""}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[st.planAvatar, { backgroundColor: "#D1FAE5" }]}
                      onPress={() =>
                        isPayer &&
                        setPaymentInfoMember({
                          memberData: membersMap[txn.to],
                          amount: txn.amount,
                        })
                      }
                      activeOpacity={isPayer ? 0.6 : 1}
                    >
                      <Text style={st.planAvatarTxt}>
                        {memberName(txn.to)[0].toUpperCase()}
                      </Text>
                    </TouchableOpacity>

                    {isPayer &&
                      (pending ? (
                        <View style={st.sentBadge}>
                          <Ionicons name="time" size={14} color="#92400E" />
                          <Text style={st.sentTxt}>Sent</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={st.payBtn}
                          onPress={() =>
                            sendSettlementRequest(txn.to, txn.amount)
                          }
                          disabled={processing}
                        >
                          <Ionicons name="paper-plane" size={14} color="#fff" />
                          <Text style={st.payBtnTxt}>Pay</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                );
              })}
            </View>
          </View>
        ) : expenses.length > 0 ? (
          <View style={st.settledBox}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>🎉</Text>
            <Text style={st.settledTitle}>All Settled Up!</Text>
            <Text style={st.settledSub}>
              Everyone has paid their fair share.
            </Text>
          </View>
        ) : null}

        {/* You Owe */}
        {iShouldPay.map((txn, idx) => {
          const pending = hasPendingRequest(user.uid, txn.to);
          const recipientData = membersMap[txn.to];
          const hasUPI = !!recipientData?.upiId;

          return (
            <View
              key={idx}
              style={[
                st.card,
                { borderLeftWidth: 4, borderLeftColor: "#EF4444" },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() =>
                    setPaymentInfoMember({
                      memberData: recipientData,
                      amount: txn.amount,
                    })
                  }
                  activeOpacity={0.6}
                >
                  <View style={[st.oweAvatar, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={st.oweAvatarTxt}>
                      {memberName(txn.to)[0].toUpperCase()}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, marginLeft: 12 }}
                  onPress={() =>
                    setPaymentInfoMember({
                      memberData: recipientData,
                      amount: txn.amount,
                    })
                  }
                  activeOpacity={0.6}
                >
                  <Text style={st.cardName}>
                    {memberName(txn.to)}{" "}
                    {hasUPI && (
                      <Text style={{ fontSize: 13, color: "#6366F1" }}>💳</Text>
                    )}
                  </Text>
                  <Text style={[st.cardAmt, { color: "#EF4444" }]}>
                    {sym}
                    {txn.amount.toFixed(2)}
                  </Text>
                  {hasUPI && <Text style={st.tapHint}>Tap to pay via UPI</Text>}
                </TouchableOpacity>

                {pending ? (
                  <View style={st.pendingActions}>
                    <View style={st.sentBadge}>
                      <Ionicons name="time" size={14} color="#92400E" />
                      <Text style={st.sentTxt}>Pending</Text>
                    </View>
                    {/* ✅ WhatsApp reminder */}
                    <TouchableOpacity
                      style={st.whatsappSmallBtn}
                      onPress={() =>
                        shareViaWhatsApp(memberName(txn.to), txn.amount, sym)
                      }
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={18}
                        color="#25D366"
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={st.cardBtns}>
                    {/* ✅ UPI Direct Pay */}
                    {hasUPI && (
                      <TouchableOpacity
                        style={st.upiPayBtn}
                        onPress={() =>
                          openUPIPayment(
                            recipientData.upiId,
                            memberName(txn.to),
                            txn.amount,
                          )
                        }
                      >
                        <Text style={st.upiPayBtnIcon}>₹</Text>
                        <Text style={st.upiPayBtnTxt}>Pay UPI</Text>
                      </TouchableOpacity>
                    )}

                    {/* Settlement Request */}
                    <TouchableOpacity
                      style={st.settleBtn}
                      onPress={() => sendSettlementRequest(txn.to, txn.amount)}
                      disabled={processing}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#fff"
                      />
                      <Text style={st.settleBtnTxt}>Settle</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Proof attachment - only show if not pending */}
              {!pending && (
                <View style={st.proofRow}>
                  {hasFeature("paymentProof") ? (
                    <TouchableOpacity
                      style={st.proofAttachBtn}
                      onPress={handleAttachProof}
                    >
                      <Ionicons
                        name="camera"
                        size={15}
                        color="#6366F1"
                        style={{ marginRight: 5 }}
                      />
                      <Text style={st.proofAttachTxt}>
                        {proofPhotoUri ? "✅ Proof attached" : "Attach proof"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={st.proofLockedBtn}
                      onPress={handleAttachProof}
                    >
                      <Ionicons
                        name="lock-closed"
                        size={13}
                        color="#F59E0B"
                        style={{ marginRight: 5 }}
                      />
                      <Text style={st.proofLockedTxt}>Attach proof</Text>
                      <View style={st.proofProBadge}>
                        <Text style={st.proofProBadgeTxt}>PRO</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {proofPhotoUri && hasFeature("paymentProof") && (
                    <TouchableOpacity
                      onPress={() => setProofPhotoUri(null)}
                      style={{ marginLeft: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {proofPhotoUri && hasFeature("paymentProof") && !pending && (
                <TouchableOpacity
                  onPress={() => setViewingProof(proofPhotoUri)}
                  style={{ marginTop: 6 }}
                >
                  <Image
                    source={{ uri: proofPhotoUri }}
                    style={st.proofThumb}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Owes You */}
        {shouldPayMe.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="arrow-down-circle" size={20} color="#10B981" />
              <Text
                style={[st.sectionTitle, { color: "#10B981", marginLeft: 8 }]}
              >
                Owes You
              </Text>
            </View>
            {shouldPayMe.map((txn, idx) => {
              const pending = hasPendingRequest(txn.from, user.uid);
              return (
                <View
                  key={idx}
                  style={[
                    st.card,
                    { borderLeftWidth: 4, borderLeftColor: "#10B981" },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={[st.oweAvatar, { backgroundColor: "#D1FAE5" }]}
                    >
                      <Text style={st.oweAvatarTxt}>
                        {memberName(txn.from)[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={st.cardName}>{memberName(txn.from)}</Text>
                      <Text style={[st.cardAmt, { color: "#10B981" }]}>
                        {sym}
                        {txn.amount.toFixed(2)}
                      </Text>
                    </View>
                    {pending && (
                      <View style={st.sentBadge}>
                        <Ionicons name="time" size={14} color="#92400E" />
                        <Text style={st.sentTxt}>Pending</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Pending – Action Required */}
        {requestsToMe.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text
                style={[st.sectionTitle, { color: "#DC2626", marginLeft: 8 }]}
              >
                Action Required ({requestsToMe.length})
              </Text>
            </View>
            {requestsToMe.map((r) => (
              <View key={r.id} style={[st.card, st.cardUrgent]}>
                <Text style={st.cardName}>{r.fromName} wants to settle</Text>
                <Text style={st.cardAmt}>
                  {sym}
                  {r.amount.toFixed(2)}
                </Text>
                <Text style={st.cardDate}>{fmtDate(r.createdAt)}</Text>
                {r.proofPhotoUri && (
                  <View style={{ marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#6B7280",
                        marginBottom: 6,
                      }}
                    >
                      📸 Payment proof attached:
                    </Text>
                    <TouchableOpacity
                      onPress={() => setViewingProof(r.proofPhotoUri)}
                    >
                      <Image
                        source={{ uri: r.proofPhotoUri }}
                        style={st.proofThumb}
                        resizeMode="cover"
                      />
                      <Text
                        style={{ fontSize: 11, color: "#6366F1", marginTop: 4 }}
                      >
                        Tap to view full size
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={st.cardActions}>
                  <TouchableOpacity
                    style={[st.actionBtn, { backgroundColor: "#10B981" }]}
                    onPress={() => handleConfirm(r)}
                    disabled={processing}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={st.actionBtnTxt}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      st.actionBtn,
                      { backgroundColor: "#EF4444", marginLeft: 10 },
                    ]}
                    onPress={() => handleReject(r)}
                    disabled={processing}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={st.actionBtnTxt}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending – Awaiting Confirmation */}
        {requestsFromMe.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="time" size={20} color="#F59E0B" />
              <Text
                style={[st.sectionTitle, { color: "#D97706", marginLeft: 8 }]}
              >
                Awaiting Confirmation ({requestsFromMe.length})
              </Text>
            </View>
            {requestsFromMe.map((r) => (
              <View
                key={r.id}
                style={[
                  st.card,
                  { borderLeftWidth: 4, borderLeftColor: "#F59E0B" },
                ]}
              >
                <Text style={st.cardName}>Waiting for {r.toName}</Text>
                <Text style={st.cardAmt}>
                  {sym}
                  {r.amount.toFixed(2)}
                </Text>
                <Text style={st.cardDate}>{fmtDate(r.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Settlement History */}
        {confirmedSettlements.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="receipt" size={20} color="#6B7280" />
              <Text style={[st.sectionTitle, { marginLeft: 8 }]}>History</Text>
            </View>
            {confirmedSettlements
              .filter((s) => s.from === user.uid || s.to === user.uid)
              .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt))
              .slice(0, 10)
              .map((s, i) => {
                const paid = s.from === user.uid;
                const other = membersMap[paid ? s.to : s.from];
                return (
                  <View key={s.id || i} style={st.histRow}>
                    <View
                      style={[
                        st.histIcon,
                        { backgroundColor: paid ? "#FEE2E2" : "#D1FAE5" },
                      ]}
                    >
                      <Ionicons
                        name={paid ? "arrow-up" : "arrow-down"}
                        size={16}
                        color={paid ? "#EF4444" : "#10B981"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: "#1F2937" }}>
                        {paid ? "You paid" : "Received from"}{" "}
                        {other?.name || other?.email}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {fmtDate(s.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "bold",
                        color: "#1F2937",
                      }}
                    >
                      {sym}
                      {s.amount.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
          </View>
        )}
      </ScrollView>

      {/* Payment Info Modal */}
      <RNModal
        visible={!!paymentInfoMember}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentInfoMember(null)}
      >
        <TouchableOpacity
          style={st.payModalOverlay}
          activeOpacity={1}
          onPress={() => setPaymentInfoMember(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={st.payModalSheet}
            onPress={() => {}}
          >
            <View style={st.payModalHandle} />
            <View style={st.payModalHeader}>
              <View style={st.payModalAvatar}>
                <Text
                  style={{ fontSize: 20, fontWeight: "bold", color: "#1F2937" }}
                >
                  {(paymentInfoMember?.memberData?.name ||
                    paymentInfoMember?.memberData?.email ||
                    "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.payModalName}>
                  {paymentInfoMember?.memberData?.name ||
                    paymentInfoMember?.memberData?.email ||
                    "Member"}
                </Text>
                <Text style={st.payModalSub}>Payment Details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPaymentInfoMember(null)}
                style={st.payModalClose}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <PaymentInfoCard
              memberData={paymentInfoMember?.memberData}
              amount={paymentInfoMember?.amount}
              currencySymbol={sym}
            />
            {!paymentInfoMember?.memberData?.upiId &&
              !paymentInfoMember?.memberData?.bankAccount &&
              !paymentInfoMember?.memberData?.phone && (
                <View style={st.payModalEmpty}>
                  <Ionicons name="card-outline" size={32} color="#D1D5DB" />
                  <Text style={st.payModalEmptyTxt}>
                    No payment details added yet
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#9CA3AF",
                      textAlign: "center",
                    }}
                  >
                    Ask them to add their UPI or bank details in their Profile
                  </Text>
                </View>
              )}
          </TouchableOpacity>
        </TouchableOpacity>
      </RNModal>

      {/* Full-screen proof photo viewer */}
      <RNModal
        visible={!!viewingProof}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingProof(null)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            justifyContent: "center",
            alignItems: "center",
          }}
          activeOpacity={1}
          onPress={() => setViewingProof(null)}
        >
          {viewingProof && (
            <Image
              source={{ uri: viewingProof }}
              style={{ width: "95%", height: "70%", borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
          <Text
            style={{ color: "#fff", marginTop: 16, fontSize: 13, opacity: 0.7 }}
          >
            Tap anywhere to close
          </Text>
        </TouchableOpacity>
      </RNModal>

      {/* Upload proof overlay */}
      {uploadingProof && (
        <View style={st.uploadOverlay}>
          <View style={st.uploadBox}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={st.uploadTitle}>Uploading payment proof…</Text>
            <Text style={st.uploadSub}>Please wait, do not close the app</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ================================================================
   Styles
   ================================================================ */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9FAFB" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  cardBtns: {
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
  upiPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  upiPayBtnIcon: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  upiPayBtnTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  pendingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  whatsappSmallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8FDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  tapHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  uploadBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 32,
    alignItems: "center",
    width: 280,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  uploadTitle: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  uploadSub: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
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

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryLabel: { fontSize: 13, color: "#6B7280", marginBottom: 6 },
  summaryAmount: { fontSize: 32, fontWeight: "bold" },
  summarySub: { fontSize: 13, color: "#6B7280", marginTop: 4 },

  green: { color: "#10B981" },
  red: { color: "#EF4444" },
  gray: { color: "#6B7280" },

  section: { marginBottom: 24 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", color: "#1F2937" },

  planCard: {
    backgroundColor: "#F5F3FF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
  },
  planDesc: { fontSize: 13, color: "#6B7280", marginBottom: 14 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  planRowHighlight: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
  },
  planAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  planAvatarTxt: { fontSize: 14, fontWeight: "bold", color: "#1F2937" },
  planCenter: { flex: 1, alignItems: "center", marginHorizontal: 8 },
  planFrom: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  planTo: { fontSize: 12, fontWeight: "600", color: "#1F2937", marginTop: 2 },
  planArrowRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  planLine: { flex: 1, height: 1, backgroundColor: "#C4B5FD" },
  planAmtBadge: {
    backgroundColor: "#8B5CF6",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 6,
  },
  planAmtTxt: { color: "#fff", fontSize: 13, fontWeight: "bold" },

  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  payBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "600", marginLeft: 4 },

  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  sentTxt: { color: "#92400E", fontSize: 12, fontWeight: "600", marginLeft: 4 },

  breakdownToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  planActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  upiBtn: {
    backgroundColor: "#5B21B6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  upiBtnTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  whatsappBtn: {
    backgroundColor: "#25D366",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  breakdownToggleTxt: {
    flex: 1,
    color: "#6D28D9",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  breakdownPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  bpStepTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4C1D95",
    marginBottom: 2,
  },
  bpStepSub: { fontSize: 12, color: "#6B7280", marginBottom: 10 },

  bpTable: { borderRadius: 8, overflow: "hidden", marginBottom: 10 },
  bpTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  bpTableRowMe: { backgroundColor: "#F5F3FF" },
  bpHdr: { color: "#9CA3AF", fontWeight: "700", fontSize: 11 },
  bpCell: { fontSize: 12, color: "#1F2937" },
  bpAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
  },
  bpAvatarTxt: { fontSize: 10, fontWeight: "bold", color: "#1F2937" },

  bpLegend: { marginBottom: 4 },
  bpLegendRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  bpDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  bpLegendTxt: { fontSize: 11, color: "#6B7280" },

  bpTxnRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  bpTxnNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#8B5CF6",
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 20,
    marginRight: 8,
    marginTop: 1,
  },
  bpTxnTxt: { fontSize: 13, color: "#1F2937" },

  proofRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#FEE2E2",
  },
  proofAttachBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  proofAttachTxt: { fontSize: 12, color: "#6366F1", fontWeight: "600" },
  proofLockedBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  proofLockedTxt: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  proofProBadge: {
    backgroundColor: "#F59E0B",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 6,
  },
  proofProBadgeTxt: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  proofThumb: { width: "100%", height: 160, borderRadius: 10, marginTop: 6 },

  tapHint: { fontSize: 11, color: "#6366F1", marginTop: 2 },

  payModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  payModalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  payModalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },
  payModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  payModalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  payModalName: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  payModalSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  payModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  payModalEmpty: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  payModalEmptyTxt: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 4,
  },

  oweAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  oweAvatarTxt: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  settleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  settleBtnTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },

  settledBox: {
    backgroundColor: "#D1FAE5",
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  settledTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#047857",
    marginBottom: 4,
  },
  settledSub: { fontSize: 14, color: "#065F46", textAlign: "center" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUrgent: { borderLeftWidth: 4, borderLeftColor: "#6366F1" },
  cardName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  cardAmt: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#6366F1",
    marginBottom: 2,
  },
  cardDate: { fontSize: 12, color: "#9CA3AF", marginBottom: 12 },
  cardActions: { flexDirection: "row" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },

  histRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  histIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
});
