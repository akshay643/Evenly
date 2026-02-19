import React, { useState, useEffect, useContext } from 'react';
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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.config';
import { AuthContext } from '../context/AuthContext';
import * as Contacts from 'expo-contacts';

export default function GroupScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [searchingMember, setSearchingMember] = useState(false);
  const [foundUser, setFoundUser] = useState(null);          // preview before confirming add
  const [membersData, setMembersData] = useState([]);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMemberForRole, setSelectedMemberForRole] = useState(null);
  const [contactSuggestions, setContactSuggestions] = useState([]);

  // Helper: convert Firestore timestamp / Date.now() millis / ISO string to JS Date
  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();                    // Firestore Timestamp
    if (ts.seconds) return new Date(ts.seconds * 1000);   // raw Firestore object
    if (typeof ts === 'number') return new Date(ts);       // Date.now() millis
    return new Date(ts);                                   // ISO string fallback
  };

  useEffect(() => {
    let unsubExpenses;
    let unsubSettlements;
    let unsubConfirmedSettlements;

    const init = async () => {
      // 1. Fetch group doc
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) { setLoading(false); return; }

      const groupData = { id: groupDoc.id, ...groupDoc.data() };
      setGroup(groupData);

      // 2. Fetch member profiles
      const members = await Promise.all(
        (groupData.members || []).map(async (mid) => {
          const d = await getDoc(doc(db, 'users', mid));
          return d.exists() ? { id: mid, ...d.data() } : { id: mid, email: 'Unknown' };
        })
      );
      setMembersData(members);

      // 3. Listen to expenses (realtime)
      const expQ = query(collection(db, 'expenses'), where('groupId', '==', groupId));
      unsubExpenses = onSnapshot(expQ, (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
        setExpenses(list);
      });

      // 4. Listen to confirmed settlements (realtime)
      const settleQ = query(collection(db, 'settlements'), where('groupId', '==', groupId));
      unsubConfirmedSettlements = onSnapshot(settleQ, (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setSettlements(list);
      });

      // 5. Listen to pending settlement requests for this group
      const reqQ = query(
        collection(db, 'settlementRequests'),
        where('groupId', '==', groupId)
      );
      unsubSettlements = onSnapshot(reqQ, (snap) => {
        const reqs = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.status === 'pending') reqs.push({ id: d.id, ...data });
        });
        setPendingSettlements(reqs);
      });

      setLoading(false);
    };

    init();
    return () => { unsubExpenses?.(); unsubSettlements?.(); unsubConfirmedSettlements?.(); };
  }, [groupId]);

  // Recalculate balances when expenses or settlements change
  useEffect(() => {
    calcBalances(expenses, settlements);
  }, [expenses, settlements]);

  const calcBalances = (expenseList, settlementList) => {
    const map = {};
    
    // Calculate from expenses
    expenseList.forEach(({ paidBy, amount, splitBetween }) => {
      if (!paidBy || !splitBetween) return;
      const share = amount / splitBetween.length;
      map[paidBy] = (map[paidBy] || 0) + amount;
      splitBetween.forEach((m) => { map[m] = (map[m] || 0) - share; });
    });

    // Subtract confirmed settlements
    settlementList.forEach(({ from, to, amount }) => {
      if (from && to) {
        map[from] = (map[from] || 0) + amount;  // from paid, so their balance increases
        map[to] = (map[to] || 0) - amount;       // to received, so their balance decreases
      }
    });

    setBalances(map);
  };

  /* ---------- delete group (creator only) ---------- */
  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group?.name}"? This will remove all expenses and settlement data for this group. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all expenses for this group
              const expSnap = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', groupId)));
              const batch = writeBatch(db);
              expSnap.forEach((d) => batch.delete(d.ref));

              // Delete all settlement requests for this group
              const settleSnap = await getDocs(query(collection(db, 'settlementRequests'), where('groupId', '==', groupId)));
              settleSnap.forEach((d) => batch.delete(d.ref));

              // Delete the group doc itself
              batch.delete(doc(db, 'groups', groupId));

              await batch.commit();
              Alert.alert('Deleted', 'Group has been deleted.');
              navigation.goBack();
            } catch (e) {
              console.error('Delete group error:', e);
              Alert.alert('Error', 'Failed to delete group: ' + e.message);
            }
          },
        },
      ]
    );
  };

  /* ---------- ROLES ---------- */
  const ROLES = [
    { key: 'admin',     label: 'Admin',     icon: 'shield',            color: '#8B5CF6', desc: 'Full control — add/remove members, delete group' },
    { key: 'treasurer', label: 'Treasurer', icon: 'cash',              color: '#10B981', desc: 'Can settle up and manage expenses' },
    { key: 'member',    label: 'Member',    icon: 'person',            color: '#6366F1', desc: 'Can add expenses and view balances' },
    { key: 'viewer',    label: 'Viewer',    icon: 'eye',               color: '#F59E0B', desc: 'Read-only — can only view the group' },
  ];

  const getMemberRole = (uid) => {
    if (group?.createdBy === uid) return 'admin';
    return group?.roles?.[uid] || 'member';
  };

  const canManageRoles = () => getMemberRole(user.uid) === 'admin';
  const canAddMembers = () => ['admin', 'treasurer'].includes(getMemberRole(user.uid));
  const canAddExpenses = () => ['admin', 'treasurer', 'member'].includes(getMemberRole(user.uid));

  const handleSetRole = async (uid, role) => {
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        [`roles.${uid}`]: role,
      });
      const updated = await getDoc(doc(db, 'groups', groupId));
      setGroup({ id: updated.id, ...updated.data() });
      setShowRoleModal(false);
      setSelectedMemberForRole(null);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  /* ---------- CONTACTS search ---------- */
  const handlePickFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Allow contacts access in Settings to use this feature.');
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });
    // Flatten to list with name + phone/email
    const suggestions = [];
    data.forEach((c) => {
      (c.phoneNumbers || []).forEach((p) => {
        const normalized = p.number.replace(/\s|-|\(|\)/g, '');
        suggestions.push({ name: c.name, value: normalized, type: 'phone' });
      });
      (c.emails || []).forEach((e) => {
        suggestions.push({ name: c.name, value: e.email.toLowerCase(), type: 'email' });
      });
    });
    setContactSuggestions(suggestions.slice(0, 50));  // show first 50
  };

  /* ---------- SEARCH user (preview before add) ---------- */
  const handleSearchMember = async () => {
    const input = memberInput.trim().toLowerCase();
    if (!input) { Alert.alert('Error', 'Enter an email or phone number'); return; }
    setFoundUser(null);
    setSearchingMember(true);
    try {
      const field = input.includes('@') ? 'email' : 'phone';
      const snap = await getDocs(query(collection(db, 'users'), where(field, '==', input)));
      if (snap.empty) {
        Alert.alert('Not Found', `No Evenly account found with that ${field}.\n\nMake sure they have signed up first.`);
        setSearchingMember(false);
        return;
      }
      const d = snap.docs[0];
      setFoundUser({ id: d.id, ...d.data() });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setSearchingMember(false); }
  };

  /* ---------- CONFIRM add after preview ---------- */
  const handleConfirmAddMember = async () => {
    if (!foundUser) return;
    if (group.members.includes(foundUser.id)) {
      Alert.alert('Already a member');
      setFoundUser(null);
      return;
    }
    setAddingMember(true);
    try {
      const ref = doc(db, 'groups', groupId);
      await updateDoc(ref, { members: arrayUnion(foundUser.id) });
      const updated = await getDoc(ref);
      const g = { id: updated.id, ...updated.data() };
      setGroup(g);
      const mems = await Promise.all(
        g.members.map(async (mid) => {
          const d = await getDoc(doc(db, 'users', mid));
          return d.exists() ? { id: mid, ...d.data() } : { id: mid, email: 'Unknown' };
        })
      );
      setMembersData(mems);
      Alert.alert('Done', `${foundUser.name || foundUser.email} added to the group!`);
      setShowAddMemberModal(false);
      setMemberInput('');
      setFoundUser(null);
      setContactSuggestions([]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setAddingMember(false); }
  };

  /* ---------- helpers ---------- */
  const getMemberName = (uid) => {
    const m = membersData.find((x) => x.id === uid);
    return m?.name || m?.email || 'Unknown';
  };

  const myRequests = pendingSettlements.filter((r) => r.to === user.uid);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const userBalance = balances[user.uid] || 0;

  // Detailed breakdown for current user
  const getCurrencySymbol = () => {
    const currencyMap = {
      USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$'
    };
    return currencyMap[group?.currency] || '₹';
  };

  const getUserBreakdown = () => {
    if (!expenses || !settlements || !user) {
      return { totalPaid: 0, totalShare: 0, settledTo: {}, totalSettled: 0 };
    }

    let totalPaid = 0;
    let totalShare = 0;
    const settledTo = {};

    // Calculate what you paid
    expenses.forEach(({ paidBy, amount, splitBetween }) => {
      if (!paidBy || !amount) return;
      if (paidBy === user.uid) totalPaid += amount;
      if (splitBetween?.includes(user.uid)) {
        totalShare += amount / splitBetween.length;
      }
    });

    // Calculate what you've settled
    settlements.forEach(({ from, to, amount }) => {
      if (!from || !to || !amount) return;
      if (from === user.uid) {
        settledTo[to] = (settledTo[to] || 0) + amount;
      }
    });

    const totalSettled = Object.values(settledTo).reduce((s, a) => s + a, 0);
    return { totalPaid, totalShare, settledTo, totalSettled };
  };

  const breakdown = getUserBreakdown();
  const currencySymbol = getCurrencySymbol();

  /* ---------- render ---------- */
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>;
  if (!group) return <View style={s.center}><Text>Group not found</Text></View>;

  const isCreator = group.createdBy === user.uid;

  return (
    <SafeAreaView style={s.root}>
      {/* ─── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{group.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isCreator && (
            <TouchableOpacity onPress={handleDeleteGroup} style={s.headerBtn}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowAddMemberModal(true)} style={s.headerBtn}>
            <Ionicons name="person-add" size={22} color="#6366F1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Scrollable content ─── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={true}
        bounces={true}
        overScrollMode="always"
      >
        {/* Pending settlement banner */}
        {myRequests.length > 0 && (
          <TouchableOpacity
            style={s.banner}
            onPress={() => navigation.navigate('SettleUp', { groupId })}
          >
            <Ionicons name="notifications" size={20} color="#92400E" style={s.bannerIcon} />
            <Text style={s.bannerText}>
              {myRequests.length} settlement request{myRequests.length > 1 ? 's' : ''} waiting for your confirmation
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#92400E" style={s.bannerIconRight} />
          </TouchableOpacity>
        )}

        {/* Group icon + summary */}
        <View style={s.summary}>
          <Text style={{ fontSize: 56 }}>{group.icon || '👥'}</Text>
          <Text style={s.summaryMembers}>{group.members.length} members  •  {expenses.length} expenses</Text>
          <Text style={s.summaryTotal}>Total spent: {currencySymbol}{totalExpenses.toFixed(2)}</Text>
        </View>

        {/* Your detailed balance breakdown */}
        <View style={s.balanceCard}>
          <View style={s.balanceHeader}>
            <Text style={s.balanceLabel}>Your Summary</Text>
            
            {/* Net balance */}
            <Text style={[
              s.balanceAmt,
              userBalance > 0.01 ? s.green : userBalance < -0.01 ? s.red : s.gray
            ]}>
              {userBalance > 0.01 ? `+${currencySymbol}${userBalance.toFixed(2)}`
                : userBalance < -0.01 ? `-${currencySymbol}${Math.abs(userBalance).toFixed(2)}`
                : 'Settled up ✓'}
            </Text>
            <Text style={s.balanceSub}>
              {userBalance > 0.01 ? 'Others owe you' : userBalance < -0.01 ? 'You owe others' : 'All settled!'}
            </Text>
          </View>

          {/* Breakdown */}
          <View style={s.breakdownContainer}>
            <View style={s.breakdownDivider} />
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>💰 You paid</Text>
              <Text style={s.breakdownValue}>{currencySymbol}{breakdown.totalPaid.toFixed(2)}</Text>
            </View>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>📊 Your share</Text>
              <Text style={s.breakdownValue}>{currencySymbol}{breakdown.totalShare.toFixed(2)}</Text>
            </View>
            {breakdown.totalSettled > 0 && (
              <View style={s.breakdownRow}>
                <Text style={s.breakdownLabel}>✅ Settled</Text>
                <Text style={[s.breakdownValue, s.green]}>{currencySymbol}{breakdown.totalSettled.toFixed(2)}</Text>
              </View>
            )}
            
            {/* Show who you settled with */}
            {Object.keys(breakdown.settledTo).length > 0 && (
              <View style={s.settledList}>
                {Object.entries(breakdown.settledTo).map(([toId, amt]) => (
                  <Text key={toId} style={s.settledItem}>
                    • Paid {currencySymbol}{amt.toFixed(2)} to {getMemberName(toId)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.navigate('AddExpense', { groupId, groupName: group.name })}>
            <Ionicons name="add-circle" size={20} color="#fff" style={s.btnPrimaryIcon} />
            <Text style={s.btnPrimaryTxt}>Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={() => navigation.navigate('SettleUp', { groupId })}>
            <Ionicons name="wallet" size={20} color="#6366F1" style={s.btnOutlineIcon} />
            <Text style={s.btnOutlineTxt}>Settle Up</Text>
          </TouchableOpacity>
        </View>

        {/* Members */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Members ({membersData.length})</Text>
          {membersData.map((m) => {
            const role = getMemberRole(m.id);
            const roleInfo = ROLES.find(r => r.key === role) || ROLES[2];
            return (
              <View key={m.id} style={s.memberRow}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{(m.name || m.email || '?')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{m.name || 'User'}</Text>
                  <Text style={s.memberEmail}>{m.email}</Text>
                </View>
                {/* Role badge */}
                <View style={[s.roleBadge, { backgroundColor: roleInfo.color + '20', borderColor: roleInfo.color }]}>
                  <Ionicons name={roleInfo.icon} size={12} color={roleInfo.color} style={{ marginRight: 3 }} />
                  <Text style={[s.roleBadgeTxt, { color: roleInfo.color }]}>{roleInfo.label}</Text>
                </View>
                {m.id === user.uid && <View style={[s.youBadge, { marginLeft: 6 }]}><Text style={s.youBadgeTxt}>You</Text></View>}
                {/* Admin can change roles of others */}
                {canManageRoles() && m.id !== user.uid && (
                  <TouchableOpacity
                    style={s.roleEditBtn}
                    onPress={() => { setSelectedMemberForRole(m); setShowRoleModal(true); }}
                  >
                    <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Expenses */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Expenses ({expenses.length})</Text>

          {expenses.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>💸</Text>
              <Text style={s.emptyTitle}>No expenses yet</Text>
              <Text style={s.emptyBody}>Tap "Add Expense" to get started</Text>
            </View>
          ) : (
            expenses.map((exp) => {
              const share = exp.amount / (exp.splitBetween?.length || 1);
              const isPayer = exp.paidBy === user.uid;
              const isInvolved = exp.splitBetween?.includes(user.uid);
              const d = toDate(exp.createdAt);
              const dateStr = d.getTime() > 0
                ? d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                : '';
              return (
                <View key={exp.id} style={s.expCard}>
                  <View style={s.expLeft}>
                    <View style={s.expIcon}><Text style={{ fontSize: 18 }}>💰</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.expDesc}>{exp.description}</Text>
                      <Text style={s.expMeta}>
                        Paid by {isPayer ? 'you' : (exp.paidByEmail || getMemberName(exp.paidBy))}
                        {dateStr ? `  •  ${dateStr}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.expAmt}>{currencySymbol}{exp.amount.toFixed(2)}</Text>
                    {isPayer && <Text style={[s.expTag, s.green]}>You paid</Text>}
                    {!isPayer && isInvolved && <Text style={[s.expTag, s.red]}>You owe {currencySymbol}{share.toFixed(2)}</Text>}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ─── Add Member Modal ─── */}
      <Modal visible={showAddMemberModal} transparent animationType="slide" onRequestClose={() => { setShowAddMemberModal(false); setFoundUser(null); setContactSuggestions([]); }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => { setShowAddMemberModal(false); setFoundUser(null); setContactSuggestions([]); }}
          />
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Add Member</Text>
              <TouchableOpacity onPress={() => { setShowAddMemberModal(false); setFoundUser(null); setContactSuggestions([]); }}>
                <Ionicons name="close" size={26} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Search input row */}
            <View style={s.searchRow}>
              <TextInput
                style={[s.modalInput, { flex: 1, marginBottom: 0 }]}
                placeholder="Email or phone number"
                value={memberInput}
                onChangeText={(t) => {
                  setMemberInput(t);
                  setFoundUser(null);
                  // filter contact suggestions as user types
                  if (t.length >= 2) {
                    const q = t.toLowerCase();
                    const all = contactSuggestions.length > 0 ? contactSuggestions : [];
                    setContactSuggestions(prev => prev.filter(c =>
                      c.name?.toLowerCase().includes(q) || c.value?.includes(q)
                    ));
                  }
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={handleSearchMember}
              />
              <TouchableOpacity style={s.searchBtn} onPress={handleSearchMember} disabled={searchingMember}>
                {searchingMember
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="search" size={20} color="#fff" />}
              </TouchableOpacity>
            </View>

            {/* Contacts button */}
            <TouchableOpacity style={s.contactsBtn} onPress={handlePickFromContacts}>
              <Ionicons name="people" size={18} color="#6366F1" style={{ marginRight: 8 }} />
              <Text style={s.contactsBtnTxt}>Search from Contacts</Text>
            </TouchableOpacity>

            {/* Contact suggestions list */}
            {contactSuggestions.length > 0 && !foundUser && (
              <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                {contactSuggestions.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.suggRow}
                    onPress={() => {
                      setMemberInput(c.value);
                      setContactSuggestions([]);
                      setFoundUser(null);
                    }}
                  >
                    <View style={s.suggAvatar}>
                      <Text style={s.suggAvatarTxt}>{(c.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, color: '#1F2937', fontWeight: '600' }}>{c.name}</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>{c.value}</Text>
                    </View>
                    <Ionicons name="arrow-forward-outline" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* ── User preview card ── */}
            {foundUser && (
              <View style={s.previewCard}>
                <View style={s.previewHead}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={s.previewHeadTxt}>User found — verify before adding</Text>
                </View>
                <View style={s.previewBody}>
                  <View style={s.previewAvatar}>
                    <Text style={s.previewAvatarTxt}>{(foundUser.name || foundUser.email || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.previewName}>{foundUser.name || 'No name set'}</Text>
                    <Text style={s.previewEmail}>{foundUser.email}</Text>
                    {foundUser.phone && <Text style={s.previewPhone}>📱 {foundUser.phone}</Text>}
                  </View>
                </View>
                <View style={s.previewActions}>
                  <TouchableOpacity
                    style={[s.modalBtn, { flex: 1, flexDirection: 'row', marginBottom: 0 }]}
                    onPress={handleConfirmAddMember}
                    disabled={addingMember}
                  >
                    {addingMember
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <Ionicons name="person-add" size={18} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={s.modalBtnTxt}>Add to Group</Text>
                        </>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.previewReject}
                    onPress={() => { setFoundUser(null); setMemberInput(''); }}
                  >
                    <Ionicons name="close" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!foundUser && (
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10, textAlign: 'center' }}>
                Enter their email or phone, tap 🔍, verify the person, then confirm to add.
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Role Assignment Modal ─── */}
      <Modal visible={showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
        <View style={s.roleOverlay}>
          <View style={s.roleSheet}>
            <View style={s.modalHead}>
              <View>
                <Text style={s.modalTitle}>Assign Role</Text>
                {selectedMemberForRole && (
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                    {selectedMemberForRole.name || selectedMemberForRole.email}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                <Ionicons name="close" size={26} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Choose the role for this member. Roles control what actions they can perform in the group.
            </Text>
            {ROLES.map((r) => {
              const current = selectedMemberForRole ? getMemberRole(selectedMemberForRole.id) : null;
              const isActive = current === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[s.roleOption, isActive && { borderColor: r.color, backgroundColor: r.color + '10' }]}
                  onPress={() => handleSetRole(selectedMemberForRole.id, r.key)}
                >
                  <View style={[s.roleOptionIcon, { backgroundColor: r.color + '20' }]}>
                    <Ionicons name={r.icon} size={20} color={r.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.roleOptionLabel, isActive && { color: r.color }]}>{r.label}</Text>
                    <Text style={s.roleOptionDesc}>{r.desc}</Text>
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
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,  paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#1F2937' },

  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', margin: 16, marginBottom: 0, padding: 14, borderRadius: 12 },
  bannerIcon: { marginRight: 8 },
  bannerIconRight: { marginLeft: 8 },
  bannerText: { flex: 1, fontSize: 14, color: '#92400E', fontWeight: '500' },

  summary: { alignItems: 'center', paddingVertical: 16 },
  summaryMembers: { fontSize: 14, color: '#6B7280', marginTop: 6 },
  summaryTotal: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  balanceCard: { 
    backgroundColor: '#fff', 
    marginHorizontal: 20, 
    padding: 24, 
    borderRadius: 14, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 6, 
    elevation: 3 
  },
  balanceHeader: {
    alignItems: 'center',
    width: '100%',
  },
  balanceLabel: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  balanceAmt: { fontSize: 34, fontWeight: 'bold' },
  balanceSub: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  breakdownContainer: {
    width: '100%',
  },
  breakdownDivider: { width: '100%', height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 8 },
  breakdownLabel: { fontSize: 14, color: '#6B7280' },
  breakdownValue: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  settledList: { width: '100%', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  settledItem: { fontSize: 12, color: '#6B7280', marginVertical: 2 },

  green: { color: '#10B981' },
  red: { color: '#EF4444' },
  gray: { color: '#6B7280' },

  actions: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 18, marginBottom: 10 },
  btnPrimary: { flex: 1, flexDirection: 'row', backgroundColor: '#6366F1', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  btnPrimaryIcon: { marginRight: 6 },
  btnPrimaryTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnOutline: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#6366F1', marginLeft: 5 },
  btnOutlineIcon: { marginRight: 6 },
  btnOutlineTxt: { color: '#6366F1', fontSize: 15, fontWeight: '600' },

  section: { paddingHorizontal: 20, paddingTop: 18 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },

  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  memberEmail: { fontSize: 12, color: '#6B7280' },
  youBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  youBadgeTxt: { fontSize: 11, color: '#1E40AF', fontWeight: '700' },

  expCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  expLeft: { flexDirection: 'row', flex: 1, alignItems: 'center', marginRight: 10 },
  expIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  expDesc: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  expMeta: { fontSize: 12, color: '#9CA3AF' },
  expAmt: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  expTag: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  emptyBody: { fontSize: 14, color: '#6B7280' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 18 },
  modalInput: { backgroundColor: '#F3F4F6', padding: 14, borderRadius: 10, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  modalBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  modalBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },

  /* ── search row ── */
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  searchBtn: { backgroundColor: '#6366F1', padding: 14, borderRadius: 10, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },

  /* ── contacts button ── */
  contactsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#C7D2FE' },
  contactsBtnTxt: { color: '#6366F1', fontWeight: '600', fontSize: 14 },

  /* ── contact suggestions ── */
  suggRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  suggAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  suggAvatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  /* ── user preview card ── */
  previewCard: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1.5, borderColor: '#10B981' },
  previewHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  previewHeadTxt: { fontSize: 13, fontWeight: '700', color: '#065F46' },
  previewBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  previewAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  previewAvatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  previewName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  previewEmail: { fontSize: 13, color: '#6B7280' },
  previewPhone: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  previewActions: { flexDirection: 'row', alignItems: 'center' },
  previewReject: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },

  /* ── role badge on member row ── */
  roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginLeft: 6 },
  roleBadgeTxt: { fontSize: 11, fontWeight: '700' },
  roleEditBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

  /* ── role assignment modal ── */
  roleOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  roleSheet: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  roleOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 10 },
  roleOptionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  roleOptionLabel: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  roleOptionDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});