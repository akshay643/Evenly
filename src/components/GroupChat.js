// src/components/GroupChat.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase.config';
import { AuthContext } from '../context/AuthContext';
import { PremiumContext } from '../context/PremiumContext';
import ChatBubble from './ChatBubble';
import Notify from '../utils/notify';

export default function GroupChat({ groupId, membersData, navigation }) {
  const { user } = useContext(AuthContext);
  const { hasFeature, isPremium } = useContext(PremiumContext);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const flatListRef = useRef(null);

  // ✅ Check if chat is available
  const isChatEnabled = hasFeature('groupChat');
  const maxFreeMessages = 20; // Reduced from 100

  // Build a quick lookup: uid → name
  const nameMap = {};
  (membersData || []).forEach((m) => {
    nameMap[m.id] = m.name || m.email || "Unknown";
  });

  useEffect(() => {
    if (!groupId) return;

    const msgRef = collection(db, "groups", groupId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"), limit(200));

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setMessageCount(msgs.filter(m => m.senderId === user.uid).length);
      setLoading(false);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsub();
  }, [groupId]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    // ✅ Check message limit for free users
    if (!isPremium && messageCount >= maxFreeMessages) {
      Notify.warning(`Free limit reached! Upgrade to send unlimited messages.`);
      return;
    }

    setSending(true);
    try {
      const msgRef = collection(db, "groups", groupId, "messages");
      const msgData = {
        text,
        senderId: user.uid,
        senderName: nameMap[user.uid] || user.email || "You",
        senderEmail: user.email,
        createdAt: serverTimestamp(),
        type: "text",
      };

      if (replyingTo) {
        msgData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName,
        };
        setReplyingTo(null);
      }

      await addDoc(msgRef, msgData);
      setInputText("");
    } catch (e) {
      Notify.error('Failed to send message: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Group messages by date ──
  const groupMessagesByDate = (msgs) => {
    const grouped = [];
    let lastDate = "";

    msgs.forEach((msg) => {
      const ts = msg.createdAt;
      let dateStr = "Just now";

      if (ts) {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
          dateStr = "Today";
        } else if (d.toDateString() === yesterday.toDateString()) {
          dateStr = "Yesterday";
        } else {
          dateStr = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
          });
        }
      }

      if (dateStr !== lastDate) {
        grouped.push({
          type: "date",
          date: dateStr,
          id: `date-${dateStr}-${msg.id}`,
        });
        lastDate = dateStr;
      }

      grouped.push({ type: "message", ...msg });
    });

    return grouped;
  };

  const groupedMessages = groupMessagesByDate(messages);

  const renderItem = ({ item }) => {
    if (item.type === "date") {
      return (
        <View style={st.dateDivider}>
          <View style={st.dateLine} />
          <Text style={st.dateText}>{item.date}</Text>
          <View style={st.dateLine} />
        </View>
      );
    }

    const isMe = item.senderId === user.uid;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => setReplyingTo(item)}
      >
        {item.replyTo && (
          <View style={[st.replyPreview, isMe ? st.replyPreviewMe : st.replyPreviewOther]}>
            <View style={st.replyBar} />
            <View style={{ flex: 1 }}>
              <Text style={st.replyName}>{item.replyTo.senderName}</Text>
              <Text style={st.replyText} numberOfLines={1}>{item.replyTo.text}</Text>
            </View>
          </View>
        )}
        <ChatBubble
          message={item.text}
          isMe={isMe}
          senderName={nameMap[item.senderId] || item.senderName || "Unknown"}
          timestamp={item.createdAt}
        />
      </TouchableOpacity>
    );
  };

  // ✅ Premium Gate - Show upgrade screen for free users
  if (!isChatEnabled) {
    return (
      <View style={st.premiumGate}>
        <View style={st.premiumGateContent}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>💬</Text>
          <Text style={st.premiumGateTitle}>Group Chat</Text>
          <Text style={st.premiumGateSubtitle}>Premium Feature</Text>
          <Text style={st.premiumGateDesc}>
            Discuss expenses, plan trips, and coordinate with your group members in real-time.
          </Text>
          
          <View style={st.premiumFeaturesList}>
            <View style={st.premiumFeatureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={st.premiumFeatureText}>Unlimited messages</Text>
            </View>
            <View style={st.premiumFeatureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={st.premiumFeatureText}>Reply to messages</Text>
            </View>
            <View style={st.premiumFeatureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={st.premiumFeatureText}>Real-time sync</Text>
            </View>
          </View>

          <TouchableOpacity
            style={st.upgradeBtn}
            onPress={() => navigation?.navigate('Premium')}
          >
            <Ionicons name="diamond" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={st.upgradeBtnText}>Upgrade for ₹149</Text>
          </TouchableOpacity>
          
          <Text style={st.premiumNote}>One-time payment • Lifetime access</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={st.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={st.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={st.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 60}
    >
      {/* ✅ Free user message limit warning */}
      {!isPremium && (
        <View style={st.limitBanner}>
          <Ionicons name="chatbubbles-outline" size={16} color="#D97706" />
          <Text style={st.limitBannerText}>
            {maxFreeMessages - messageCount} messages left
          </Text>
          <TouchableOpacity onPress={() => navigation?.navigate('Premium')}>
            <Text style={st.limitBannerLink}>Upgrade →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages list */}
      {messages.length === 0 ? (
        <View style={st.emptyContainer}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>💬</Text>
          <Text style={st.emptyTitle}>No messages yet</Text>
          <Text style={st.emptyBody}>
            Start the conversation! Messages are visible to all group members.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={st.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          onLayout={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <View style={st.replyIndicator}>
          <View style={st.replyIndicatorBar} />
          <View style={{ flex: 1 }}>
            <Text style={st.replyIndicatorName}>
              Replying to {replyingTo.senderId === user.uid ? "yourself" : replyingTo.senderName}
            </Text>
            <Text style={st.replyIndicatorText} numberOfLines={1}>
              {replyingTo.text}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={st.replyIndicatorClose}>
            <Ionicons name="close" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={st.inputBar}>
        <View style={st.inputWrapper}>
          <TextInput
            style={st.textInput}
            placeholder={
              !isPremium && messageCount >= maxFreeMessages
                ? "Upgrade to send more..."
                : "Type a message..."
            }
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="default"
            editable={isPremium || messageCount < maxFreeMessages}
          />
        </View>
        <TouchableOpacity
          style={[
            st.sendBtn,
            (!inputText.trim() || sending || (!isPremium && messageCount >= maxFreeMessages)) && st.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending || (!isPremium && messageCount >= maxFreeMessages)}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  // Premium Gate Styles
  premiumGate: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  premiumGateContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  premiumGateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  premiumGateSubtitle: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 12,
  },
  premiumGateDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  premiumFeaturesList: {
    width: '100%',
    marginBottom: 24,
  },
  premiumFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  premiumFeatureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 10,
  },
  upgradeBtn: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
  },

  // Limit Banner
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  limitBannerText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  limitBannerLink: {
    fontSize: 13,
    color: '#D97706',
    fontWeight: '700',
  },

  // Existing styles...
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginHorizontal: 12,
    fontWeight: '500',
  },
  replyPreview: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    marginHorizontal: 40,
  },
  replyPreviewMe: {
    marginLeft: 60,
    marginRight: 8,
  },
  replyPreviewOther: {
    marginLeft: 8,
    marginRight: 60,
  },
  replyBar: {
    width: 3,
    backgroundColor: '#6366F1',
    borderRadius: 2,
    marginRight: 8,
  },
  replyName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: '#6B7280',
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  replyIndicatorBar: {
    width: 3,
    height: 32,
    backgroundColor: '#6366F1',
    borderRadius: 2,
    marginRight: 10,
  },
  replyIndicatorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  replyIndicatorText: {
    fontSize: 13,
    color: '#4B5563',
  },
  replyIndicatorClose: {
    padding: 4,
    marginLeft: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 80,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
});