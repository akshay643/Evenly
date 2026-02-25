// src/screens/EditExpenseScreen.js
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.config';
import SplitMethodPicker from '../components/SplitMethodPicker';

export default function EditExpenseScreen({ navigation, route }) {
  const { expense, groupId, membersData: passedMembers } = route.params;
  const { user } = useContext(AuthContext);

  const [description, setDescription] = useState(expense.description || '');
  const [amount, setAmount] = useState(String(expense.amount || ''));
  const [membersData, setMembersData] = useState(passedMembers || []);
  const [selectedMembers, setSelectedMembers] = useState(expense.splitBetween || []);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [group, setGroup] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Split data from SplitMethodPicker
  const [splitData, setSplitData] = useState({
    method: expense.splitMethod || 'equal',
    splitAmounts: expense.splitAmounts || {},
    isValid: true,
  });

  const parsedAmount = parseFloat(amount) || 0;

  useEffect(() => {
    loadGroup();
  }, []);

  // Track changes
  useEffect(() => {
    const descChanged = description !== expense.description;
    const amtChanged = parsedAmount !== expense.amount;
    const membersChanged =
      JSON.stringify([...selectedMembers].sort()) !==
      JSON.stringify([...(expense.splitBetween || [])].sort());
    const methodChanged = splitData.method !== (expense.splitMethod || 'equal');

    setHasChanges(descChanged || amtChanged || membersChanged || methodChanged);
  }, [description, amount, selectedMembers, splitData]);

  const loadGroup = async () => {
    try {
      const gDoc = await getDoc(doc(db, 'groups', groupId));
      if (gDoc.exists()) {
        const gData = { id: gDoc.id, ...gDoc.data() };
        setGroup(gData);

        // If members weren't passed, fetch them
        if (!passedMembers || passedMembers.length === 0) {
          setLoadingMembers(true);
          const members = await Promise.all(
            (gData.members || []).map(async (mid) => {
              const d = await getDoc(doc(db, 'users', mid));
              return d.exists()
                ? { id: mid, ...d.data() }
                : { id: mid, name: null, email: 'Unknown' };
            })
          );
          setMembersData(members);
          setLoadingMembers(false);
        }
      }
    } catch (e) {
      console.error('Load group error:', e);
    }
  };

  const getCurrencySymbol = () => {
    const map = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$' };
    return map[group?.currency] || '₹';
  };
  const sym = getCurrencySymbol();

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert('Error', 'Select at least one member');
      return;
    }
    if (!splitData.isValid) {
      Alert.alert('Error', 'Split amounts don\'t add up correctly');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        description: description.trim(),
        amount: parsedAmount,
        splitBetween: selectedMembers,
        splitMethod: splitData.method,
        editedAt: Date.now(),
        editedBy: user.uid,
      };

      if (splitData.method !== 'equal') {
        updateData.splitAmounts = splitData.splitAmounts;
      } else {
        updateData.splitAmounts = null;
      }

      await updateDoc(doc(db, 'expenses', expense.id), updateData);

      Alert.alert('Updated!', 'Expense has been updated. Balances recalculated automatically.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to update: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard Changes?', 'You have unsaved changes.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  // What changed summary
  const getChangesSummary = () => {
    const changes = [];
    if (description !== expense.description) changes.push('description');
    if (parsedAmount !== expense.amount) changes.push('amount');
    if (
      JSON.stringify([...selectedMembers].sort()) !==
      JSON.stringify([...(expense.splitBetween || [])].sort())
    ) changes.push('split members');
    if (splitData.method !== (expense.splitMethod || 'equal')) changes.push('split method');
    return changes;
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleDiscard} style={s.headerBtn}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerTitle}>Edit Expense</Text>
            {hasChanges && (
              <Text style={s.headerSub}>Unsaved changes</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleSave}
            style={[s.saveBtn, (!hasChanges || loading) && { opacity: 0.4 }]}
            disabled={!hasChanges || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.saveBtnTxt}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Original vs edited indicator */}
          <View style={s.editBanner}>
            <Ionicons name="create-outline" size={18} color="#6366F1" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.editBannerTitle}>
                Editing: {expense.description}
              </Text>
              <Text style={s.editBannerSub}>
                Original: {sym}{expense.amount.toFixed(2)} • {expense.splitBetween?.length || 0} people
              </Text>
            </View>
          </View>

          {/* Amount */}
          <View style={s.amountContainer}>
            <Text style={s.currencySymbol}>{sym}</Text>
            <TextInput
              style={s.amountInput}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
            {parsedAmount !== expense.amount && parsedAmount > 0 && (
              <View style={s.amountDiff}>
                <Ionicons
                  name={parsedAmount > expense.amount ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={parsedAmount > expense.amount ? '#EF4444' : '#10B981'}
                />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: parsedAmount > expense.amount ? '#EF4444' : '#10B981',
                  marginLeft: 2,
                }}>
                  {sym}{Math.abs(parsedAmount - expense.amount).toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Description</Text>
            <TextInput
              style={s.input}
              placeholder="What was this expense for?"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Split picker */}
          {!loadingMembers && membersData.length > 0 && (
            <View style={s.inputGroup}>
              <SplitMethodPicker
                members={membersData}
                totalAmount={parsedAmount}
                currentUserId={user.uid}
                currencySymbol={sym}
                selectedMembers={selectedMembers}
                onSelectedMembersChange={setSelectedMembers}
                onSplitDataChange={setSplitData}
              />
            </View>
          )}

          {loadingMembers && (
            <ActivityIndicator size="small" color="#6366F1" style={{ marginVertical: 20 }} />
          )}

          {/* Changes preview */}
          {hasChanges && (
            <View style={s.changesCard}>
              <View style={s.changesHead}>
                <Ionicons name="git-compare-outline" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={s.changesTitle}>Changes Preview</Text>
              </View>
              {getChangesSummary().map((change, i) => (
                <View key={i} style={s.changeRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={s.changeTxt}>
                    {change.charAt(0).toUpperCase() + change.slice(1)} will be updated
                  </Text>
                </View>
              ))}
              <Text style={s.changesNote}>
                💡 All balances and settlement plans will be recalculated automatically.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  headerSub: { fontSize: 11, color: '#F59E0B', fontWeight: '600', marginTop: 1 },
  saveBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  editBannerTitle: { fontSize: 14, fontWeight: '600', color: '#4338CA' },
  editBannerSub: { fontSize: 12, color: '#6366F1', marginTop: 2 },

  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  currencySymbol: { fontSize: 42, fontWeight: 'bold', color: '#6366F1', marginRight: 10 },
  amountInput: { flex: 1, fontSize: 42, fontWeight: 'bold', color: '#1F2937' },
  amountDiff: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 10 },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  changesCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginTop: 8,
  },
  changesHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  changesTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  changeTxt: { fontSize: 13, color: '#92400E' },
  changesNote: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
});