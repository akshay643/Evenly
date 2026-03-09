// src/context/PremiumContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase.config';
import { AuthContext } from './AuthContext';
import { PLANS } from '../config/premiumConfig';

export const PremiumContext = createContext();

export function PremiumProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [subscription, setSubscription] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(PLANS.free);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setCurrentPlan(PLANS.free);
      setLoading(false);
      return;
    }

    // Listen to user's subscription in realtime
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const sub = data.subscription || null;
        setSubscription(sub);

        // Determine current plan
        if (sub && sub.status === 'active') {
          const expiresAt = sub.expiresAt?.toDate
            ? sub.expiresAt.toDate()
            : new Date(sub.expiresAt || 0);

          // Check if not expired
          if (expiresAt > new Date()) {
            setCurrentPlan(PLANS.premium);
          } else {
            // Expired - downgrade to free
            setCurrentPlan(PLANS.free);
          }
        } else {
          setCurrentPlan(PLANS.free);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // ── Check if a specific feature is available ──
  const hasFeature = (featureKey) => {
    const feature = currentPlan.features[featureKey];
    // Feature is available if it's true or unlimited (-1)
    return feature === true || feature === -1;
  };

  // ── Get limit value for a specific key ──
  const getLimit = (limitKey) => {
    // Check plan-level limits first, then features
    return currentPlan[limitKey] ?? currentPlan.features[limitKey] ?? 0;
  };

  // ── Check if user has reached the limit ──
  const isAtLimit = (limitKey, currentCount) => {
    const limit = getLimit(limitKey);
    if (limit === -1) return false; // Unlimited
    return currentCount >= limit;
  };

  // ── Get remaining count for a limit ──
  const getRemainingCount = (limitKey, currentCount) => {
    const limit = getLimit(limitKey);
    if (limit === -1) return Infinity; // Unlimited
    return Math.max(0, limit - currentCount);
  };

  // Simple boolean checks
  const isPremium = currentPlan.id === 'premium';
  const isFree = currentPlan.id === 'free';

  return (
    <PremiumContext.Provider
      value={{
        // Subscription data
        subscription,
        currentPlan,
        loading,

        // Feature checks
        hasFeature,
        getLimit,
        isAtLimit,
        getRemainingCount,

        // Plan status
        isPremium,
        isFree,

        // Plan display info
        planName: currentPlan.name,
        planIcon: currentPlan.icon,
        planColor: currentPlan.color,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

// ── Custom hook for easier usage ──
export function usePremium() {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
}