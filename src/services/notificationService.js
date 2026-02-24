// src/services/notificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.config';

// ═══════════════════════════════════════════════════
// NOTIFICATION HANDLER (works in Expo Go)
// ═══════════════════════════════════════════════════
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ═══════════════════════════════════════════════════
// CHECK IF RUNNING IN EXPO GO
// ═══════════════════════════════════════════════════
const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Register for push notifications and save token to Firestore
 * Note: Remote push doesn't work in Expo Go on Android (SDK 53+)
 */
export async function registerForPushNotifications(userId) {
  // Skip on simulator/emulator
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Warn about Expo Go limitation
  if (isExpoGo && Platform.OS === 'android') {
    console.log('⚠️ Remote push notifications not supported in Expo Go on Android (SDK 53+)');
    console.log('   Local notifications will still work.');
    console.log('   For full push support, use: npx expo run:android');
    // Continue anyway to set up local notification permissions
  }

  try {
    // Check/request permissions
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

    // Set up Android channels (works in Expo Go)
    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    // Try to get push token (may fail in Expo Go)
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.log('No projectId found - push token unavailable');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      // Save token to Firestore
      if (userId && token) {
        await updateDoc(doc(db, 'users', userId), {
          pushToken: token,
          pushTokenUpdatedAt: Date.now(),
          platform: Platform.OS,
        });
        console.log('Push token registered:', token.substring(0, 30) + '...');
      }

      return token;
    } catch (tokenError) {
      // This is expected in Expo Go on Android
      if (isExpoGo) {
        console.log('Push token unavailable in Expo Go (expected)');
      } else {
        console.error('Push token error:', tokenError);
      }
      return null;
    }
  } catch (error) {
    console.error('Notification setup error:', error);
    return null;
  }
}

/**
 * Set up Android notification channels
 */
async function setupAndroidChannels() {
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

/**
 * Send a local notification immediately
 * ✅ WORKS IN EXPO GO
 */
export async function sendLocalNotification({ title, body, data, channelId }) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        ...(Platform.OS === 'android' && channelId && { channelId }),
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error('Local notification error:', error);
  }
}

/**
 * Schedule a notification after X seconds
 * ✅ WORKS IN EXPO GO
 */
export async function scheduleNotificationInSeconds(seconds, { title, body, data }) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    return id;
  } catch (error) {
    console.error('Schedule notification error:', error);
    return null;
  }
}

/**
 * Schedule weekly digest notification
 * ✅ WORKS IN EXPO GO
 */
export async function scheduleWeeklyDigest() {
  try {
    // Cancel existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule weekly digest every Sunday at 10 AM
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Weekly Balance Check',
        body: 'Check your pending balances and settle up with friends!',
        data: { type: 'weekly_digest' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 10,
        minute: 0,
        repeats: true,
      },
    });

    console.log('Weekly digest scheduled');
  } catch (error) {
    console.error('Weekly digest scheduling error:', error);
  }
}

/**
 * Schedule a daily reminder
 * ✅ WORKS IN EXPO GO
 */
export async function scheduleDailyReminder(hour, minute, { title, body, data }) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        repeats: true,
      },
    });
    return id;
  } catch (error) {
    console.error('Daily reminder error:', error);
    return null;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Send push notification via Expo's push service
 * ❌ REQUIRES DEVELOPMENT BUILD FOR ANDROID
 * Call this from your backend or Cloud Functions
 */
export async function sendPushNotification(expoPushToken, { title, body, data }) {
  if (!expoPushToken) {
    console.log('No push token provided');
    return;
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('Push notification sent:', result);
    return result;
  } catch (error) {
    console.error('Push notification error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════
// NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════
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

  paymentReminder: (amount, toName, currency = '₹') => ({
    title: '⏰ Payment Reminder',
    body: `Don't forget: You owe ${currency}${amount.toFixed(2)} to ${toName}`,
    data: { type: 'payment_reminder' },
  }),
};