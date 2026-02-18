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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase.config';

export default function AddExpenseScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    loadGroups();
  }, [user]);

  const loadGroups = async () => {
    if (!user) return;
    setLoadingGroups(true);
    try {
      const q = query(
        collection(db, 'groups'),
        where('members', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      const groupsData = [];
      snapshot.forEach((doc) => {
        groupsData.push({ id: doc.id, ...doc.data() });
      });
      setGroups(groupsData);
      
      // If groupId is passed from navigation (from Group screen), select it
      if (route?.params?.groupId) {
        const preSelectedGroup = groupsData.find(g => g.id === route.params.groupId);
        if (preSelectedGroup) {
          setSelectedGroup(preSelectedGroup);
          return;
        }
      }
      // Otherwise select first group by default
      if (groupsData.length > 0) {
        setSelectedGroup(groupsData[0]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      Alert.alert('Error', 'Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleAddExpense = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!selectedGroup) {
      Alert.alert('Error', 'Please select a group');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        description: description.trim(),
        amount: parsedAmount,
        groupId: selectedGroup.id,
        paidBy: user.uid,
        paidByEmail: user.email,
        splitBetween: selectedGroup.members,
        createdAt: Date.now(),
        settled: false,
      });

      Alert.alert('Success', 'Expense added!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to add expense: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Amount Input */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="What was this expense for?"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Select Group */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group</Text>
            {groups.length === 0 ? (
              <Text style={styles.noGroupsText}>
                No groups available. Create a group first.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupChip,
                      selectedGroup?.id === group.id && styles.groupChipSelected,
                    ]}
                    onPress={() => setSelectedGroup(group)}
                  >
                    <Text style={styles.groupChipEmoji}>{group.icon || '👥'}</Text>
                    <Text
                      style={[
                        styles.groupChipText,
                        selectedGroup?.id === group.id && styles.groupChipTextSelected,
                      ]}
                    >
                      {group.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Split Details */}
          {selectedGroup && (
            <View style={styles.splitInfo}>
              <Ionicons name="people-outline" size={20} color="#6B7280" />
              <Text style={styles.splitInfoText}>
                Split equally between {selectedGroup.members.length} members
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addButton, loading && styles.addButtonDisabled]}
          onPress={handleAddExpense}
          disabled={loading}
        >
          <Text style={styles.addButtonText}>
            {loading ? 'Adding...' : 'Add Expense'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  form: {
    padding: 20,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#6366F1',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  groupChipSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  groupChipEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  groupChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  groupChipTextSelected: {
    color: 'white',
  },
  noGroupsText: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  splitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  splitInfoText: {
    marginLeft: 10,
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addButton: {
    backgroundColor: '#6366F1',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});