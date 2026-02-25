// src/screens/ActivityScreen.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ActivityScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupsMap, setGroupsMap] = useState({});
  const [membersMap, setMembersMap] = useState({});
  const [filter, setFilter] = useState('all'); // 'all' | 'expenses' | 'settlements'

  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === 'number') return new Date(ts);
    return new Date(ts);
  };

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Get all groups user is part of
      const gSnap = await getDocs(
        query(collection(db, 'groups'), where('members', 'array-contains', user.uid))
      );
      const gMap = {};
      const allMemberIds = new Set();
      gSnap.forEach((d) => {
        const data = d.data();
        gMap[d.id] = { id: d.id, ...data };
        (data.members || []).forEach((mid) => allMemberIds.add(mid));
      });
      setGroupsMap(gMap);

      // 2. Fetch all member profiles
      const mMap = {};
      const memberPromises = Array.from(allMemberIds).map(async (mid) => {
        const mDoc = await getDoc(doc(db, 'users', mid));
        mMap[mid] = mDoc.exists()
          ? { id: mid, ...mDoc.data() }
          : { id: mid, name: null, email: 'Unknown' };
      });
      await Promise.all(memberPromises);
      setMembersMap(mMap);

      const groupIds = Object.keys(gMap);
      if (groupIds.length === 0) {
        setActivities([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Firestore 'in' supports max 10 values — chunk if needed
      const chunks = [];
      for (let i = 0; i < groupIds.length; i += 10) {
        chunks.push(groupIds.slice(i, i + 10));
      }

      const allActivities = [];

      // 3. Fetch expenses from all groups
      for (const chunk of chunks) {
        const expSnap = await getDocs(
          query(
            collection(db, 'expenses'),
            where('groupId', 'in', chunk),
          )
        );
        expSnap.forEach((d) => {
          const data = d.data();
          allActivities.push({
            id: d.id,
            type: 'expense',
            timestamp: toDate(data.createdAt),
            ...data,
          });
        });
      }

      // 4. Fetch confirmed settlements
      for (const chunk of chunks) {
        const setSnap = await getDocs(
          query(
            collection(db, 'settlements'),
            where('groupId', 'in', chunk),
          )
        );
        setSnap.forEach((d) => {
          const data = d.data();
          allActivities.push({
            id: d.id,
            type: 'settlement',
            timestamp: toDate(data.createdAt),
            ...data,
          });
        });
      }

      // 5. Fetch settlement requests (pending + confirmed + rejected)
      for (const chunk of chunks) {
        const reqSnap = await getDocs(
          query(
            collection(db, 'settlementRequests'),
            where('groupId', 'in', chunk),
          )
        );
        reqSnap.forEach((d) => {
          const data = d.data();
          // Only show if it involves the current user
          if (data.from === user.uid || data.to === user.uid) {
            allActivities.push({
              id: `req-${d.id}`,
              type: 'request',
              timestamp: toDate(data.createdAt),
              ...data,
            });
          }
        });
      }

      // Sort by timestamp descending
      allActivities.sort((a, b) => b.timestamp - a.timestamp);

      setActivities(allActivities);
      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      console.error('Activity load error:', e);
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ─── Helpers ───
  const getMemberName = (uid) => {
    if (uid === user.uid) return 'You';
    const m = membersMap[uid];
    return m?.name || m?.email?.split('@')[0] || 'Unknown';
  };

  const getGroupName = (gid) => groupsMap[gid]?.name || 'Unknown Group';
  const getGroupIcon = (gid) => groupsMap[gid]?.icon || '👥';

  const formatTime = (date) => {
    if (!date || date.getTime() === 0) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCurrencySymbol = (gid) => {
    const map = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$' };
    return map[groupsMap[gid]?.currency] || '₹';
  };

  // ─── Filter ───
  const filteredActivities = activities.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'expenses') return a.type === 'expense';
    if (filter === 'settlements') return a.type === 'settlement' || a.type === 'request';
    return true;
  });

  // ─── Group by date ───
  const groupByDate = (items) => {
    const sections = [];
    let lastDateStr = '';

    items.forEach((item) => {
      const d = item.timestamp;
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateStr;
      if (d.toDateString() === now.toDateString()) {
        dateStr = 'Today';
      } else if (d.toDateString() === yesterday.toDateString()) {
        dateStr = 'Yesterday';
      } else {
        dateStr = d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
      }

      if (dateStr !== lastDateStr) {
        sections.push({ type: 'header', title: dateStr, id: `header-${dateStr}-${item.id}` });
        lastDateStr = dateStr;
      }
      sections.push(item);
    });

    return sections;
  };

  const sectionedData = groupByDate(filteredActivities);

  // ─── Render item ───
  const renderItem = ({ item }) => {
    // Date header
    if (item.type === 'header') {
      return (
        <View style={s.dateHeader}>
          <View style={s.dateLine} />
          <Text style={s.dateHeaderText}>{item.title}</Text>
          <View style={s.dateLine} />
        </View>
      );
    }

    const sym = getCurrencySymbol(item.groupId);

    // ── Expense ──
    if (item.type === 'expense') {
      const isMe = item.paidBy === user.uid;
      const isInvolved = item.splitBetween?.includes(user.uid);
      const share = item.amount / (item.splitBetween?.length || 1);
      const youGetBack = isMe ? item.amount - share : 0;

      return (
        <TouchableOpacity
          style={s.card}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Group', { groupId: item.groupId })}
        >
          <View style={[s.cardIcon, { backgroundColor: '#EEF2FF' }]}>
            <Text style={{ fontSize: 22 }}>{getGroupIcon(item.groupId)}</Text>
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={s.cardTopRow}>
              <Text style={s.cardGroupName}>{getGroupName(item.groupId)}</Text>
              <Text style={s.cardTime}>{formatTime(item.timestamp)}</Text>
            </View>

            <Text style={s.cardDesc} numberOfLines={1}>{item.description}</Text>

            <View style={s.cardBottomRow}>
              <Text style={s.cardPaidBy}>
                {isMe ? 'You' : getMemberName(item.paidBy)} paid
              </Text>
              <Text style={s.cardAmount}>{sym}{item.amount.toFixed(2)}</Text>
            </View>

            {/* Your involvement */}
            {isMe && isInvolved && (
              <View style={[s.involveBadge, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="arrow-down" size={12} color="#065F46" style={{ marginRight: 4 }} />
                <Text style={[s.involveText, { color: '#065F46' }]}>
                  You get back {sym}{youGetBack.toFixed(2)}
                </Text>
              </View>
            )}
            {!isMe && isInvolved && (
              <View style={[s.involveBadge, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="arrow-up" size={12} color="#991B1B" style={{ marginRight: 4 }} />
                <Text style={[s.involveText, { color: '#991B1B' }]}>
                  You owe {sym}{share.toFixed(2)}
                </Text>
              </View>
            )}
            {!isMe && !isInvolved && (
              <View style={[s.involveBadge, { backgroundColor: '#F3F4F6' }]}>
                <Text style={[s.involveText, { color: '#9CA3AF' }]}>Not involved</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // ── Settlement (confirmed) ──
    if (item.type === 'settlement') {
      const isPayer = item.from === user.uid;
      return (
        <TouchableOpacity
          style={s.card}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Group', { groupId: item.groupId })}
        >
          <View style={[s.cardIcon, { backgroundColor: isPayer ? '#FEF3C7' : '#D1FAE5' }]}>
            <Ionicons
              name={isPayer ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={24}
              color={isPayer ? '#D97706' : '#059669'}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={s.cardTopRow}>
              <Text style={s.cardGroupName}>{getGroupName(item.groupId)}</Text>
              <Text style={s.cardTime}>{formatTime(item.timestamp)}</Text>
            </View>

            <Text style={s.cardDesc}>
              {isPayer
                ? `You paid ${getMemberName(item.to)}`
                : `${getMemberName(item.from)} paid you`}
            </Text>

            <View style={s.cardBottomRow}>
              <View style={[s.settleBadge, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#059669' }}>Confirmed</Text>
              </View>
              <Text style={[s.cardAmount, { color: isPayer ? '#D97706' : '#059669' }]}>
                {sym}{item.amount.toFixed(2)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // ── Settlement Request ──
    if (item.type === 'request') {
      const isFromMe = item.from === user.uid;
      const statusConfig = {
        pending: { color: '#F59E0B', bg: '#FEF3C7', icon: 'time', label: 'Pending' },
        confirmed: { color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle', label: 'Confirmed' },
        rejected: { color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle', label: 'Rejected' },
      };
      const sc = statusConfig[item.status] || statusConfig.pending;

      return (
        <TouchableOpacity
          style={s.card}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('SettleUp', { groupId: item.groupId })}
        >
          <View style={[s.cardIcon, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon} size={24} color={sc.color} />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={s.cardTopRow}>
              <Text style={s.cardGroupName}>{getGroupName(item.groupId)}</Text>
              <Text style={s.cardTime}>{formatTime(item.timestamp)}</Text>
            </View>

            <Text style={s.cardDesc}>
              {isFromMe
                ? `You requested ${sym}${item.amount.toFixed(2)} from ${item.toName || getMemberName(item.to)}`
                : `${item.fromName || getMemberName(item.from)} sent you ${sym}${item.amount.toFixed(2)}`}
            </Text>

            <View style={s.cardBottomRow}>
              <View style={[s.settleBadge, { backgroundColor: sc.bg }]}>
                <Ionicons name={sc.icon} size={14} color={sc.color} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: sc.color }}>{sc.label}</Text>
              </View>
              <Text style={s.cardAmount}>{sym}{item.amount.toFixed(2)}</Text>
            </View>

            {/* Action hint for pending requests to me */}
            {item.status === 'pending' && !isFromMe && (
              <View style={[s.involveBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="alert-circle" size={12} color="#92400E" style={{ marginRight: 4 }} />
                <Text style={[s.involveText, { color: '#92400E' }]}>
                  Tap to confirm or reject
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading activity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Activity</Text>
        <Text style={s.headerSub}>
          {activities.length} event{activities.length !== 1 ? 's' : ''} across{' '}
          {Object.keys(groupsMap).length} group{Object.keys(groupsMap).length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter pills */}
      <View style={s.filterRow}>
        {[
          { key: 'all',         label: 'All',         icon: 'list' },
          { key: 'expenses',    label: 'Expenses',    icon: 'receipt-outline' },
          { key: 'settlements', label: 'Settlements', icon: 'swap-horizontal-outline' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterPill, filter === f.key && s.filterPillActive]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons
              name={f.icon}
              size={14}
              color={filter === f.key ? '#fff' : '#6366F1'}
              style={{ marginRight: 5 }}
            />
            <Text style={[s.filterPillText, filter === f.key && s.filterPillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activity list */}
      <FlatList
        data={sectionedData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>📭</Text>
            <Text style={s.emptyTitle}>No activity yet</Text>
            <Text style={s.emptyBody}>
              Expenses, settlements, and updates{'\n'}from your groups will appear here
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Ionicons name="people" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={s.emptyBtnText}>Go to Groups</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* ── Header ── */
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },

  /* ── Filter pills ── */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  filterPillTextActive: {
    color: '#fff',
  },

  /* ── Date header ── */
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ── Activity card ── */
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardGroupName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  cardDesc: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 4,
    marginBottom: 6,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPaidBy: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  /* ── Involvement badge ── */
  involveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  involveText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── Settlement badge ── */
  settleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  /* ── Empty state ── */
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});