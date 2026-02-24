// src/screens/FriendsScreen.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  RefreshControl,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { AuthContext } from '../context/AuthContext';
import * as Contacts from 'expo-contacts';
import { haptic } from '../utils/haptics';

export default function FriendsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [friends, setFriends] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingFriend, setAddingFriend] = useState(null);

  // Contact suggestions
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'pending' | 'sent'

  // Filter/sort
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'recent'

  // ═══════════════════════════════════════
  // LISTENERS
  // ═══════════════════════════════════════
  useEffect(() => {
    if (!user) return;

    // Listen to accepted friends
    const friendsRef = collection(db, 'users', user.uid, 'friends');
    const unsubFriends = onSnapshot(
      query(friendsRef, where('status', '==', 'accepted')),
      async (snap) => {
        const friendsList = [];
        const promises = [];

        snap.forEach((d) => {
          const data = d.data();
          promises.push(
            getDoc(doc(db, 'users', d.id)).then((userDoc) => {
              if (userDoc.exists()) {
                friendsList.push({
                  id: d.id,
                  ...userDoc.data(),
                  addedAt: data.addedAt,
                  nickname: data.nickname || null,
                  favorite: data.favorite || false,
                });
              }
            })
          );
        });

        await Promise.all(promises);
        friendsList.sort((a, b) => {
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
          return (a.name || a.email || '').localeCompare(b.name || b.email || '');
        });
        setFriends(friendsList);
        setLoading(false);
      }
    );

    // Listen to pending received requests
    const unsubReceived = onSnapshot(
      query(friendsRef, where('status', '==', 'pending_received')),
      async (snap) => {
        const list = [];
        const promises = [];

        snap.forEach((d) => {
          promises.push(
            getDoc(doc(db, 'users', d.id)).then((userDoc) => {
              if (userDoc.exists()) {
                list.push({
                  id: d.id,
                  ...userDoc.data(),
                  requestedAt: d.data().requestedAt,
                });
              }
            })
          );
        });

        await Promise.all(promises);
        setPendingReceived(list);
      }
    );

    // Listen to sent requests
    const unsubSent = onSnapshot(
      query(friendsRef, where('status', '==', 'pending_sent')),
      async (snap) => {
        const list = [];
        const promises = [];

        snap.forEach((d) => {
          promises.push(
            getDoc(doc(db, 'users', d.id)).then((userDoc) => {
              if (userDoc.exists()) {
                list.push({
                  id: d.id,
                  ...userDoc.data(),
                  requestedAt: d.data().requestedAt,
                });
              }
            })
          );
        });

        await Promise.all(promises);
        setPendingSent(list);
      }
    );

    return () => {
      unsubFriends();
      unsubReceived();
      unsubSent();
    };
  }, [user]);

  // ═══════════════════════════════════════
  // SEARCH USERS
  // ═══════════════════════════════════════
  const handleSearch = async () => {
    const input = searchInput.trim().toLowerCase();
    if (!input || input.length < 3) {
      Alert.alert('Error', 'Enter at least 3 characters to search');
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setSearchResults([]);

    try {
      const results = [];
      const existingFriendIds = friends.map((f) => f.id);
      const pendingIds = [
        ...pendingSent.map((p) => p.id),
        ...pendingReceived.map((p) => p.id),
      ];

      // Search by email
      if (input.includes('@')) {
        const emailSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', input))
        );
        emailSnap.forEach((d) => {
          if (d.id !== user.uid) {
            results.push({
              id: d.id,
              ...d.data(),
              isFriend: existingFriendIds.includes(d.id),
              isPending: pendingIds.includes(d.id),
            });
          }
        });
      } else {
        // Search by name (starts with)
        const nameSnap = await getDocs(collection(db, 'users'));
        nameSnap.forEach((d) => {
          const data = d.data();
          const name = (data.name || '').toLowerCase();
          const email = (data.email || '').toLowerCase();

          if (
            d.id !== user.uid &&
            (name.includes(input) || email.includes(input))
          ) {
            results.push({
              id: d.id,
              ...data,
              isFriend: existingFriendIds.includes(d.id),
              isPending: pendingIds.includes(d.id),
            });
          }
        });
      }

      setSearchResults(results.slice(0, 20));

      if (results.length === 0) {
        Alert.alert('No Results', 'No users found. Try a different search term or email.');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // ═══════════════════════════════════════
  // SEND FRIEND REQUEST
  // ═══════════════════════════════════════
  const handleSendRequest = async (targetUser) => {
    setAddingFriend(targetUser.id);
    try {
      const now = serverTimestamp();

      // Add to my friends list as pending_sent
      await setDoc(doc(db, 'users', user.uid, 'friends', targetUser.id), {
        status: 'pending_sent',
        requestedAt: now,
      });

      // Add to their friends list as pending_received
      await setDoc(doc(db, 'users', targetUser.id, 'friends', user.uid), {
        status: 'pending_received',
        requestedAt: now,
      });

      // Update search results
      setSearchResults((prev) =>
        prev.map((r) => (r.id === targetUser.id ? { ...r, isPending: true } : r))
      );

      haptic.success();
      Alert.alert('Request Sent! 🎉', `Friend request sent to ${targetUser.name || targetUser.email}`);
    } catch (error) {
      console.error('Send request error:', error);
      Alert.alert('Error', 'Failed to send friend request.');
    } finally {
      setAddingFriend(null);
    }
  };

  // ═══════════════════════════════════════
  // ACCEPT FRIEND REQUEST
  // ═══════════════════════════════════════
  const handleAcceptRequest = async (fromUser) => {
    try {
      const now = serverTimestamp();

      // Update my record
      await setDoc(doc(db, 'users', user.uid, 'friends', fromUser.id), {
        status: 'accepted',
        addedAt: now,
        favorite: false,
      });

      // Update their record
      await setDoc(doc(db, 'users', fromUser.id, 'friends', user.uid), {
        status: 'accepted',
        addedAt: now,
        favorite: false,
      });

      haptic.success();
      Alert.alert('Friend Added! 🎉', `${fromUser.name || fromUser.email} is now your friend!`);
    } catch (error) {
      console.error('Accept error:', error);
      Alert.alert('Error', 'Failed to accept request.');
    }
  };

  // ═══════════════════════════════════════
  // REJECT / CANCEL REQUEST
  // ═══════════════════════════════════════
  const handleRejectRequest = async (targetUserId, isCancel = false) => {
    const action = isCancel ? 'Cancel' : 'Decline';
    Alert.alert(`${action} Request`, `Are you sure?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'friends', targetUserId));
            await deleteDoc(doc(db, 'users', targetUserId, 'friends', user.uid));
            haptic.light();
          } catch (error) {
            Alert.alert('Error', 'Failed to process request.');
          }
        },
      },
    ]);
  };

  // ═══════════════════════════════════════
  // REMOVE FRIEND
  // ═══════════════════════════════════════
  const handleRemoveFriend = (friend) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.name || friend.email} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'friends', friend.id));
              await deleteDoc(doc(db, 'users', friend.id, 'friends', user.uid));
              haptic.warning();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove friend.');
            }
          },
        },
      ]
    );
  };

  // ═══════════════════════════════════════
  // TOGGLE FAVORITE
  // ═══════════════════════════════════════
  const handleToggleFavorite = async (friend) => {
    try {
      const newFavorite = !friend.favorite;
      await setDoc(
        doc(db, 'users', user.uid, 'friends', friend.id),
        { favorite: newFavorite },
        { merge: true }
      );
      haptic.light();
    } catch (error) {
      console.error('Favorite toggle error:', error);
    }
  };

  // ═══════════════════════════════════════
  // SET NICKNAME
  // ═══════════════════════════════════════
  const handleSetNickname = (friend) => {
    Alert.prompt(
      'Set Nickname',
      `Enter a nickname for ${friend.name || friend.email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await setDoc(
              doc(db, 'users', user.uid, 'friends', friend.id),
              { nickname: null },
              { merge: true }
            );
          },
        },
        {
          text: 'Save',
          onPress: async (nickname) => {
            if (nickname?.trim()) {
              await setDoc(
                doc(db, 'users', user.uid, 'friends', friend.id),
                { nickname: nickname.trim() },
                { merge: true }
              );
            }
          },
        },
      ],
      'plain-text',
      friend.nickname || ''
    );
  };

  // ═══════════════════════════════════════
  // LOAD CONTACTS
  // ═══════════════════════════════════════
  const handleLoadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow contacts access in Settings.');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      const suggestions = [];
      data.forEach((c) => {
        (c.emails || []).forEach((e) => {
          suggestions.push({
            name: c.name,
            email: e.email.toLowerCase(),
          });
        });
      });

      setContactSuggestions(suggestions.slice(0, 50));
      setShowContacts(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts.');
    }
  };

  // ═══════════════════════════════════════
  // FILTER FRIENDS
  // ═══════════════════════════════════════
  const getFilteredFriends = () => {
    if (!filterText.trim()) return friends;
    const search = filterText.toLowerCase();
    return friends.filter(
      (f) =>
        (f.name || '').toLowerCase().includes(search) ||
        (f.email || '').toLowerCase().includes(search) ||
        (f.nickname || '').toLowerCase().includes(search)
    );
  };

  const filteredFriends = getFilteredFriends();
  const totalPending = pendingReceived.length + pendingSent.length;

  // ═══════════════════════════════════════
  // RENDER FRIEND CARD
  // ═══════════════════════════════════════
  const renderFriendCard = ({ item }) => {
    const displayName = item.nickname || item.name || 'User';
    const initial = displayName[0]?.toUpperCase() || '?';

    return (
      <TouchableOpacity
        style={st.friendCard}
        onLongPress={() => {
          haptic.medium();
          showFriendOptions(item);
        }}
        activeOpacity={0.7}
      >
        <View style={st.friendLeft}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={st.friendAvatar} />
          ) : (
            <View style={[st.friendAvatarPlaceholder, item.favorite && st.favoriteAvatar]}>
              <Text style={st.friendAvatarText}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={st.friendName}>{displayName}</Text>
              {item.favorite && (
                <Ionicons name="star" size={14} color="#F59E0B" style={{ marginLeft: 4 }} />
              )}
            </View>
            {item.nickname && (
              <Text style={st.friendRealName}>{item.name}</Text>
            )}
            <Text style={st.friendEmail}>{item.email}</Text>
          </View>
        </View>

        <View style={st.friendActions}>
          <TouchableOpacity
            style={st.friendActionBtn}
            onPress={() => handleToggleFavorite(item)}
          >
            <Ionicons
              name={item.favorite ? 'star' : 'star-outline'}
              size={20}
              color={item.favorite ? '#F59E0B' : '#9CA3AF'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={st.friendActionBtn}
            onPress={() => showFriendOptions(item)}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ═══════════════════════════════════════
  // FRIEND OPTIONS (Long Press)
  // ═══════════════════════════════════════
  const showFriendOptions = (friend) => {
    const options = [
      { text: 'Cancel', style: 'cancel' },
      {
        text: friend.favorite ? '★ Remove from Favorites' : '☆ Add to Favorites',
        onPress: () => handleToggleFavorite(friend),
      },
    ];

    // Nickname only works on iOS (Alert.prompt)
    if (Platform.OS === 'ios') {
      options.push({
        text: '✏️ Set Nickname',
        onPress: () => handleSetNickname(friend),
      });
    }

    options.push({
      text: '🗑️ Remove Friend',
      style: 'destructive',
      onPress: () => handleRemoveFriend(friend),
    });

    Alert.alert(
      friend.nickname || friend.name || friend.email,
      'What would you like to do?',
      options
    );
  };

  // ═══════════════════════════════════════
  // RENDER PENDING REQUEST
  // ═══════════════════════════════════════
  const renderPendingCard = ({ item }) => (
    <View style={st.pendingCard}>
      <View style={st.friendLeft}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={st.friendAvatar} />
        ) : (
          <View style={st.friendAvatarPlaceholder}>
            <Text style={st.friendAvatarText}>
              {(item.name || item.email || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.friendName}>{item.name || 'User'}</Text>
          <Text style={st.friendEmail}>{item.email}</Text>
        </View>
      </View>
      <View style={st.pendingActions}>
        <TouchableOpacity
          style={st.acceptBtn}
          onPress={() => handleAcceptRequest(item)}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={st.rejectBtn}
          onPress={() => handleRejectRequest(item.id)}
        >
          <Ionicons name="close" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ═══════════════════════════════════════
  // RENDER SENT REQUEST
  // ═══════════════════════════════════════
  const renderSentCard = ({ item }) => (
    <View style={st.pendingCard}>
      <View style={st.friendLeft}>
        <View style={st.friendAvatarPlaceholder}>
          <Text style={st.friendAvatarText}>
            {(item.name || item.email || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.friendName}>{item.name || 'User'}</Text>
          <Text style={st.friendEmail}>{item.email}</Text>
          <Text style={st.sentLabel}>Request sent</Text>
        </View>
      </View>
      <TouchableOpacity
        style={st.cancelBtn}
        onPress={() => handleRejectRequest(item.id, true)}
      >
        <Text style={st.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // ═══════════════════════════════════════
  // RENDER SEARCH RESULT
  // ═══════════════════════════════════════
  const renderSearchResult = ({ item }) => (
    <View style={st.searchResultCard}>
      <View style={st.friendLeft}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={st.friendAvatar} />
        ) : (
          <View style={st.friendAvatarPlaceholder}>
            <Text style={st.friendAvatarText}>
              {(item.name || item.email || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.friendName}>{item.name || 'User'}</Text>
          <Text style={st.friendEmail}>{item.email}</Text>
        </View>
      </View>

      {item.isFriend ? (
        <View style={st.alreadyFriendBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={st.alreadyFriendText}>Friends</Text>
        </View>
      ) : item.isPending ? (
        <View style={st.pendingBadge}>
          <Ionicons name="time-outline" size={16} color="#F59E0B" />
          <Text style={st.pendingBadgeText}>Pending</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={st.addFriendBtn}
          onPress={() => handleSendRequest(item)}
          disabled={addingFriend === item.id}
        >
          {addingFriend === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="person-add" size={16} color="#fff" />
              <Text style={st.addFriendBtnText}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // ═══════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════
  if (loading) {
    return (
      <View style={st.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Friends</Text>
        <TouchableOpacity
          onPress={() => setShowSearchModal(true)}
          style={st.headerAddBtn}
        >
          <Ionicons name="person-add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={st.statsBar}>
        <View style={st.statItem}>
          <Text style={st.statNumber}>{friends.length}</Text>
          <Text style={st.statLabel}>Friends</Text>
        </View>
        <View style={st.statDivider} />
        <View style={st.statItem}>
          <Text style={st.statNumber}>{friends.filter((f) => f.favorite).length}</Text>
          <Text style={st.statLabel}>Favorites</Text>
        </View>
        <View style={st.statDivider} />
        <View style={st.statItem}>
          <Text style={[st.statNumber, pendingReceived.length > 0 && { color: '#EF4444' }]}>
            {pendingReceived.length}
          </Text>
          <Text style={st.statLabel}>Requests</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabBar}>
        <TouchableOpacity
          style={[st.tab, activeTab === 'friends' && st.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'friends' ? '#6366F1' : '#9CA3AF'}
            style={{ marginRight: 4 }}
          />
          <Text style={[st.tabText, activeTab === 'friends' && st.tabTextActive]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.tab, activeTab === 'pending' && st.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Ionicons
            name="mail"
            size={16}
            color={activeTab === 'pending' ? '#6366F1' : '#9CA3AF'}
            style={{ marginRight: 4 }}
          />
          <Text style={[st.tabText, activeTab === 'pending' && st.tabTextActive]}>
            Requests
          </Text>
          {pendingReceived.length > 0 && (
            <View style={st.badgeCount}>
              <Text style={st.badgeCountText}>{pendingReceived.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.tab, activeTab === 'sent' && st.tabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Ionicons
            name="paper-plane"
            size={16}
            color={activeTab === 'sent' ? '#6366F1' : '#9CA3AF'}
            style={{ marginRight: 4 }}
          />
          <Text style={[st.tabText, activeTab === 'sent' && st.tabTextActive]}>
            Sent ({pendingSent.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'friends' && (
        <>
          {/* Search Bar */}
          {friends.length > 3 && (
            <View style={st.filterBar}>
              <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={st.filterInput}
                placeholder="Search friends..."
                value={filterText}
                onChangeText={setFilterText}
                placeholderTextColor="#9CA3AF"
              />
              {filterText.length > 0 && (
                <TouchableOpacity onPress={() => setFilterText('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <FlatList
            data={filteredFriends}
            renderItem={renderFriendCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => {}} />
            }
            ListEmptyComponent={
              <View style={st.emptyState}>
                <Text style={{ fontSize: 64, marginBottom: 16 }}>👋</Text>
                <Text style={st.emptyTitle}>No friends yet</Text>
                <Text style={st.emptyText}>
                  Add friends so you can quickly add them to groups!
                </Text>
                <TouchableOpacity
                  style={st.emptyBtn}
                  onPress={() => setShowSearchModal(true)}
                >
                  <Ionicons name="person-add" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={st.emptyBtnText}>Find Friends</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </>
      )}

      {activeTab === 'pending' && (
        <FlatList
          data={pendingReceived}
          renderItem={renderPendingCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={st.emptyState}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>📭</Text>
              <Text style={st.emptyTitle}>No pending requests</Text>
              <Text style={st.emptyText}>
                When someone sends you a friend request, it will appear here.
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'sent' && (
        <FlatList
          data={pendingSent}
          renderItem={renderSentCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={st.emptyState}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>📤</Text>
              <Text style={st.emptyTitle}>No sent requests</Text>
              <Text style={st.emptyText}>
                Friend requests you've sent will appear here.
              </Text>
            </View>
          }
        />
      )}

      {/* ═══ SEARCH / ADD FRIEND MODAL ═══ */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowSearchModal(false);
          setSearchResults([]);
          setSearchInput('');
          setShowContacts(false);
          setContactSuggestions([]);
        }}
      >
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Add Friends</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSearchModal(false);
                  setSearchResults([]);
                  setSearchInput('');
                  setShowContacts(false);
                  setContactSuggestions([]);
                }}
              >
                <Ionicons name="close" size={26} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={st.searchRow}>
              <TextInput
                style={st.searchInput}
                placeholder="Search by name or email..."
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={st.searchBtn}
                onPress={handleSearch}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Contact Suggestions Button */}
            <TouchableOpacity style={st.contactsBtn} onPress={handleLoadContacts}>
              <Ionicons name="people-circle" size={20} color="#6366F1" style={{ marginRight: 8 }} />
              <Text style={st.contactsBtnText}>Find from Contacts</Text>
            </TouchableOpacity>

            {/* Contact Suggestions List */}
            {showContacts && contactSuggestions.length > 0 && searchResults.length === 0 && (
              <FlatList
                data={contactSuggestions}
                keyExtractor={(item, index) => `contact-${index}`}
                style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={st.contactRow}
                    onPress={() => {
                      setSearchInput(item.email);
                      setShowContacts(false);
                      setContactSuggestions([]);
                    }}
                  >
                    <View style={st.contactAvatar}>
                      <Text style={st.contactAvatarText}>
                        {(item.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.contactName}>{item.name}</Text>
                      <Text style={st.contactEmail}>{item.email}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              />
            )}

            {/* Search Results */}
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={
                !searching && searchInput.length > 0 && searchResults.length === 0 ? (
                  <View style={{ alignItems: 'center', padding: 30 }}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
                    <Text style={{ color: '#6B7280', textAlign: 'center' }}>
                      Search for friends by name or email address
                    </Text>
                  </View>
                ) : null
              }
            />

            <Text style={st.modalHint}>
              💡 Tip: Search by exact email for best results
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════
// Need Platform import for nickname feature
// ═══════════════════════════════════════
import { Platform } from 'react-native';

/* ───────── Styles ───────── */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  headerAddBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },

  // Stats
  statsBar: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 10 },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#6366F1' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#6366F1' },
  badgeCount: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: 4 },
  badgeCountText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Filter
  filterBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  filterInput: { flex: 1, fontSize: 15, color: '#1F2937', padding: 0 },

  // Friend Card
  friendCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 8, marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  friendLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  friendAvatar: { width: 48, height: 48, borderRadius: 24 },
  friendAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  favoriteAvatar: { backgroundColor: '#F59E0B' },
  friendAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  friendName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  friendRealName: { fontSize: 12, color: '#6366F1', fontStyle: 'italic' },
  friendEmail: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  friendActions: { flexDirection: 'row', alignItems: 'center' },
  friendActionBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  // Pending Card
  pendingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 8, marginTop: 4, borderWidth: 1.5, borderColor: '#C7D2FE' },
  pendingActions: { flexDirection: 'row', alignItems: 'center' },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  sentLabel: { fontSize: 11, color: '#F59E0B', fontWeight: '600', marginTop: 2 },

  // Search Result
  searchResultCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addFriendBtnText: { color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  alreadyFriendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  alreadyFriendText: { color: '#10B981', fontWeight: '600', fontSize: 12, marginLeft: 4 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  pendingBadgeText: { color: '#F59E0B', fontWeight: '600', fontSize: 12, marginLeft: 4 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: '#F3F4F6', padding: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB', color: '#1F2937' },
  searchBtn: { backgroundColor: '#6366F1', padding: 14, borderRadius: 12, marginLeft: 8 },
  contactsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#C7D2FE' },
  contactsBtnText: { color: '#6366F1', fontWeight: '600', fontSize: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  contactAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  contactAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  contactName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  contactEmail: { fontSize: 12, color: '#6B7280' },
  modalHint: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 16 },
});