// utils/notify.js
import { Notifier } from 'react-native-notifier';
import CustomNotification from '../components/CustomNotification';

const Notify = {
  success: (message, title = 'Success') => {
    Notifier.showNotification({
      title,
      description: message,
      Component: CustomNotification,
      componentProps: {
        title,
        description: message,
        alertType: 'success',
      },
      duration: 3000,
    });
  },

  error: (message, title = 'Error') => {
    Notifier.showNotification({
      title,
      description: message,
      Component: CustomNotification,
      componentProps: {
        title,
        description: message,
        alertType: 'error',
      },
      duration: 4000,
    });
  },

  warning: (message, title = 'Warning') => {
    Notifier.showNotification({
      title,
      description: message,
      Component: CustomNotification,
      componentProps: {
        title,
        description: message,
        alertType: 'warn',
      },
      duration: 3000,
    });
  },

  info: (message, title = 'Info') => {
    Notifier.showNotification({
      title,
      description: message,
      Component: CustomNotification,
      componentProps: {
        title,
        description: message,
        alertType: 'info',
      },
      duration: 3000,
    });
  },
};

export default Notify;