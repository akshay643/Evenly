// src/components/GroupChat.js
import React, { useState, useEffect, useRef, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase.config";
import { AuthContext } from "../context/AuthContext";
import ChatBubble from "./ChatBubble";

export default function GroupChat({ groupId, membersData }) {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const flatListRef = useRef(null);

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
      setLoading(false);

      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsub();
  }, [groupId]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

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

      // If replying to a message
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
      console.error("Send message error:", e);
      Alert.alert("Error", "Failed to send message");
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
            year:
              d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
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
        onLongPress={() => {
          setReplyingTo(item);
        }}
      >
        {/* Reply preview */}
        {item.replyTo && (
          <View
            style={[
              st.replyPreview,
              isMe ? st.replyPreviewMe : st.replyPreviewOther,
            ]}
          >
            <View style={st.replyBar} />
            <View style={{ flex: 1 }}>
              <Text style={st.replyName}>{item.replyTo.senderName}</Text>
              <Text style={st.replyText} numberOfLines={1}>
                {item.replyTo.text}
              </Text>
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
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
              Replying to{" "}
              {replyingTo.senderId === user.uid
                ? "yourself"
                : replyingTo.senderName}
            </Text>
            <Text style={st.replyIndicatorText} numberOfLines={1}>
              {replyingTo.text}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setReplyingTo(null)}
            style={st.replyIndicatorClose}
          >
            <Ionicons name="close" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={st.inputBar}>
        <View style={st.inputWrapper}>
          <TextInput
            style={st.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
        </View>
        <TouchableOpacity
          style={[
            st.sendBtn,
            (!inputText.trim() || sending) && st.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
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
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  /* ── Empty state ── */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },

  /* ── Messages list ── */
  messagesList: {
    paddingVertical: 10,
    paddingBottom: 10,
  },

  /* ── Date divider ── */
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    paddingHorizontal: 20,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
    marginHorizontal: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
  },

  /* ── Reply preview (inside bubble) ── */
  replyPreview: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginBottom: -4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    maxWidth: "75%",
  },
  replyPreviewMe: {
    alignSelf: "flex-end",
    backgroundColor: "#4F46E5",
  },
  replyPreviewOther: {
    alignSelf: "flex-start",
    marginLeft: 48,
  },
  replyBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#6366F1",
    marginRight: 8,
  },
  replyName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6366F1",
  },
  replyText: {
    fontSize: 12,
    color: "#6B7280",
  },

  /* ── Reply indicator (above input) ── */
  replyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  replyIndicatorBar: {
    width: 3,
    height: "100%",
    minHeight: 30,
    borderRadius: 2,
    backgroundColor: "#6366F1",
    marginRight: 10,
  },
  replyIndicatorName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6366F1",
  },
  replyIndicatorText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 1,
  },
  replyIndicatorClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  /* ── Input bar ── */
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  textInput: {
    fontSize: 16,
    color: "#1F2937",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: "#C7D2FE",
  },
});
