// src/hooks/useGroupExpenseCount.js
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase.config';

export function useGroupExpenseCount(userId, groupId) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reset when no user or group
    if (!userId || !groupId) {
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Real-time listener: counts expenses this user PAID in this group
    const q = query(
      collection(db, 'expenses'),
      where('groupId', '==', groupId),
      where('paidBy', '==', userId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setCount(snap.size);
        setLoading(false);
      },
      (error) => {
        console.error('useGroupExpenseCount error:', error);
        setCount(0);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId, groupId]);

  return { count, loading };
}