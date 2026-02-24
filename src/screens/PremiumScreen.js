// src/screens/PremiumScreen.js
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PremiumContext } from '../context/PremiumContext';
import { AuthContext } from '../context/AuthContext';
import { PLANS, PREMIUM_FEATURES } from '../config/premiumConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.config';

export default function PremiumScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { currentPlan, isPro, isPremium, isFree, subscription } = useContext(PremiumContext);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [selectedBilling, setSelectedBilling] = useState('yearly');
  const [purchasing, setPurchasing] = useState(false);

  const plan = PLANS[selectedPlan];
  const pricing = plan?.pricing?.[selectedBilling];

  // In production, replace with actual IAP (In-App Purchase)
  // For now, simulate purchase flow
  const handlePurchase = async () => {
    if (!pricing) return;

    Alert.alert(
      'Confirm Purchase',
      `Subscribe to ${plan.name} (${pricing.label})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setPurchasing(true);
            try {
              // Calculate expiry
              let expiresAt;
              const now = new Date();
              if (selectedBilling === 'monthly') {
                expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
              } else if (selectedBilling === 'yearly') {
                expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
              } else {
                expiresAt = new Date('2099-12-31');  // lifetime
              }

              // Save to Firestore
              await updateDoc(doc(db, 'users', user.uid), {
                subscription: {
                  planId: selectedPlan,
                  type: selectedBilling,
                  status: 'active',
                  purchasedAt: Date.now(),
                  expiresAt: expiresAt.getTime(),
                  amount: pricing.INR || pricing.USD,
                  currency: 'INR',
                },
              });

              Alert.alert(
                '🎉 Welcome to ' + plan.name + '!',
                'You now have access to all premium features. Enjoy!',
                [{ text: 'Awesome!', onPress: () => navigation.goBack() }]
              );
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore Purchases',
      'This will check for any existing purchases linked to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            // In production, check IAP receipts
            Alert.alert('No purchases found', 'No previous purchases were found for this account.');
          },
        },
      ]
    );
  };

  // Already subscribed
  if (isPro || isPremium) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Your Plan</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={s.activeCard}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>{currentPlan.icon}</Text>
            <Text style={s.activeTitle}>{currentPlan.name} Plan</Text>
            <Text style={s.activeSub}>
              {subscription?.type === 'lifetime'
                ? 'Lifetime access — never expires!'
                : `Renews ${new Date(subscription?.expiresAt).toLocaleDateString()}`}
            </Text>

            <View style={s.activeFeatures}>
              {PREMIUM_FEATURES.filter((f) => currentPlan.features[f.key]).map((f) => (
                <View key={f.key} style={s.activeFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
                  <Text style={s.activeFeatureTxt}>{f.title}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Upgrade to Premium (if on Pro) */}
          {isPro && !isPremium && (
            <TouchableOpacity
              style={s.upgradePremiumBtn}
              onPress={() => {
                setSelectedPlan('premium');
                setSelectedBilling('lifetime');
              }}
            >
              <Ionicons name="diamond" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.upgradePremiumBtnTxt}>Upgrade to Premium</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Go Premium</Text>
        <TouchableOpacity onPress={handleRestore}>
          <Text style={s.restoreTxt}>Restore</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={{ fontSize: 56, marginBottom: 8 }}>✨</Text>
          <Text style={s.heroTitle}>Unlock the Full Experience</Text>
          <Text style={s.heroSub}>
            Split smarter, settle faster, track better
          </Text>
        </View>

        {/* Plan selector */}
        <View style={s.planSelector}>
          <TouchableOpacity
            style={[s.planTab, selectedPlan === 'pro' && s.planTabActive]}
            onPress={() => setSelectedPlan('pro')}
          >
            <Text style={{ fontSize: 18, marginBottom: 2 }}>⭐</Text>
            <Text style={[s.planTabLabel, selectedPlan === 'pro' && s.planTabLabelActive]}>
              Pro
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.planTab,
              selectedPlan === 'premium' && s.planTabActive,
              { borderColor: '#F59E0B' },
              selectedPlan === 'premium' && { backgroundColor: '#F59E0B' },
            ]}
            onPress={() => setSelectedPlan('premium')}
          >
            <Text style={{ fontSize: 18, marginBottom: 2 }}>💎</Text>
            <Text
              style={[
                s.planTabLabel,
                selectedPlan === 'premium' && s.planTabLabelActive,
              ]}
            >
              Premium
            </Text>
            <View style={s.bestValueBadge}>
              <Text style={s.bestValueTxt}>BEST</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Billing toggle */}
        <View style={s.billingRow}>
          {Object.entries(plan?.pricing || {}).map(([key, val]) => (
            <TouchableOpacity
              key={key}
              style={[s.billingChip, selectedBilling === key && s.billingChipActive]}
              onPress={() => setSelectedBilling(key)}
            >
              <Text style={[s.billingChipTxt, selectedBilling === key && s.billingChipTxtActive]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
              <Text style={[s.billingPrice, selectedBilling === key && { color: '#fff' }]}>
                {val.label}
              </Text>
              {val.savings && (
                <View style={[s.savingsBadge, selectedBilling === key && { backgroundColor: '#fff' }]}>
                  <Text style={[s.savingsTxt, selectedBilling === key && { color: '#6366F1' }]}>
                    Save {val.savings}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Features list */}
        <View style={s.featuresSection}>
          <Text style={s.featuresTitle}>Everything you get:</Text>
          {PREMIUM_FEATURES.map((f) => {
            const isIncluded = plan?.features?.[f.key];
            return (
              <View key={f.key} style={s.featureRow}>
                <View style={[s.featureCheck, isIncluded && s.featureCheckActive]}>
                  <Ionicons
                    name={isIncluded ? 'checkmark' : 'close'}
                    size={14}
                    color={isIncluded ? '#fff' : '#D1D5DB'}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.featureName, !isIncluded && { color: '#9CA3AF' }]}>
                    {f.title}
                  </Text>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
                {/* Free vs Pro comparison */}
                <View style={s.featureCompare}>
                  <Text style={s.featureFree}>{f.freeLimit}</Text>
                  <Text style={s.featurePro}>{f.proValue}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Comparison table header */}
        <View style={s.compareHeader}>
          <Text style={{ flex: 1 }} />
          <Text style={s.compareHeaderTxt}>Free</Text>
          <Text style={[s.compareHeaderTxt, { color: '#6366F1' }]}>Pro</Text>
        </View>

        {/* Subscribe button */}
        <View style={s.ctaSection}>
          <TouchableOpacity
            style={[s.ctaBtn, purchasing && { opacity: 0.6 }]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="star" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.ctaBtnTxt}>
                  Subscribe to {plan?.name} — {pricing?.label}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.ctaNote}>
            {selectedBilling === 'lifetime'
              ? 'One-time payment. No recurring charges.'
              : 'Cancel anytime. No questions asked.'}
          </Text>

          {/* Trust badges */}
          <View style={s.trustRow}>
            <View style={s.trustBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
              <Text style={s.trustTxt}>Secure</Text>
            </View>
            <View style={s.trustBadge}>
              <Ionicons name="refresh" size={14} color="#10B981" />
              <Text style={s.trustTxt}>Cancel Anytime</Text>
            </View>
            <View style={s.trustBadge}>
              <Ionicons name="heart" size={14} color="#10B981" />
              <Text style={s.trustTxt}>7-Day Refund</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  restoreTxt: { fontSize: 14, color: '#6366F1', fontWeight: '600' },

  hero: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff' },
  heroTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', textAlign: 'center' },
  heroSub: { fontSize: 15, color: '#6B7280', marginTop: 6, textAlign: 'center' },

  planSelector: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  planTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#6366F1',
    marginHorizontal: 4,
    backgroundColor: '#fff',
    position: 'relative',
  },
  planTabActive: {
    backgroundColor: '#6366F1',
  },
  planTabLabel: { fontSize: 16, fontWeight: '700', color: '#6366F1' },
  planTabLabelActive: { color: '#fff' },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: -4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bestValueTxt: { fontSize: 9, fontWeight: 'bold', color: '#fff' },

  billingRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  billingChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    marginHorizontal: 3,
  },
  billingChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  billingChipTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  billingChipTxtActive: { color: '#C7D2FE' },
  billingPrice: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginTop: 4 },
  savingsBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  savingsTxt: { fontSize: 10, fontWeight: '700', color: '#059669' },

  featuresSection: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  featuresTitle: { fontSize: 17, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  featureCheckActive: { backgroundColor: '#10B981' },
  featureName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  featureDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  featureCompare: { alignItems: 'flex-end', marginLeft: 8 },
  featureFree: { fontSize: 10, color: '#EF4444', fontWeight: '500' },
  featurePro: { fontSize: 10, color: '#10B981', fontWeight: '700', marginTop: 2 },

  compareHeader: {
    flexDirection: 'row',
    paddingHorizontal: 36,
    marginBottom: 4,
  },
  compareHeaderTxt: {
    width: 40,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },

  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaNote: { fontSize: 12, color: '#9CA3AF', marginTop: 12, textAlign: 'center' },

  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  trustTxt: { fontSize: 11, color: '#6B7280', marginLeft: 4 },

  // Active subscription view
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  activeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  activeSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  activeFeatures: { width: '100%' },
  activeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeFeatureTxt: { fontSize: 14, color: '#1F2937' },
  upgradePremiumBtn: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  upgradePremiumBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});