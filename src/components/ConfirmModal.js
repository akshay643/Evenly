// components/ConfirmModal.js
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const MODAL_TYPES = {
  danger: {
    icon: 'trash',
    iconBgColor: '#FEE2E2',
    iconColor: '#DC2626',
    buttonColor: '#DC2626',
    buttonPressedColor: '#B91C1C',
  },
  warning: {
    icon: 'warning',
    iconBgColor: '#FEF3C7',
    iconColor: '#D97706',
    buttonColor: '#D97706',
    buttonPressedColor: '#B45309',
  },
  info: {
    icon: 'information-circle',
    iconBgColor: '#DBEAFE',
    iconColor: '#2563EB',
    buttonColor: '#2563EB',
    buttonPressedColor: '#1D4ED8',
  },
  success: {
    icon: 'checkmark-circle',
    iconBgColor: '#D1FAE5',
    iconColor: '#059669',
    buttonColor: '#059669',
    buttonPressedColor: '#047857',
  },
  logout: {
    icon: 'log-out',
    iconBgColor: '#FEE2E2',
    iconColor: '#DC2626',
    buttonColor: '#DC2626',
    buttonPressedColor: '#B91C1C',
  },
  remove: {
    icon: 'person-remove',
    iconBgColor: '#FEF3C7',
    iconColor: '#D97706',
    buttonColor: '#D97706',
    buttonPressedColor: '#B45309',
  },
  leave: {
    icon: 'exit',
    iconBgColor: '#FEE2E2',
    iconColor: '#DC2626',
    buttonColor: '#DC2626',
    buttonPressedColor: '#B91C1C',
  },
  confirm: {
    icon: 'help-circle',
    iconBgColor: '#E0E7FF',
    iconColor: '#4F46E5',
    buttonColor: '#4F46E5',
    buttonPressedColor: '#4338CA',
  },
  // ✅ NEW: Premium type
  premium: {
    icon: 'diamond',
    iconBgColor: '#FEF3C7',
    iconColor: '#F59E0B',
    buttonColor: '#F59E0B',
    buttonPressedColor: '#D97706',
  },
};

// Premium features to display
const PREMIUM_FEATURES = [
  { icon: 'pie-chart', text: 'Advanced Split Methods' },
  { icon: 'people', text: 'Unlimited Groups & Members' },
  { icon: 'bar-chart', text: 'Analytics Dashboard' },
  { icon: 'download', text: 'Export Reports' },
  { icon: 'eye-off', text: 'Ad-Free Experience' },
];

const ConfirmModal = ({
  visible = false,
  type = 'confirm',
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm = () => {},
  onCancel = () => {},
  loading = false,
  showCancel = true,
  icon = null,
  destructive = false,
}) => {
  const typeConfig = MODAL_TYPES[type] || MODAL_TYPES.confirm;
  const displayIcon = icon || typeConfig.icon;
  const isPremium = type === 'premium';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[
          styles.container, 
          isPremium && styles.containerPremium
        ]}>
          {/* Icon */}
          <View style={[
            styles.iconContainer, 
            { backgroundColor: typeConfig.iconBgColor },
            isPremium && styles.iconContainerPremium
          ]}>
            <Ionicons 
              name={displayIcon} 
              size={isPremium ? 48 : 44} 
              color={typeConfig.iconColor} 
            />
          </View>

          {/* Title */}
          <Text style={[
            styles.title,
            isPremium && styles.titlePremium
          ]}>
            {title}
          </Text>

          {/* Message */}
          {message ? (
            <Text style={[
              styles.message,
              isPremium && styles.messagePremium
            ]}>
              {message}
            </Text>
          ) : null}

          {/* Premium Features List */}
          {isPremium && (
            <View style={styles.premiumFeaturesContainer}>
              <Text style={styles.premiumFeaturesTitle}>What you'll unlock:</Text>
              {PREMIUM_FEATURES.map((feature, index) => (
                <View key={index} style={styles.premiumFeatureRow}>
                  <View style={styles.premiumFeatureIcon}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  </View>
                  <Text style={styles.premiumFeatureText}>{feature.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {showCancel && (
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  isPremium && styles.cancelButtonPremium
                ]}
                onPress={onCancel}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.cancelButtonText,
                  isPremium && styles.cancelButtonTextPremium
                ]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: typeConfig.buttonColor },
                loading && styles.buttonDisabled,
                !showCancel && styles.fullWidthButton,
                isPremium && styles.confirmButtonPremium,
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons 
                    name={isPremium ? 'diamond' : displayIcon} 
                    size={18} 
                    color="white" 
                  />
                  <Text style={styles.confirmButtonText}>{confirmText}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Premium pricing hint */}
          {isPremium && (
            <Text style={styles.premiumPricingHint}>
              Starting at ₹149/month • Cancel anytime
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    width: width - 48,
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  // Premium container styling
  containerPremium: {
    borderWidth: 2,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFEF7',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  // Premium icon styling
  iconContainerPremium: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  // Premium title styling
  titlePremium: {
    color: '#92400E',
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  // Premium message styling
  messagePremium: {
    color: '#B45309',
    marginBottom: 16,
  },
  // Premium features container
  premiumFeaturesContainer: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  premiumFeaturesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 12,
  },
  premiumFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  premiumFeatureIcon: {
    marginRight: 10,
  },
  premiumFeatureText: {
    fontSize: 14,
    color: '#78350F',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Premium cancel button styling
  cancelButtonPremium: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  // Premium cancel button text
  cancelButtonTextPremium: {
    color: '#92400E',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  // Premium confirm button styling
  confirmButtonPremium: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fullWidthButton: {
    flex: 1,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  // Premium pricing hint
  premiumPricingHint: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 14,
    textAlign: 'center',
  },
});

export default ConfirmModal;