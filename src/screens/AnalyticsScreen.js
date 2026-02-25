// src/screens/AnalyticsScreen.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import PremiumGate from '../components/PremiumGate';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Category config
const CATEGORIES = {
  food:          { label: 'Food & Drink',   icon: '🍔', color: '#F59E0B' },
  transport:     { label: 'Transport',      icon: '🚗', color: '#3B82F6' },
  accommodation: { label: 'Accommodation',  icon: '🏨', color: '#8B5CF6' },
  shopping:      { label: 'Shopping',       icon: '🛍️', color: '#EC4899' },
  entertainment: { label: 'Entertainment',  icon: '🎬', color: '#EF4444' },
  groceries:     { label: 'Groceries',      icon: '🛒', color: '#10B981' },
  utilities:     { label: 'Utilities',      icon: '💡', color: '#6366F1' },
  rent:          { label: 'Rent',           icon: '🏠', color: '#14B8A6' },
  medical:       { label: 'Medical',        icon: '🏥', color: '#DC2626' },
  subscriptions: { label: 'Subscriptions',  icon: '📱', color: '#7C3AED' },
  travel:        { label: 'Travel',         icon: '✈️', color: '#0EA5E9' },
  other:         { label: 'Other',          icon: '📋', color: '#6B7280' },
};

export default function AnalyticsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('all');    // 'week' | 'month' | '3months' | 'all'
  const [analytics, setAnalytics] = useState(null);
  const [groups, setGroups] = useState({});

  const TIME_RANGES = [
    { key: 'week',    label: '7 Days' },
    { key: 'month',   label: '30 Days' },
    { key: '3months', label: '3 Months' },
    { key: 'all',     label: 'All Time' },
  ];

  const toDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === 'number') return new Date(ts);
    return new Date(ts);
  };

  const getStartDate = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':    return new Date(now.getTime() - 7 * 86400000);
      case 'month':   return new Date(now.getTime() - 30 * 86400000);
      case '3months': return new Date(now.getTime() - 90 * 86400000);
      default:        return new Date(0);
    }
  };

  const loadAnalytics = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Get groups
      const gSnap = await getDocs(
        query(collection(db, 'groups'), where('members', 'array-contains', user.uid))
      );
      const gMap = {};
      const groupIds = [];
      gSnap.forEach((d) => {
        gMap[d.id] = { id: d.id, ...d.data() };
        groupIds.push(d.id);
      });
      setGroups(gMap);

      if (groupIds.length === 0) {
        setAnalytics(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 2. Get all expenses
      const allExpenses = [];
      const chunks = [];
      for (let i = 0; i < groupIds.length; i += 10) {
        chunks.push(groupIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const expSnap = await getDocs(
          query(collection(db, 'expenses'), where('groupId', 'in', chunk))
        );
        expSnap.forEach((d) => allExpenses.push({ id: d.id, ...d.data() }));
      }

      // 3. Filter by time range
      const startDate = getStartDate();
      const filtered = allExpenses.filter((exp) => {
        const d = toDate(exp.createdAt);
        return d >= startDate;
      });

      // 4. Calculate analytics
      let totalSpent = 0;       // your share
      let totalPaid = 0;        // what you paid
      let totalOwed = 0;        // what others owe you
      let totalYouOwe = 0;      // what you owe others
      const byCategory = {};
      const byGroup = {};
      const byMonth = {};
      const byDayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      let highestExpense = null;
      let expenseCount = 0;

      filtered.forEach((exp) => {
        const isInvolved = exp.splitBetween?.includes(user.uid);
        const isPayer = exp.paidBy === user.uid;

        let myShare = 0;
        if (isInvolved) {
          if (exp.splitAmounts && exp.splitMethod && exp.splitMethod !== 'equal') {
            myShare = exp.splitAmounts[user.uid] || 0;
          } else {
            myShare = exp.amount / (exp.splitBetween?.length || 1);
          }
          totalSpent += myShare;
          expenseCount++;
        }

        if (isPayer) {
          totalPaid += exp.amount;
          const othersShare = exp.amount - myShare;
          totalOwed += othersShare;
        } else if (isInvolved) {
          totalYouOwe += myShare;
        }

        // By category
        if (isInvolved) {
          const cat = exp.category || 'other';
          byCategory[cat] = (byCategory[cat] || 0) + myShare;
        }

        // By group
        if (isInvolved) {
          const gid = exp.groupId;
          byGroup[gid] = (byGroup[gid] || 0) + myShare;
        }

        // By month
        if (isInvolved) {
          const d = toDate(exp.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          byMonth[key] = (byMonth[key] || 0) + myShare;
        }

        // By day of week
        if (isInvolved) {
          const d = toDate(exp.createdAt);
          byDayOfWeek[d.getDay()] += myShare;
        }

        // Highest expense
        if (isInvolved && (!highestExpense || myShare > highestExpense.myShare)) {
          highestExpense = { ...exp, myShare };
        }
      });

      // Sort categories
      const topCategories = Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([key, amount]) => ({ key, amount }));

      // Sort groups
      const topGroups = Object.entries(byGroup)
        .sort(([, a], [, b]) => b - a)
        .map(([gid, amount]) => ({
          gid,
          amount,
          name: gMap[gid]?.name || 'Unknown',
          icon: gMap[gid]?.icon || '👥',
        }));

      // Monthly trend (sorted)
      const monthlyTrend = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));

      // Day of week names
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekdaySpending = Object.entries(byDayOfWeek).map(([day, amount]) => ({
        day: dayNames[parseInt(day)],
        amount,
      }));

      setAnalytics({
        totalSpent,
        totalPaid,
        totalOwed,
        totalYouOwe,
        topCategories,
        topGroups,
        monthlyTrend,
        weekdaySpending,
        highestExpense,
        expenseCount,
        avgExpense: expenseCount > 0 ? totalSpent / expenseCount : 0,
        totalExpenses: filtered.length,
      });

      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      console.error('Analytics error:', e);
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  // Simple bar chart component
  const BarChart = ({ data, maxValue, colorKey }) => {
    if (!data || data.length === 0) return null;
    const max = maxValue || Math.max(...data.map((d) => d.amount), 1);

    return (
      <View style={s.barChart}>
        {data.map((item, idx) => {
          const height = max > 0 ? (item.amount / max) * 120 : 0;
          const catInfo = CATEGORIES[item.key];
          return (
            <View key={idx} style={s.barCol}>
              <Text style={s.barValue}>
                {item.amount >= 1000
                  ? `${(item.amount / 1000).toFixed(1)}k`
                  : item.amount.toFixed(0)}
              </Text>
              <View
                style={[
                  s.bar,
                  {
                    height: Math.max(height, 4),
                    backgroundColor: catInfo?.color || '#6366F1',
                  },
                ]}
              />
              <Text style={s.barLabel} numberOfLines={1}>
                {catInfo?.icon || item.label || item.key}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Horizontal bar for groups/categories
  const HorizontalBar = ({ items, total, sym = '₹' }) => (
    <View>
      {items.map((item, idx) => {
        const pct = total > 0 ? (item.amount / total) * 100 : 0;
        const catInfo = CATEGORIES[item.key] || {};
        return (
          <View key={idx} style={s.hBarRow}>
            <View style={s.hBarLeft}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>
                {item.icon || catInfo.icon || '📋'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={s.hBarName} numberOfLines={1}>
                  {item.name || catInfo.label || item.key}
                </Text>
                <View style={s.hBarTrack}>
                  <View
                    style={[
                      s.hBarFill,
                      {
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: item.color || catInfo.color || '#6366F1',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
            <View style={s.hBarRight}>
              <Text style={s.hBarAmt}>{sym}{item.amount.toFixed(0)}</Text>
              <Text style={s.hBarPct}>{pct.toFixed(0)}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ marginTop: 12, color: '#6B7280' }}>Crunching numbers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sym = '₹';

  return (
    <PremiumGate feature="analytics">
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Analytics</Text>
        <Text style={s.headerSub}>Your spending insights</Text>
      </View>

      {/* Time range filter */}
      <View style={s.timeRow}>
        {TIME_RANGES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.timePill, timeRange === t.key && s.timePillActive]}
            onPress={() => setTimeRange(t.key)}
          >
            <Text style={[s.timePillTxt, timeRange === t.key && s.timePillTxtActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {!analytics ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>📊</Text>
            <Text style={s.emptyTitle}>No Data Yet</Text>
            <Text style={s.emptyBody}>Add expenses to see your analytics</Text>
          </View>
        ) : (
          <>
            {/* ═══ Overview Cards ═══ */}
            <View style={s.overviewRow}>
              <View style={[s.overviewCard, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="cart-outline" size={22} color="#6366F1" />
                <Text style={s.overviewLabel}>Your Share</Text>
                <Text style={[s.overviewValue, { color: '#6366F1' }]}>
                  {sym}{analytics.totalSpent.toFixed(0)}
                </Text>
              </View>
              <View style={[s.overviewCard, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="wallet-outline" size={22} color="#D97706" />
                <Text style={s.overviewLabel}>You Paid</Text>
                <Text style={[s.overviewValue, { color: '#D97706' }]}>
                  {sym}{analytics.totalPaid.toFixed(0)}
                </Text>
              </View>
            </View>

            <View style={s.overviewRow}>
              <View style={[s.overviewCard, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="arrow-down-circle-outline" size={22} color="#059669" />
                <Text style={s.overviewLabel}>Owed to You</Text>
                <Text style={[s.overviewValue, { color: '#059669' }]}>
                  {sym}{analytics.totalOwed.toFixed(0)}
                </Text>
              </View>
              <View style={[s.overviewCard, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="arrow-up-circle-outline" size={22} color="#DC2626" />
                <Text style={s.overviewLabel}>You Owe</Text>
                <Text style={[s.overviewValue, { color: '#DC2626' }]}>
                  {sym}{analytics.totalYouOwe.toFixed(0)}
                </Text>
              </View>
            </View>

            {/* ═══ Quick Stats ═══ */}
            <View style={s.statsCard}>
              <Text style={s.sectionTitle}>Quick Stats</Text>
              <View style={s.statRow}>
                <Text style={s.statLabel}>📊 Total expenses involved in</Text>
                <Text style={s.statValue}>{analytics.expenseCount}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>📈 Average expense</Text>
                <Text style={s.statValue}>{sym}{analytics.avgExpense.toFixed(0)}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>👥 Active groups</Text>
                <Text style={s.statValue}>{Object.keys(groups).length}</Text>
              </View>
              {analytics.highestExpense && (
                <View style={s.statRow}>
                  <Text style={s.statLabel}>🔥 Biggest expense</Text>
                  <Text style={s.statValue} numberOfLines={1}>
                    {analytics.highestExpense.description} ({sym}{analytics.highestExpense.myShare.toFixed(0)})
                  </Text>
                </View>
              )}
            </View>

            {/* ═══ Category Breakdown ═══ */}
            {analytics.topCategories.length > 0 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>Spending by Category</Text>
                <HorizontalBar
                  items={analytics.topCategories}
                  total={analytics.totalSpent}
                  sym={sym}
                />
              </View>
            )}

            {/* ═══ Category Bar Chart ═══ */}
            {analytics.topCategories.length > 1 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>Category Comparison</Text>
                <BarChart data={analytics.topCategories.slice(0, 6)} />
              </View>
            )}

            {/* ═══ Group Breakdown ═══ */}
            {analytics.topGroups.length > 0 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>Spending by Group</Text>
                <HorizontalBar
                  items={analytics.topGroups}
                  total={analytics.totalSpent}
                  sym={sym}
                />
              </View>
            )}

            {/* ═══ Monthly Trend ═══ */}
            {analytics.monthlyTrend.length > 1 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>Monthly Trend</Text>
                <View style={s.trendChart}>
                  {analytics.monthlyTrend.map((item, idx) => {
                    const max = Math.max(...analytics.monthlyTrend.map((m) => m.amount), 1);
                    const height = (item.amount / max) * 100;
                    const [year, month] = item.month.split('-');
                    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return (
                      <View key={idx} style={s.trendCol}>
                        <Text style={s.trendValue}>
                          {item.amount >= 1000
                            ? `${(item.amount / 1000).toFixed(1)}k`
                            : item.amount.toFixed(0)}
                        </Text>
                        <View style={[s.trendBar, { height: Math.max(height, 4) }]} />
                        <Text style={s.trendLabel}>{monthNames[parseInt(month)]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ═══ Day of Week ═══ */}
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Spending by Day</Text>
              <Text style={s.sectionSub}>When do you spend the most?</Text>
              <View style={s.weekChart}>
                {analytics.weekdaySpending.map((item, idx) => {
                  const max = Math.max(...analytics.weekdaySpending.map((d) => d.amount), 1);
                  const height = (item.amount / max) * 80;
                  const isMax = item.amount === max && max > 0;
                  return (
                    <View key={idx} style={s.weekCol}>
                      <Text style={[s.weekValue, isMax && { color: '#6366F1', fontWeight: '700' }]}>
                        {item.amount >= 1000
                          ? `${(item.amount / 1000).toFixed(1)}k`
                          : item.amount.toFixed(0)}
                      </Text>
                      <View
                        style={[
                          s.weekBar,
                          {
                            height: Math.max(height, 4),
                            backgroundColor: isMax ? '#6366F1' : '#C7D2FE',
                          },
                        ]}
                      />
                      <Text style={[s.weekLabel, isMax && { color: '#6366F1', fontWeight: '700' }]}>
                        {item.day}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
    </PremiumGate>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1F2937' },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  timeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    backgroundColor: '#F3F4F6',
  },
  timePillActive: { backgroundColor: '#6366F1' },
  timePillTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  timePillTxtActive: { color: '#fff' },

  overviewRow: { flexDirection: 'row', marginBottom: 10 },
  overviewCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  overviewLabel: { fontSize: 12, color: '#6B7280', marginTop: 6, fontWeight: '500' },
  overviewValue: { fontSize: 22, fontWeight: 'bold', marginTop: 2 },

  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statLabel: { fontSize: 14, color: '#6B7280', flex: 1 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1F2937', maxWidth: '50%', textAlign: 'right' },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1F2937', marginBottom: 14 },
  sectionSub: { fontSize: 12, color: '#9CA3AF', marginTop: -10, marginBottom: 14 },

  /* Horizontal bar */
  hBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  hBarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  hBarName: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  hBarTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, width: '100%' },
  hBarFill: { height: 8, borderRadius: 4 },
  hBarRight: { alignItems: 'flex-end', marginLeft: 12, minWidth: 60 },
  hBarAmt: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  hBarPct: { fontSize: 11, color: '#9CA3AF' },

  /* Bar chart */
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 160,
    paddingTop: 20,
  },
  barCol: { alignItems: 'center', flex: 1 },
  barValue: { fontSize: 10, color: '#6B7280', marginBottom: 4, fontWeight: '600' },
  bar: { width: 28, borderRadius: 6 },
  barLabel: { fontSize: 16, marginTop: 6 },

  /* Monthly trend */
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 140,
    paddingTop: 20,
  },
  trendCol: { alignItems: 'center', flex: 1 },
  trendValue: { fontSize: 10, color: '#6B7280', marginBottom: 4, fontWeight: '600' },
  trendBar: { width: 24, backgroundColor: '#6366F1', borderRadius: 6 },
  trendLabel: { fontSize: 11, color: '#6B7280', marginTop: 6, fontWeight: '500' },

  /* Week chart */
  weekChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 120,
    paddingTop: 10,
  },
  weekCol: { alignItems: 'center', flex: 1 },
  weekValue: { fontSize: 10, color: '#9CA3AF', marginBottom: 4 },
  weekBar: { width: 28, borderRadius: 6 },
  weekLabel: { fontSize: 11, color: '#6B7280', marginTop: 6 },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 6 },
  emptyBody: { fontSize: 14, color: '#6B7280' },
});