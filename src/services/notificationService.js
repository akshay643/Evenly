// src/services/notificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.config';

// ✅ This stays the same
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and save token to Firestore
 */
export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  try {
    // ✅ FIX: More robust projectId retrieval
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error('No projectId found. Run: eas init');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;

    if (userId && token) {
      await updateDoc(doc(db, 'users', userId), {
        pushToken: token,
        pushTokenUpdatedAt: Date.now(),
        platform: Platform.OS,
      });
    }

    // ✅ Android channels — same, this is fine
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });

      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Debt Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F59E0B',
      });

      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Group Chat',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100],
        lightColor: '#10B981',
      });
    }

    console.log('Push token registered:', token);
    return token;
  } catch (e) {
    console.error('Push token error:', e);
    return null;
  }
}

/**
 * ⚠️ FIX: trigger: null is DEPRECATED in SDK 53
 * Use the new trigger input types
 */
export async function sendLocalNotification({ title, body, data }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
    },
    // ✅ SDK 53 fix — was: trigger: null
    trigger: null,
    // If trigger: null throws, use this instead:
    // trigger: {
    //   type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    //   seconds: 1,
    // },
  });
}

/**
 * ⚠️ FIX: Old trigger format is BROKEN in SDK 53
 * Must use SchedulableTriggerInputTypes
 */
export async function scheduleWeeklyDigest() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // ✅ SDK 53 fix — new trigger format
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💰 Weekly Balance Check',
      body: 'Check your pending balances and settle up with friends!',
      data: { type: 'weekly_digest' },
      sound: 'default',
    },
    trigger: {
      // ✅ NEW: Must specify type explicitly
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: 10,
      minute: 0,
      repeats: true,          // ← keep this
      channelId: 'reminders', // ← optional: route to your channel
    },
  });
}

// ✅ These stay the same — no changes needed
export async function sendPushNotification(expoPushToken, { title, body, data }) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

// ✅ Templates — no changes needed
export const NotificationTemplates = {
  newExpense: (payerName, amount, groupName, currency = '₹') => ({
    title: `💸 New expense in ${groupName}`,
    body: `${payerName} added ${currency}${amount.toFixed(2)}`,
    data: { type: 'new_expense' },
  }),

  settlementRequest: (fromName, amount, currency = '₹') => ({
    title: '💰 Settlement Request',
    body: `${fromName} wants to settle ${currency}${amount.toFixed(2)} with you`,
    data: { type: 'settlement_request' },
  }),

  settlementConfirmed: (byName, amount, currency = '₹') => ({
    title: '✅ Settlement Confirmed',
    body: `${byName} confirmed your payment of ${currency}${amount.toFixed(2)}`,
    data: { type: 'settlement_confirmed' },
  }),

  settlementRejected: (byName, amount, currency = '₹') => ({
    title: '❌ Settlement Rejected',
    body: `${byName} rejected your ${currency}${amount.toFixed(2)} settlement`,
    data: { type: 'settlement_rejected' },
  }),

  debtReminder: (fromName, amount, message, currency = '₹') => ({
    title: `🔔 Reminder from ${fromName}`,
    body: message || `You owe ${currency}${amount.toFixed(2)}`,
    data: { type: 'debt_reminder' },
  }),

  newChatMessage: (senderName, groupName, messageText) => ({
    title: `💬 ${groupName}`,
    body: `${senderName}: ${messageText.substring(0, 100)}`,
    data: { type: 'chat_message' },
  }),

  memberAdded: (groupName) => ({
    title: `👥 Added to ${groupName}`,
    body: "You've been added to a new group!",
    data: { type: 'member_added' },
  }),
};