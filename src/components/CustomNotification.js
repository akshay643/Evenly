// components/CustomNotification.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CustomNotification = ({ title, description, alertType }) => {
  const getAlertConfig = () => {
    switch (alertType) {
      case 'success':
        return {
          backgroundColor: '#10B981',
          icon: 'checkmark-circle',
          shadowColor: '#10B981',
        };
      case 'error':
        return {
          backgroundColor: '#EF4444',
          icon: 'close-circle',
          shadowColor: '#EF4444',
        };
      case 'warn':
        return {
          backgroundColor: '#F59E0B',
          icon: 'warning',
          shadowColor: '#F59E0B',
        };
      case 'info':
      default:
        return {
          backgroundColor: '#3B82F6',
          icon: 'information-circle',
          shadowColor: '#3B82F6',
        };
    }
  };

  const config = getAlertConfig();

  return (
    <View style={[styles.container, { 
      backgroundColor: config.backgroundColor,
      shadowColor: config.shadowColor,
    }]}>
      <Ionicons name={config.icon} size={24} color="#FFFFFF" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 50, // Push below status bar
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10, // High elevation for Android
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    color: '#F3F4F6',
    marginTop: 2,
  },
});

export default CustomNotification;