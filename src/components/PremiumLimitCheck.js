// src/components/PremiumLimitCheck.js
import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PremiumContext } from '../context/PremiumContext';
import { useNavigation } from '@react-navigation/native';

export function usePremiumLimit() {
  const { isAtLimit, getLimit, currentPlan, isFree } = useContext(PremiumContext);
  const navigation = useNavigation();

  const checkLimit = (limitKey, currentCount, customMessage) => {
    const limit = getLimit(limitKey);

    if (limit === -1) return true; // unlimited

    if (currentCount >= limit) {
      const messages = {
        maxGroups: `You've reached the limit of ${limit} groups on the ${currentPlan.name} plan.`,
        maxMembersPerGroup: `Maximum ${limit} members per group on the ${currentPlan.name} plan.`,
        maxExpensesPerMonth: `You've added ${limit} expenses this month (${currentPlan.name} plan limit).`,
        maxExpensesPerGroup: `You've reached the limit of ${limit} expenses in this group on the ${currentPlan.name} plan. Upgrade for unlimited expenses!`,  // ← ADD
        debtReminders: `You've used all ${limit} reminders this month.`,
        maxChatMessages: `Chat message limit reached for this group.`,
      };

      Alert.alert(
        '🔒 Limit Reached',
        customMessage || messages[limitKey] || `Limit reached on ${currentPlan.name} plan.`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: '⭐ Upgrade',
            onPress: () => navigation.navigate('Premium'),
          },
        ]
      );
      return false;
    }

    // Warn when approaching limit (80%)
    if (limit > 0 && currentCount >= limit * 0.8 && isFree) {
      const remaining = limit - currentCount;
      if (remaining <= 3 && remaining > 0) {
        setTimeout(() => {
          Alert.alert(
            '⚠️ Approaching Limit',
            `You have ${remaining} expense(s) left in this group on the free plan.`,  // ← BETTER MESSAGE
            [
              { text: 'Got it' },
              { text: 'See Plans', onPress: () => navigation.navigate('Premium') },
            ]
          );
        }, 500);
      }
    }

    return true;
  };

  return { checkLimit };
}

export function LimitIndicator({ limitKey, currentCount, label }) {
  const { getLimit, currentPlan, isFree } = useContext(PremiumContext);
  const navigation = useNavigation();

  const limit = getLimit(limitKey);
  if (limit === -1) return null;

  const pct = Math.min((currentCount / limit) * 100, 100);
  const isNearLimit = pct >= 80;
  const isAtLimitNow = pct >= 100;

  return (
    <TouchableOpacity
      style={ls.limitContainer}
      onPress={() => {
        if (isNearLimit) navigation.navigate('Premium');
      }}
      activeOpacity={isNearLimit ? 0.7 : 1}
    >
      <View style={ls.limitHead}>
        <Text style={ls.limitLabel}>{label}</Text>
        <Text style={[ls.limitCount, isAtLimitNow && { color: '#EF4444' }]}>
          {currentCount}/{limit}
        </Text>
      </View>
      <View style={ls.limitTrack}>
        <View
          style={[
            ls.limitFill,
            {
              width: `${pct}%`,
              backgroundColor: isAtLimitNow
                ? '#EF4444'
                : isNearLimit
                  ? '#F59E0B'
                  : '#6366F1',
            },
          ]}
        />
      </View>
      {isNearLimit && isFree && (
        <View style={ls.limitWarning}>
          <Ionicons name="star" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
          <Text style={ls.limitWarningTxt}>Upgrade for unlimited</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const ls = StyleSheet.create({
  limitContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  limitHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  limitLabel: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  limitCount: { fontSize: 12, color: '#1F2937', fontWeight: '700' },
  limitTrack: {
    height: 6,
    backgroundColor: '#FDE68A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  limitFill: {
    height: 6,
    borderRadius: 3,
  },
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  limitWarningTxt: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
});