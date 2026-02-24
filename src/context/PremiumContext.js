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

          // Check if lifetime or not expired
          if (sub.type === 'lifetime' || expiresAt > new Date()) {
            setCurrentPlan(PLANS[sub.planId] || PLANS.pro);
          } else {
            // Expired
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
    return currentPlan.features[featureKey] === true ||
           (typeof currentPlan.features[featureKey] === 'number' &&
            currentPlan.features[featureKey] === -1);
  };

  // ── Check if user can perform an action (with limits) ──
  const getLimit = (limitKey) => {
    return currentPlan[limitKey] || currentPlan.features[limitKey] || 0;
  };

  // ── Check if at limit ──
  const isAtLimit = (limitKey, currentCount) => {
    const limit = getLimit(limitKey);
    if (limit === -1) return false;  // unlimited
    return currentCount >= limit;
  };

  const isPro = currentPlan.id === 'pro' || currentPlan.id === 'premium';
  const isPremium = currentPlan.id === 'premium';
  const isFree = currentPlan.id === 'free';

  return (
    <PremiumContext.Provider
      value={{
        subscription,
        currentPlan,
        loading,
        hasFeature,
        getLimit,
        isAtLimit,
        isPro,
        isPremium,
        isFree,
        planName: currentPlan.name,
        planIcon: currentPlan.icon,
        planColor: currentPlan.color,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}