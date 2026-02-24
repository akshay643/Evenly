// src/hooks/useNotifications.js
import { useEffect, useRef, useContext } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import {
  registerForPushNotifications,
  scheduleWeeklyDigest,
} from '../services/notificationService';

export default function useNotifications() {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!user) return;

    const setupNotifications = async () => {
      try {
        // Register for push notifications (will show warning in Expo Go but won't crash)
        await registerForPushNotifications(user.uid);

        // Schedule weekly digest (local notification - works in Expo Go)
        await scheduleWeeklyDigest();
      } catch (error) {
        // Silently handle errors in Expo Go
        console.log('Notification setup (may fail in Expo Go):', error.message);
      }
    };

    setupNotifications();

    // Listener: notification received while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    // Listener: user tapped on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);

        handleNotificationNavigation(data, navigation);
      }
    );

    // Cleanup
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user, navigation]);
}

/**
 * Handle navigation based on notification type
 */
function handleNotificationNavigation(data, navigation) {
  if (!data?.type) return;

  switch (data.type) {
    case 'new_expense':
    case 'member_added':
      if (data.groupId) {
        navigation.navigate('Group', { groupId: data.groupId });
      }
      break;

    case 'settlement_request':
    case 'settlement_confirmed':
    case 'settlement_rejected':
    case 'debt_reminder':
      if (data.groupId) {
        navigation.navigate('SettleUp', { groupId: data.groupId });
      }
      break;

    case 'chat_message':
      if (data.groupId) {
        navigation.navigate('Group', { groupId: data.groupId });
      }
      break;

    case 'weekly_digest':
      navigation.navigate('Activity');
      break;

    default:
      break;
  }
}