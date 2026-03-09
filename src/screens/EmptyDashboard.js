// src/components/EmptyDashboard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EmptyDashboard({ onCreateGroup }) {
  return (
    <View style={s.container}>


      <Text style={s.subtitle}>
        Split expenses effortlessly with friends,{'\n'}
        roommates, and travel buddies.
      </Text>

      <View style={s.stepsContainer}>
        <View style={s.step}>
          <View style={[s.stepIcon, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="people" size={20} color="#6366F1" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.stepTitle}>1. Create a Group</Text>
            <Text style={s.stepDesc}>Add your friends, roommates, or travel partners</Text>
          </View>
        </View>

        <View style={s.stepLine} />

        <View style={s.step}>
          <View style={[s.stepIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="receipt" size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.stepTitle}>2. Add Expenses</Text>
            <Text style={s.stepDesc}>Log who paid what — split equally or custom</Text>
          </View>
        </View>

        <View style={s.stepLine} />

        <View style={s.step}>
          <View style={[s.stepIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="wallet" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.stepTitle}>3. Settle Up</Text>
            <Text style={s.stepDesc}>Smart algorithm minimizes payments needed</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.createBtn} onPress={onCreateGroup}>
        <Ionicons name="add-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
        <Text style={s.createBtnTxt}>Create Your First Group</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  stepDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  stepLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 19,
    marginVertical: 4,
  },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnTxt: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});