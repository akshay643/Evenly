// src/components/ExpenseReactions.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase.config';

const REACTIONS = [
  { emoji: '👍', key: 'thumbsUp' },
  { emoji: '😂', key: 'laugh' },
  { emoji: '😱', key: 'shocked' },
  { emoji: '💸', key: 'money' },
  { emoji: '🔥', key: 'fire' },
];

export default function ExpenseReactions({ expenseId, reactions = {}, userId }) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReact = async (reactionKey) => {
    try {
      const ref = doc(db, 'expenses', expenseId);
      const currentUsers = reactions[reactionKey] || [];
      const hasReacted = currentUsers.includes(userId);

      await updateDoc(ref, {
        [`reactions.${reactionKey}`]: hasReacted
          ? arrayRemove(userId)
          : arrayUnion(userId),
      });

      setShowPicker(false);
    } catch (e) {
      console.error('Reaction error:', e);
    }
  };

  // Count total reactions
  const reactionCounts = {};
  Object.entries(reactions || {}).forEach(([key, users]) => {
    if (Array.isArray(users) && users.length > 0) {
      reactionCounts[key] = users.length;
    }
  });

  const hasAnyReactions = Object.keys(reactionCounts).length > 0;

  return (
    <View style={s.container}>
      {/* Existing reactions */}
      {hasAnyReactions && (
        <View style={s.existingRow}>
          {Object.entries(reactionCounts).map(([key, count]) => {
            const r = REACTIONS.find((x) => x.key === key);
            const iMeReacted = (reactions[key] || []).includes(userId);
            return (
              <TouchableOpacity
                key={key}
                style={[s.reactionBubble, iMeReacted && s.reactionBubbleMine]}
                onPress={() => handleReact(key)}
              >
                <Text style={s.reactionEmoji}>{r?.emoji || '👍'}</Text>
                <Text style={[s.reactionCount, iMeReacted && { color: '#6366F1' }]}>
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Add reaction button */}
      <TouchableOpacity
        style={s.addBtn}
        onPress={() => setShowPicker(!showPicker)}
      >
        <Text style={{ fontSize: 14 }}>😀</Text>
        <Text style={s.addBtnTxt}>+</Text>
      </TouchableOpacity>

      {/* Picker */}
      {showPicker && (
        <View style={s.picker}>
          {REACTIONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={s.pickerItem}
              onPress={() => handleReact(r.key)}
            >
              <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
  },
  existingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionBubbleMine: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginBottom: 4,
  },
  addBtnTxt: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  picker: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  pickerItem: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
});