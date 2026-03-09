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
  Animated,
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
  const { currentPlan, isPremium, subscription } = useContext(PremiumContext);
  const [purchasing, setPurchasing] = useState(false);

  const plan = PLANS.premium;
  const pricing = plan.pricing.lifetime; // ✅ Changed to lifetime

  const handlePurchase = async () => {
    if (!pricing) return;

    Alert.alert(
      '🎉 Confirm Purchase',
      `Get Premium for ${pricing.label}?\n\nThis is a one-time payment. No subscriptions, no renewals, no hidden fees. Yours forever!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Now',
          onPress: async () => {
            setPurchasing(true);
            try {
              // ✅ Lifetime = no expiry (set to year 2099)
              const expiresAt = new Date('2099-12-31').getTime();

              // Save to Firestore
              await updateDoc(doc(db, 'users', user.uid), {
                subscription: {
                  planId: 'premium',
                  type: 'lifetime', // ✅ Changed to lifetime
                  status: 'active',
                  purchasedAt: Date.now(),
                  expiresAt: expiresAt,
                  amount: pricing.INR,
                  currency: 'INR',
                },
              });

              Alert.alert(
                '🎉 Welcome to Premium!',
                'You now have LIFETIME access to all premium features. No renewals needed. Enjoy!',
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
            // In production, check Play Store / App Store for purchases
            Alert.alert('No purchases found', 'No previous purchases were found for this account.');
          },
        },
      ]
    );
  };

  // ========================================
  // Already Premium - Show Active Plan
  // ========================================
  if (isPremium) {
    const isLifetime = subscription?.type === 'lifetime' || 
                       subscription?.expiresAt > Date.now() + (50 * 365 * 24 * 60 * 60 * 1000);
    
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
            <View style={s.activeIconCircle}>
              <Text style={{ fontSize: 40 }}>💎</Text>
            </View>
            <Text style={s.activeTitle}>Premium Plan</Text>
            
            {/* ✅ Show Lifetime badge */}
            <View style={s.lifetimeBadge}>
              <Ionicons name="infinite" size={16} color="#10B981" />
              <Text style={s.lifetimeBadgeText}>
                {isLifetime ? 'Lifetime Access' : `Expires ${new Date(subscription?.expiresAt).toLocaleDateString()}`}
              </Text>
            </View>
            
            {isLifetime && (
              <Text style={s.activeNote}>
                One-time purchase • No renewals • Yours forever
              </Text>
            )}

            <View style={s.divider} />

            <View style={s.activeFeatures}>
              <Text style={s.activeFeaturesTitle}>✨ Your Premium Features:</Text>
              {PREMIUM_FEATURES.slice(0, 8).map((f) => (
                <View key={f.key} style={s.activeFeatureRow}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color="#10B981" 
                    style={{ marginRight: 10 }} 
                  />
                  <Text style={s.activeFeatureTxt}>{f.title}</Text>
                </View>
              ))}
              {PREMIUM_FEATURES.length > 8 && (
                <Text style={s.moreFeatures}>
                  +{PREMIUM_FEATURES.length - 8} more features included
                </Text>
              )}
            </View>
          </View>

          {/* Share the love */}
          <View style={s.shareCard}>
            <Text style={s.shareEmoji}>💜</Text>
            <Text style={s.shareTitle}>Love SplitBill?</Text>
            <Text style={s.shareDesc}>
              Share with friends and help them split expenses smarter!
            </Text>
            <TouchableOpacity 
              style={s.shareBtn}
              onPress={() => {
                // Share app
                Alert.alert('Share', 'Share functionality coming soon!');
              }}
            >
              <Ionicons name="share-social" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.shareBtnText}>Share App</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ========================================
  // Not Premium - Show Upgrade Screen
  // ========================================
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
          <View style={s.heroIconCircle}>
            <Text style={{ fontSize: 48 }}>💎</Text>
          </View>
          <Text style={s.heroTitle}>Unlock Premium</Text>
          <Text style={s.heroSub}>
            Split smarter. Settle faster. Track better.
          </Text>
        </View>

        {/* ✅ One-Time Price Card (replaces billing toggle) */}
        <View style={s.priceCard}>
          <View style={s.priceHeader}>
            <View style={s.bestValueBadge}>
              <Ionicons name="star" size={12} color="#fff" />
              <Text style={s.bestValueText}>BEST VALUE</Text>
            </View>
          </View>
          
          <View style={s.priceMain}>
            <Text style={s.priceLabel}>One-Time Payment</Text>
            <View style={s.priceRow}>
              <Text style={s.priceCurrency}>₹</Text>
              <Text style={s.priceAmount}>149</Text>
            </View>
            <Text style={s.priceForever}>Forever</Text>
          </View>
          
          <View style={s.priceFeatures}>
            <View style={s.priceFeatureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={s.priceFeatureText}>Lifetime access</Text>
            </View>
            <View style={s.priceFeatureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={s.priceFeatureText}>No monthly fees</Text>
            </View>
            <View style={s.priceFeatureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={s.priceFeatureText}>No auto-renewals</Text>
            </View>
            <View style={s.priceFeatureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={s.priceFeatureText}>All future updates free</Text>
            </View>
          </View>

          <View style={s.comparisonRow}>
            <View style={s.comparisonItem}>
              <Text style={s.comparisonStrike}>₹49/month</Text>
              <Text style={s.comparisonLabel}>Monthly</Text>
            </View>
            <View style={s.comparisonDivider} />
            <View style={s.comparisonItem}>
              <Text style={s.comparisonStrike}>₹399/year</Text>
              <Text style={s.comparisonLabel}>Yearly</Text>
            </View>
            <View style={s.comparisonDivider} />
            <View style={[s.comparisonItem, s.comparisonItemHighlight]}>
              <Text style={s.comparisonHighlight}>₹149</Text>
              <Text style={s.comparisonLabelHighlight}>Forever ✓</Text>
            </View>
          </View>
        </View>

        {/* Features list */}
        <View style={s.featuresSection}>
          <Text style={s.featuresTitle}>Everything included:</Text>
          {PREMIUM_FEATURES.map((f, idx) => (
            <View key={f.key} style={[s.featureRow, idx === PREMIUM_FEATURES.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.featureCheck}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.featureName}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
              <View style={s.featureCompare}>
                <Text style={s.featureFree}>{f.freeLimit}</Text>
                <Ionicons name="arrow-forward" size={12} color="#D1D5DB" style={{ marginVertical: 2 }} />
                <Text style={s.featurePremium}>{f.premiumValue}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Social Proof */}
        <View style={s.socialProof}>
          <Text style={s.socialProofTitle}>Join 10,000+ happy users</Text>
          <View style={s.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons key={star} name="star" size={20} color="#F59E0B" />
            ))}
            <Text style={s.ratingText}>4.8/5 on Play Store</Text>
          </View>
          <View style={s.testimonial}>
            <Text style={s.testimonialText}>
              "Best ₹149 I ever spent. No more awkward 'bhej de yaar' messages!"
            </Text>
            <Text style={s.testimonialAuthor}>— Rahul, Mumbai</Text>
          </View>
        </View>

        {/* CTA */}
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
                <Ionicons name="diamond" size={22} color="#fff" style={{ marginRight: 10 }} />
                <Text style={s.ctaBtnTxt}>
                  Get Premium — ₹149 Forever
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.ctaNote}>
            One-time payment • No subscriptions • Yours forever
          </Text>

          {/* Trust badges */}
          <View style={s.trustRow}>
            <View style={s.trustBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={s.trustTxt}>Secure Payment</Text>
            </View>
            <View style={s.trustBadge}>
              <Ionicons name="infinite" size={16} color="#10B981" />
              <Text style={s.trustTxt}>Lifetime Access</Text>
            </View>
            <View style={s.trustBadge}>
              <Ionicons name="heart" size={16} color="#10B981" />
              <Text style={s.trustTxt}>7-Day Refund</Text>
            </View>
          </View>

          {/* Money back guarantee */}
          <View style={s.guaranteeBox}>
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.guaranteeTitle}>100% Money Back Guarantee</Text>
              <Text style={s.guaranteeDesc}>
                Not satisfied? Get a full refund within 7 days. No questions asked.
              </Text>
            </View>
          </View>

          <Text style={s.termsNote}>
            By purchasing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  restoreTxt: { fontSize: 14, color: '#F59E0B', fontWeight: '600' },

  // Hero
  hero: { 
    alignItems: 'center', 
    paddingVertical: 32, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  heroIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
  heroTitle: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginBottom: 6 },
  heroSub: { fontSize: 16, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40 },

  // ✅ Price Card (New - replaces billing toggle)
  priceCard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#F59E0B',
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  priceHeader: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    alignItems: 'center',
  },
  bestValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bestValueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  priceMain: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFBEB',
  },
  priceLabel: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  priceCurrency: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  priceAmount: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#1F2937',
    lineHeight: 72,
  },
  priceForever: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 4,
  },
  priceFeatures: {
    padding: 16,
    backgroundColor: '#fff',
    gap: 10,
  },
  priceFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceFeatureText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  comparisonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonItemHighlight: {
    backgroundColor: '#D1FAE5',
    marginVertical: -12,
    paddingVertical: 12,
    marginRight: -8,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  comparisonStrike: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  comparisonLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  comparisonHighlight: {
    fontSize: 16,
    color: '#059669',
    fontWeight: 'bold',
  },
  comparisonLabelHighlight: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  comparisonDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },

  // Features Section
  featuresSection: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  featuresTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 18 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  featureName: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  featureDesc: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  featureCompare: { alignItems: 'flex-end', marginLeft: 10 },
  featureFree: { fontSize: 10, color: '#EF4444', fontWeight: '600' },
  featurePremium: { fontSize: 11, color: '#10B981', fontWeight: '700' },

  // Social Proof
  socialProof: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  socialProofTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  testimonial: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  testimonialText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 20,
    textAlign: 'center',
  },
  testimonialAuthor: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },

  // CTA Section
  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ctaNote: { fontSize: 13, color: '#6B7280', marginTop: 14, textAlign: 'center' },

  // Trust badges
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustTxt: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  // Guarantee Box
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  guaranteeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2,
  },
  guaranteeDesc: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 16,
  },

  termsNote: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 30,
    lineHeight: 14,
  },

  // ========================================
  // Active subscription styles
  // ========================================
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  activeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
  activeTitle: { fontSize: 26, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  lifetimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  lifetimeBadgeText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  activeNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  divider: { width: '100%', height: 1, backgroundColor: '#E5E7EB', marginVertical: 24 },
  activeFeatures: { width: '100%' },
  activeFeaturesTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 14 },
  activeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  activeFeatureTxt: { fontSize: 14, color: '#374151' },
  moreFeatures: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  // Share card
  shareCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  shareEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  shareDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  shareBtn: {
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});