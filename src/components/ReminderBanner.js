// src/components/ReminderBanner.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase.config';
import { dismissReminder } from '../utils/debtReminders';

export default function ReminderBanner({ onNavigateToGroup }) {
  const { user } = useContext(AuthContext);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'reminders'),
      where('to', '==', user.uid),
      where('status', '==', 'sent')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setReminders(list);
    });

    return () => unsub();
  }, [user]);

  const handleDismiss = async (id) => {
    try {
      await dismissReminder(id);
    } catch (e) {
      console.error('Dismiss error:', e);
    }
  };

  const getCurrencySymbol = (currency) => {
    const map = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
    return map[currency] || '₹';
  };

  if (reminders.length === 0) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Ionicons name="notifications" size={18} color="#92400E" style={{ marginRight: 8 }} />
        <Text style={s.headerTxt}>
          {reminders.length} Reminder{reminders.length > 1 ? 's' : ''}
        </Text>
      </View>

      {reminders.slice(0, 3).map((r) => (
        <View key={r.id} style={s.reminderCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.fromName}>{r.fromName} nudged you! 👋</Text>
            <Text style={s.amount}>₹{r.amount?.toFixed(2)}</Text>
            {r.message ? (
              <Text style={s.message} numberOfLines={2}>"{r.message}"</Text>
            ) : null}
          </View>
          <View style={s.actions}>
            <TouchableOpacity
              style={s.payBtn}
              onPress={() => onNavigateToGroup?.(r.groupId)}
            >
              <Text style={s.payBtnTxt}>Pay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.dismissBtn}
              onPress={() => handleDismiss(r.id)}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {reminders.length > 3 && (
        <Text style={s.moreTxt}>+{reminders.length - 3} more reminders</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  fromName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  amount: { fontSize: 18, fontWeight: 'bold', color: '#EF4444', marginTop: 2 },
  message: { fontSize: 12, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  payBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  payBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  moreTxt: { fontSize: 12, color: '#92400E', textAlign: 'center', marginTop: 4 },
});