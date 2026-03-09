// src/components/PaymentInfoCard.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Notify from '../utils/notify';

export default function PaymentInfoCard({ memberData, amount, currencySymbol }) {
  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    Notify.success( `${label} copied to clipboard`);
  };

  if (!memberData) return null;

  const { upiId, bankAccount, bankIfsc, phone } = memberData;
  const hasPaymentInfo = upiId || bankAccount || phone;

  if (!hasPaymentInfo) return null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Ionicons name="card-outline" size={18} color="#6366F1" style={{ marginRight: 8 }} />
        <Text style={s.title}>Payment Details</Text>
      </View>

      {upiId && (
        <TouchableOpacity
          style={s.row}
          onPress={() => copyToClipboard(upiId, 'UPI ID')}
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📱</Text>
            <View>
              <Text style={s.rowLabel}>UPI ID</Text>
              <Text style={s.rowValue}>{upiId}</Text>
            </View>
          </View>
          <Ionicons name="copy-outline" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {phone && (
        <TouchableOpacity
          style={s.row}
          onPress={() => copyToClipboard(phone, 'Phone number')}
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📞</Text>
            <View>
              <Text style={s.rowLabel}>Phone</Text>
              <Text style={s.rowValue}>{phone}</Text>
            </View>
          </View>
          <Ionicons name="copy-outline" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {bankAccount && (
        <TouchableOpacity
          style={s.row}
          onPress={() =>
            copyToClipboard(
              `A/C: ${bankAccount}${bankIfsc ? ` | IFSC: ${bankIfsc}` : ''}`,
              'Bank details'
            )
          }
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>🏦</Text>
            <View>
              <Text style={s.rowLabel}>Bank Account</Text>
              <Text style={s.rowValue}>{bankAccount}</Text>
              {bankIfsc && <Text style={s.rowSub}>IFSC: {bankIfsc}</Text>}
            </View>
          </View>
          <Ionicons name="copy-outline" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {amount > 0 && (
        <TouchableOpacity
          style={s.row}
          onPress={() => copyToClipboard(amount.toFixed(2), 'Amount')}
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>💰</Text>
            <View>
              <Text style={s.rowLabel}>Amount to Pay</Text>
              <Text style={[s.rowValue, { color: '#6366F1', fontWeight: 'bold' }]}>
                {currencySymbol}{amount.toFixed(2)}
              </Text>
            </View>
          </View>
          <Ionicons name="copy-outline" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { fontSize: 18, marginRight: 10 },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  rowValue: { fontSize: 14, color: '#1F2937', fontWeight: '600', marginTop: 1 },
  rowSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
});