// src/components/PremiumLimitCheck.js
import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PremiumContext } from '../context/PremiumContext';
import { useNavigation } from '@react-navigation/native';

/**
 * Custom hook to check premium limits
 */
export function usePremiumLimit() {
  const { isAtLimit, getLimit, currentPlan, isFree, isPremium } = useContext(PremiumContext);
  const navigation = useNavigation();

  const checkLimit = (limitKey, currentCount, customMessage) => {
    const limit = getLimit(limitKey);

    // Unlimited (Premium users)
    if (limit === -1) return true;

    // At limit
    if (currentCount >= limit) {
      const messages = {
        maxGroups: `You've reached the limit of ${limit} groups on the Free plan.`,
        maxMembersPerGroup: `Maximum ${limit} members per group on the Free plan.`,
        maxExpensesPerMonth: `You've added ${limit} expenses this month (Free plan limit).`,
        maxExpensesPerGroup: `You've reached the limit of ${limit} expenses in this group. Upgrade to Premium for unlimited expenses!`,
        debtReminders: `You've used all ${limit} reminders this month on the Free plan.`,
        maxChatMessages: `Chat message limit reached for this group on the Free plan.`,
      };

      Alert.alert(
        '🔒 Limit Reached',
        customMessage || messages[limitKey] || `You've reached the limit on the Free plan.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: '💎 Upgrade to Premium',
            onPress: () => navigation.navigate('Premium'),
          },
        ]
      );
      return false;
    }

    // Warn when approaching limit (80%) - only for Free users
    if (isFree && limit > 0 && currentCount >= limit * 0.8) {
      const remaining = limit - currentCount;
      
      if (remaining <= 3 && remaining > 0) {
        const warningMessages = {
          maxGroups: `You have ${remaining} group(s) left on the Free plan.`,
          maxExpensesPerGroup: `You have ${remaining} expense(s) left in this group on the Free plan.`,
          maxExpensesPerMonth: `You have ${remaining} expense(s) left this month on the Free plan.`,
          debtReminders: `You have ${remaining} reminder(s) left this month on the Free plan.`,
        };

        setTimeout(() => {
          Alert.alert(
            '⚠️ Approaching Limit',
            warningMessages[limitKey] || `You're approaching your limit on the Free plan.`,
            [
              { text: 'Got it', style: 'cancel' },
              { 
                text: '💎 See Premium', 
                onPress: () => navigation.navigate('Premium') 
              },
            ]
          );
        }, 500);
      }
    }

    return true;
  };

  return { checkLimit };
}

/**
 * Visual limit indicator component
 */
export function LimitIndicator({ limitKey, currentCount, label }) {
  const { getLimit, isPremium, isFree } = useContext(PremiumContext);
  const navigation = useNavigation();

  const limit = getLimit(limitKey);

  // Don't show for Premium users (unlimited)
  if (limit === -1 || isPremium) {
    return null;
  }

  const pct = Math.min((currentCount / limit) * 100, 100);
  const isNearLimit = pct >= 80;
  const isAtLimitNow = pct >= 100;
  const remaining = Math.max(0, limit - currentCount);

  return (
    <TouchableOpacity
      style={ls.limitContainer}
      onPress={() => {
        if (isNearLimit || isAtLimitNow) {
          navigation.navigate('Premium');
        }
      }}
      activeOpacity={isNearLimit || isAtLimitNow ? 0.7 : 1}
    >
      <View style={ls.limitHead}>
        <Text style={ls.limitLabel}>{label}</Text>
        <View style={ls.limitCountContainer}>
          <Text style={[ls.limitCount, isAtLimitNow && { color: '#EF4444' }]}>
            {currentCount}/{limit}
          </Text>
          {remaining > 0 && (
            <Text style={ls.limitRemaining}> ({remaining} left)</Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
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
                  : '#10B981',
            },
          ]}
        />
      </View>

      {/* Warning/Upgrade prompt */}
      {(isNearLimit || isAtLimitNow) && isFree && (
        <View style={ls.limitWarning}>
          <Ionicons 
            name={isAtLimitNow ? "alert-circle" : "diamond"} 
            size={14} 
            color={isAtLimitNow ? "#EF4444" : "#F59E0B"} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[ls.limitWarningTxt, isAtLimitNow && { color: '#EF4444' }]}>
            {isAtLimitNow 
              ? 'Limit reached • Upgrade to Premium' 
              : 'Upgrade to Premium for unlimited'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Simple premium badge
 */
export function PremiumBadge({ feature, style }) {
  const { hasFeature } = useContext(PremiumContext);
  const navigation = useNavigation();

  if (hasFeature(feature)) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[ls.premiumBadge, style]}
      onPress={() => navigation.navigate('Premium')}
      activeOpacity={0.7}
    >
      <Ionicons name="diamond" size={12} color="#F59E0B" />
      <Text style={ls.premiumBadgeTxt}>Premium</Text>
    </TouchableOpacity>
  );
}

const ls = StyleSheet.create({
  // Limit indicator
  limitContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },

  limitHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  limitLabel: { 
    fontSize: 13, 
    color: '#92400E', 
    fontWeight: '600',
    flex: 1,
  },

  limitCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  limitCount: { 
    fontSize: 14, 
    color: '#1F2937', 
    fontWeight: '700',
  },

  limitRemaining: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },

  limitTrack: {
    height: 7,
    backgroundColor: '#FDE68A',
    borderRadius: 4,
    overflow: 'hidden',
  },

  limitFill: {
    height: 7,
    borderRadius: 4,
  },

  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },

  limitWarningTxt: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },

  // Premium badge
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 4,
  },

  premiumBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
});