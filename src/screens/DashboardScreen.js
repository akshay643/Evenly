import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, onSnapshot, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase.config';

export default function DashboardScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalOwe, setTotalOwe] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('👥');
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [creating, setCreating] = useState(false);

  const groupIcons = ['👥', '🏠', '✈️', '🍕', '🎉', '💼', '🏖️', '🎬', '⚽', '🎮'];
  const currencies = [
    // { code: 'USD', symbol: '$', name: 'US Dollar' },
    // { code: 'EUR', symbol: '€', name: 'Euro' },
    // { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    // { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    // { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    // { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  ];

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const groupsData = [];
      snapshot.forEach((doc) => {
        groupsData.push({ id: doc.id, ...doc.data() });
      });
      setGroups(groupsData);
      setLoading(false);

      // Calculate real balances from all group expenses
      try {
        let owe = 0;
        let owed = 0;
        for (const g of groupsData) {
          const expSnap = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', g.id)));
          expSnap.forEach((d) => {
            const { paidBy, amount, splitBetween } = d.data();
            if (!splitBetween) return;
            const share = amount / splitBetween.length;
            if (paidBy === user.uid) {
              // I paid — others owe me their shares
              owed += amount - share; // total minus my own share
            } else if (splitBetween.includes(user.uid)) {
              // Someone else paid, I owe my share
              owe += share;
            }
          });
          // Subtract settlements
          const setSnap = await getDocs(query(collection(db, 'settlements'), where('groupId', '==', g.id)));
          setSnap.forEach((d) => {
            const { from, to, amount } = d.data();
            if (from === user.uid) owe -= amount;     // I paid someone
            if (to === user.uid) owed -= amount;       // someone paid me
          });
        }
        setTotalOwe(Math.max(0, owe));
        setTotalOwed(Math.max(0, owed));
      } catch (e) {
        console.error('Balance calc error:', e);
      }
    });

    // Listen for pending settlement requests addressed to me
    const rq = query(collection(db, 'settlementRequests'), where('to', '==', user.uid));
    const unsubReq = onSnapshot(rq, (snap) => {
      let count = 0;
      snap.forEach((d) => { if (d.data().status === 'pending') count++; });
      setPendingCount(count);
    });

    return () => { unsubscribe(); unsubReq(); };
  }, [user]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      await addDoc(collection(db, 'groups'), {
        name: newGroupName.trim(),
        icon: selectedIcon,
        currency: selectedCurrency,
        members: [user.uid],
        memberEmails: [user.email],
        createdBy: user.uid,
        createdAt: Date.now(),
      });

      setShowCreateModal(false);
      setNewGroupName('');
      setSelectedIcon('👥');
      setSelectedCurrency('USD');
      Alert.alert('Success', 'Group created successfully!');
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderGroupCard = ({ item }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => navigation.navigate('Group', { groupId: item.id })}
    >
      <View style={styles.groupIcon}>
        <Text style={styles.groupEmoji}>{item.icon || '👥'}</Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMembers}>{item.members.length} members</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Evenly</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddExpense')}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Pending Settlement Banner */}
      {pendingCount > 0 && (
        <TouchableOpacity style={styles.pendingBanner}>
          <Ionicons name="notifications" size={20} color="#92400E" style={styles.pendingBannerIcon} />
          <Text style={styles.pendingBannerText}>
            {pendingCount} settlement request{pendingCount > 1 ? 's' : ''} waiting for you
          </Text>
        </TouchableOpacity>
      )}

      {/* Balance Summary */}
      <View style={styles.balanceContainer}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>You owe</Text>
          <Text style={[styles.balanceAmount, styles.red]}>
            ₹{totalOwe.toFixed(2)}
          </Text>
        </View>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Owed to you</Text>
          <Text style={[styles.balanceAmount, styles.green]}>
            ₹{totalOwed.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Groups List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(true)}>
            <Text style={styles.createGroupText}>+ Create Group</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📱</Text>
            <Text style={styles.emptyText}>No groups yet</Text>
            <Text style={styles.emptySubtext}>Create your first group to start splitting bills</Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            renderItem={renderGroupCard}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={() => {}} />
            }
          />
        )}
      </View>

      {/* Create Group Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Icon Selection */}
              <Text style={styles.inputLabel}>Choose an icon</Text>
              <View style={styles.iconGrid}>
                {groupIcons.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon && styles.iconOptionSelected,
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <Text style={styles.iconEmoji}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Group Name Input */}
              <Text style={styles.inputLabel}>Group name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Roommates, Trip to Paris"
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholderTextColor="#9CA3AF"
              />

              {/* Currency Selection */}
              <Text style={styles.inputLabel}>Currency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {currencies.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyChip,
                      selectedCurrency === curr.code && styles.currencyChipSelected,
                    ]}
                    onPress={() => setSelectedCurrency(curr.code)}
                  >
                    <Text style={[
                      styles.currencySymbol,
                      selectedCurrency === curr.code && styles.currencySymbolSelected
                    ]}>{curr.symbol}</Text>
                    <Text style={[
                      styles.currencyCode,
                      selectedCurrency === curr.code && styles.currencyCodeSelected
                    ]}>{curr.code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.createButton, creating && styles.createButtonDisabled]}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                <Text style={styles.createButtonText}>
                  {creating ? 'Creating...' : 'Create Group'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    // paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#6366F1',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceContainer: {
    flexDirection: 'row',
    padding: 20,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 7.5,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  red: {
    color: '#EF4444',
  },
  green: {
    color: '#10B981',
  },
  section: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  createGroupText: {
    color: '#6366F1',
    fontWeight: '600',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupEmoji: {
    fontSize: 24,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
    marginTop: 10,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  iconOption: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    margin: 5,
  },
  iconOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  iconEmoji: {
    fontSize: 28,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
  },
  pendingBannerIcon: {
    marginRight: 8,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  currencyChipSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginRight: 6,
  },
  currencySymbolSelected: {
    color: '#fff',
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  currencyCodeSelected: {
    color: '#fff',
  },
});