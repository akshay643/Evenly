// src/utils/debtReminders.js
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase.config';
import { calcNetBalances, minimizeTransactions } from './minimizeTransactions';

/**
 * Send a debt reminder to a specific person
 */
export async function sendDebtReminder({
  groupId,
  fromUserId,
  toUserId,
  amount,
  message,
}) {
  try {
    // Get sender info
    const fromDoc = await getDoc(doc(db, 'users', fromUserId));
    const toDoc = await getDoc(doc(db, 'users', toUserId));

    const fromData = fromDoc.exists() ? fromDoc.data() : {};
    const toData = toDoc.exists() ? toDoc.data() : {};

    await addDoc(collection(db, 'reminders'), {
      groupId,
      from: fromUserId,
      fromName: fromData.name || fromData.email || 'Unknown',
      to: toUserId,
      toName: toData.name || toData.email || 'Unknown',
      amount,
      message: message || '',
      status: 'sent',    // sent | read | dismissed
      createdAt: Date.now(),
      type: 'manual',    // manual | auto
    });

    return true;
  } catch (e) {
    console.error('Send reminder error:', e);
    throw e;
  }
}

/**
 * Get all pending reminders for a user
 */
export async function getMyReminders(userId) {
  const q = query(
    collection(db, 'reminders'),
    where('to', '==', userId),
    where('status', '==', 'sent')
  );
  const snap = await getDocs(q);
  const reminders = [];
  snap.forEach((d) => reminders.push({ id: d.id, ...d.data() }));
  return reminders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Mark reminder as read/dismissed
 */
export async function dismissReminder(reminderId) {
  await updateDoc(doc(db, 'reminders', reminderId), {
    status: 'dismissed',
    dismissedAt: Date.now(),
  });
}

/**
 * Get all people who owe the current user across all groups
 */
export async function getWhoOwesMe(userId) {
  // 1. Get all groups
  const gSnap = await getDocs(
    query(collection(db, 'groups'), where('members', 'array-contains', userId))
  );

  const debts = [];

  for (const gDoc of gSnap.docs) {
    const group = { id: gDoc.id, ...gDoc.data() };

    // 2. Get expenses for this group
    const expSnap = await getDocs(
      query(collection(db, 'expenses'), where('groupId', '==', group.id))
    );
    const expenses = [];
    expSnap.forEach((d) => expenses.push({ id: d.id, ...d.data() }));

    // 3. Get settlements
    const setSnap = await getDocs(
      query(collection(db, 'settlements'), where('groupId', '==', group.id))
    );
    const settlements = [];
    setSnap.forEach((d) => settlements.push({ id: d.id, ...d.data() }));

    // 4. Calculate who owes me
    const txns = minimizeTransactions(expenses, settlements, group.members);
    const owesMe = txns.filter((t) => t.to === userId);

    owesMe.forEach((t) => {
      debts.push({
        ...t,
        groupId: group.id,
        groupName: group.name,
        groupIcon: group.icon || '👥',
        currency: group.currency || 'INR',
      });
    });
  }

  return debts;
}

/**
 * Check when the last reminder was sent to avoid spam
 */
export async function getLastReminderTime(fromId, toId, groupId) {
  const q = query(
    collection(db, 'reminders'),
    where('from', '==', fromId),
    where('to', '==', toId),
    where('groupId', '==', groupId)
  );
  const snap = await getDocs(q);
  let latest = 0;
  snap.forEach((d) => {
    const t = d.data().createdAt || 0;
    if (t > latest) latest = t;
  });
  return latest;
}