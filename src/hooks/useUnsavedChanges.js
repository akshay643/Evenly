// src/hooks/useUnsavedChanges.js
import { useEffect } from 'react';
import { Alert } from 'react-native';

export default function useUnsavedChanges(navigation, hasChanges) {
  useEffect(() => {
    if (!hasChanges) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges) return;

      e.preventDefault();

      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasChanges]);
}

// Usage in EditExpenseScreen or AddExpenseScreen:
// import useUnsavedChanges from '../hooks/useUnsavedChanges';
// useUnsavedChanges(navigation, hasChanges);