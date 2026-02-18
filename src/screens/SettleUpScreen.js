import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import {
  doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { minimizeTransactions, calcNetBalances } from '../utils/minimizeTransactions';

/* ================================================================
   SettleUpScreen — Splitwise-style optimised settlements
   ================================================================ */
export default function SettleUpScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useContext(AuthContext);

  const [group, setGroup] = useState(null);
  const [membersMap, setMembersMap] = useState({});       // { uid → { id, name, email } }
  const [expenses, setExpenses] = useState([]);
  const [confirmedSettlements, setConfirmedSettlements] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [optimised, setOptimised] = useState([]);         // minimised transactions
  const [netBalances, setNetBalances] = useState({});      // per-member net balance
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  /* ── helpers ────────────────────────────────────── */
  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === 'number') return new Date(ts);
    return new Date(ts);
  };
  const fmtDate = (ts) => {
    const d = toDate(ts);
    return d.getTime() > 0
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';
  };
  const getCurrencySymbol = useCallback(() => {
    const map = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$' };
    return map[group?.currency] || '₹';
  }, [group]);
  const memberName = (uid) => {
    const m = membersMap[uid];
    return m?.name || m?.email || 'Unknown';
  };

  /* ── loadAll — single function to fetch everything ── */
  const loadAll = useCallback(async () => {
    try {
      // 1 — group
      const gDoc = await getDoc(doc(db, 'groups', groupId));
      if (!gDoc.exists()) { setLoading(false); return; }
      const gData = { id: gDoc.id, ...gDoc.data() };
      setGroup(gData);

      // 2 — members
      const mMap = {};
      for (const mid of gData.members) {
        const d = await getDoc(doc(db, 'users', mid));
        mMap[mid] = d.exists() ? { id: mid, ...d.data() } : { id: mid, email: 'Unknown' };
      }
      setMembersMap(mMap);

      // 3 — expenses
      const expSnap = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', groupId)));
      const exps = [];
      expSnap.forEach((d) => exps.push({ id: d.id, ...d.data() }));
      setExpenses(exps);

      // 4 — confirmed settlements
      const setSnap = await getDocs(query(collection(db, 'settlements'), where('groupId', '==', groupId)));
      const sets = [];
      setSnap.forEach((d) => sets.push({ id: d.id, ...d.data() }));
      setConfirmedSettlements(sets);

      // 5 — compute optimised plan
      const memberIds = gData.members;
      const net = calcNetBalances(exps, sets, memberIds);
      setNetBalances(net);
      const txns = minimizeTransactions(exps, sets, memberIds);
      setOptimised(txns);

      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      console.error('SettleUp load error:', e);
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  /* ── init + realtime pending requests ── */
  useEffect(() => {
    loadAll();

    // Listen to pending requests in realtime
    const rq = query(
      collection(db, 'settlementRequests'),
      where('groupId', '==', groupId),
    );
    const unsub = onSnapshot(rq, (snap) => {
      const reqs = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.status === 'pending') reqs.push({ id: d.id, ...data });
      });
      setPendingRequests(reqs);
    });

    return () => unsub();
  }, [groupId, loadAll]);

  /* ── pull-to-refresh ── */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  /* ================================================================
     Actions
     ================================================================ */

  /** Check if there's already a pending request from→to for this amount */
  const hasPendingRequest = (fromId, toId) =>
    pendingRequests.some((r) => r.from === fromId && r.to === toId);

  const sendSettlementRequest = async (toId, amount) => {
    const toUser = membersMap[toId];
    const fromUser = membersMap[user.uid];
    if (!toUser || !fromUser) { Alert.alert('Error', 'User data not found'); return; }

    // Prevent duplicate requests
    if (hasPendingRequest(user.uid, toId)) {
      Alert.alert(
        'Already Sent',
        `You already have a pending settlement request to ${memberName(toId)}. Wait for them to confirm or reject it first.`
      );
      return;
    }

    const sym = getCurrencySymbol();
    Alert.alert(
      'Send Settlement Request',
      `Send ${sym}${amount.toFixed(2)} to ${memberName(toId)}?\n\nThey'll need to confirm receipt.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setProcessing(true);
            try {
              await addDoc(collection(db, 'settlementRequests'), {
                groupId,
                from: user.uid,
                fromName: fromUser.name || fromUser.email || 'Unknown',
                to: toId,
                toName: toUser.name || toUser.email || 'Unknown',
                amount: parseFloat(amount.toFixed(2)),
                status: 'pending',
                createdAt: Date.now(),
              });
              Alert.alert('Sent!', `Waiting for ${memberName(toId)} to confirm.`);
              await loadAll();  // ← auto-refresh
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally { setProcessing(false); }
          },
        },
      ],
    );
  };

  const handleConfirm = async (req) => {
    const sym = getCurrencySymbol();
    Alert.alert(
      'Confirm Payment',
      `Confirm that ${req.fromName} paid you ${sym}${req.amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setProcessing(true);
            try {
              // Record confirmed settlement
              await addDoc(collection(db, 'settlements'), {
                groupId,
                from: req.from,
                to: req.to,
                amount: req.amount,
                createdAt: Date.now(),
                confirmedBy: user.uid,
              });
              // Mark the request as confirmed
              await updateDoc(doc(db, 'settlementRequests', req.id), {
                status: 'confirmed',
                confirmedAt: Date.now(),
              });
              Alert.alert('Confirmed!', 'Balances updated.');
              await loadAll();  // ← auto-refresh
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally { setProcessing(false); }
          },
        },
      ],
    );
  };

  const handleReject = async (req) => {
    const sym = getCurrencySymbol();
    Alert.alert(
      'Reject',
      `Reject ${sym}${req.amount.toFixed(2)} from ${req.fromName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await updateDoc(doc(db, 'settlementRequests', req.id), {
                status: 'rejected',
                rejectedAt: Date.now(),
              });
              Alert.alert('Rejected', 'The request was rejected.');
              await loadAll();  // ← auto-refresh
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally { setProcessing(false); }
          },
        },
      ],
    );
  };

  /* ================================================================
     Derived data
     ================================================================ */
  const sym = getCurrencySymbol();
  const requestsToMe   = pendingRequests.filter((r) => r.to === user.uid);
  const requestsFromMe = pendingRequests.filter((r) => r.from === user.uid);
  const myBalance = netBalances[user.uid] || 0;

  // From optimised plan: what I owe and what's owed to me
  const iShouldPay    = optimised.filter((t) => t.from === user.uid);
  const shouldPayMe   = optimised.filter((t) => t.to === user.uid);

  if (loading) {
    return <View style={st.center}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <View style={st.root}>
      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBtn}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
      >

        {/* ═══════════ Net Balance Summary ═══════════ */}
        <View style={st.summaryCard}>
          <Text style={st.summaryLabel}>Your Net Balance</Text>
          <Text style={[
            st.summaryAmount,
            myBalance > 0.01 ? st.green : myBalance < -0.01 ? st.red : st.gray,
          ]}>
            {myBalance > 0.01
              ? `+${sym}${myBalance.toFixed(2)}`
              : myBalance < -0.01
                ? `-${sym}${Math.abs(myBalance).toFixed(2)}`
                : 'All settled ✓'}
          </Text>
          <Text style={st.summarySub}>
            {myBalance > 0.01 ? 'Others owe you' : myBalance < -0.01 ? 'You owe others' : 'No pending debts!'}
          </Text>
        </View>

        {/* ═══════════ Optimal Settlement Plan ═══════════ */}
        {optimised.length > 0 ? (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="flash" size={20} color="#8B5CF6" />
              <Text style={[st.sectionTitle, { color: '#8B5CF6', marginLeft: 8 }]}>
                Smart Settlement Plan
              </Text>
            </View>
            <View style={st.planCard}>
              <Text style={st.planDesc}>
                Only {optimised.length} payment{optimised.length > 1 ? 's' : ''} needed to settle everyone:
              </Text>

              {optimised.map((txn, idx) => {
                const isMe = txn.from === user.uid || txn.to === user.uid;
                const isPayer = txn.from === user.uid;
                const pending = hasPendingRequest(txn.from, txn.to);

                return (
                  <View key={idx} style={[st.planRow, isMe && st.planRowHighlight]}>
                    {/* From avatar */}
                    <View style={[st.planAvatar, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={st.planAvatarTxt}>
                        {memberName(txn.from)[0].toUpperCase()}
                      </Text>
                    </View>

                    {/* Arrow + amount */}
                    <View style={st.planCenter}>
                      <Text style={st.planFrom}>
                        {txn.from === user.uid ? 'You' : memberName(txn.from)}
                      </Text>
                      <View style={st.planArrowRow}>
                        <View style={st.planLine} />
                        <View style={st.planAmtBadge}>
                          <Text style={st.planAmtTxt}>{sym}{txn.amount.toFixed(2)}</Text>
                        </View>
                        <View style={st.planLine} />
                        <Ionicons name="arrow-forward" size={14} color="#8B5CF6" />
                      </View>
                      <Text style={st.planTo}>
                        {txn.to === user.uid ? 'You' : memberName(txn.to)}
                      </Text>
                    </View>

                    {/* To avatar */}
                    <View style={[st.planAvatar, { backgroundColor: '#D1FAE5' }]}>
                      <Text style={st.planAvatarTxt}>
                        {memberName(txn.to)[0].toUpperCase()}
                      </Text>
                    </View>

                    {/* Action button (only if current user is the payer) */}
                    {isPayer && (
                      pending ? (
                        <View style={st.sentBadge}>
                          <Ionicons name="time" size={14} color="#92400E" />
                          <Text style={st.sentTxt}>Sent</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={st.payBtn}
                          onPress={() => sendSettlementRequest(txn.to, txn.amount)}
                          disabled={processing}
                        >
                          <Ionicons name="paper-plane" size={14} color="#fff" />
                          <Text style={st.payBtnTxt}>Pay</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : expenses.length > 0 ? (
          /* All settled */
          <View style={st.settledBox}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>🎉</Text>
            <Text style={st.settledTitle}>All Settled Up!</Text>
            <Text style={st.settledSub}>Everyone has paid their fair share.</Text>
          </View>
        ) : null}

        {/* ═══════════ You Owe ═══════════ */}
        {iShouldPay.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="arrow-up-circle" size={20} color="#EF4444" />
              <Text style={[st.sectionTitle, { color: '#EF4444', marginLeft: 8 }]}>
                You Owe
              </Text>
            </View>
            {iShouldPay.map((txn, idx) => {
              const pending = hasPendingRequest(user.uid, txn.to);
              return (
                <View key={idx} style={[st.card, { borderLeftWidth: 4, borderLeftColor: '#EF4444' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[st.oweAvatar, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={st.oweAvatarTxt}>{memberName(txn.to)[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={st.cardName}>{memberName(txn.to)}</Text>
                      <Text style={[st.cardAmt, { color: '#EF4444' }]}>{sym}{txn.amount.toFixed(2)}</Text>
                    </View>
                    {pending ? (
                      <View style={st.sentBadge}>
                        <Ionicons name="time" size={14} color="#92400E" />
                        <Text style={st.sentTxt}>Pending</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={st.settleBtn}
                        onPress={() => sendSettlementRequest(txn.to, txn.amount)}
                        disabled={processing}
                      >
                        <Ionicons name="wallet" size={16} color="#fff" />
                        <Text style={st.settleBtnTxt}>Settle Up</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ═══════════ Owes You ═══════════ */}
        {shouldPayMe.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="arrow-down-circle" size={20} color="#10B981" />
              <Text style={[st.sectionTitle, { color: '#10B981', marginLeft: 8 }]}>
                Owes You
              </Text>
            </View>
            {shouldPayMe.map((txn, idx) => {
              const pending = hasPendingRequest(txn.from, user.uid);
              return (
                <View key={idx} style={[st.card, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[st.oweAvatar, { backgroundColor: '#D1FAE5' }]}>
                      <Text style={st.oweAvatarTxt}>{memberName(txn.from)[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={st.cardName}>{memberName(txn.from)}</Text>
                      <Text style={[st.cardAmt, { color: '#10B981' }]}>{sym}{txn.amount.toFixed(2)}</Text>
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

        {/* ═══════════ Pending – Action Required ═══════════ */}
        {requestsToMe.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={[st.sectionTitle, { color: '#DC2626', marginLeft: 8 }]}>
                Action Required ({requestsToMe.length})
              </Text>
            </View>
            {requestsToMe.map((r) => (
              <View key={r.id} style={[st.card, st.cardUrgent]}>
                <Text style={st.cardName}>{r.fromName} wants to settle</Text>
                <Text style={st.cardAmt}>{sym}{r.amount.toFixed(2)}</Text>
                <Text style={st.cardDate}>{fmtDate(r.createdAt)}</Text>
                <View style={st.cardActions}>
                  <TouchableOpacity
                    style={[st.actionBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => handleConfirm(r)}
                    disabled={processing}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={st.actionBtnTxt}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.actionBtn, { backgroundColor: '#EF4444', marginLeft: 10 }]}
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

        {/* ═══════════ Pending – Awaiting Confirmation ═══════════ */}
        {requestsFromMe.length > 0 && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Ionicons name="time" size={20} color="#F59E0B" />
              <Text style={[st.sectionTitle, { color: '#D97706', marginLeft: 8 }]}>
                Awaiting Confirmation ({requestsFromMe.length})
              </Text>
            </View>
            {requestsFromMe.map((r) => (
              <View key={r.id} style={[st.card, { borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}>
                <Text style={st.cardName}>Waiting for {r.toName}</Text>
                <Text style={st.cardAmt}>{sym}{r.amount.toFixed(2)}</Text>
                <Text style={st.cardDate}>{fmtDate(r.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ═══════════ Settlement History ═══════════ */}
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
                    <View style={[st.histIcon, { backgroundColor: paid ? '#FEE2E2' : '#D1FAE5' }]}>
                      <Ionicons
                        name={paid ? 'arrow-up' : 'arrow-down'}
                        size={16}
                        color={paid ? '#EF4444' : '#10B981'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: '#1F2937' }}>
                        {paid ? 'You paid' : 'Received from'} {other?.name || other?.email}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{fmtDate(s.createdAt)}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1F2937' }}>
                      {sym}{s.amount.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

/* ================================================================
   Styles  (no `gap` — iOS-safe)
   ================================================================ */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#1F2937' },

  /* ── summary card ── */
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  summaryLabel: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  summaryAmount: { fontSize: 32, fontWeight: 'bold' },
  summarySub: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  green: { color: '#10B981' },
  red: { color: '#EF4444' },
  gray: { color: '#6B7280' },

  /* ── section ── */
  section: { marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1F2937' },

  /* ── optimised plan ── */
  planCard: {
    backgroundColor: '#F5F3FF', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#C4B5FD',
  },
  planDesc: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  planRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDE9FE', borderRadius: 10, padding: 12, marginBottom: 10,
  },
  planRowHighlight: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#8B5CF6',
  },
  planAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  planAvatarTxt: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  planCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  planFrom: { fontSize: 12, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  planTo: { fontSize: 12, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  planArrowRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  planLine: { flex: 1, height: 1, backgroundColor: '#C4B5FD' },
  planAmtBadge: {
    backgroundColor: '#8B5CF6', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 6,
  },
  planAmtTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  payBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#6366F1', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8,
  },
  payBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 4 },

  sentBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF3C7', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, marginLeft: 8,
  },
  sentTxt: { color: '#92400E', fontSize: 12, fontWeight: '600', marginLeft: 4 },

  /* ── you owe / owes you ── */
  oweAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  oweAvatarTxt: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  settleBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#6366F1', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  settleBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 6 },

  /* ── all settled ── */
  settledBox: {
    backgroundColor: '#D1FAE5', borderRadius: 14, padding: 28,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: '#10B981',
  },
  settledTitle: { fontSize: 20, fontWeight: 'bold', color: '#047857', marginBottom: 4 },
  settledSub: { fontSize: 14, color: '#065F46', textAlign: 'center' },

  /* ── action-required cards ── */
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardUrgent: { borderLeftWidth: 4, borderLeftColor: '#6366F1' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardAmt: { fontSize: 22, fontWeight: 'bold', color: '#6366F1', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
  cardActions: { flexDirection: 'row' },
  actionBtn: {
    flex: 1, flexDirection: 'row', padding: 12, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 6 },

  /* ── history ── */
  histRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  histIcon: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
});
