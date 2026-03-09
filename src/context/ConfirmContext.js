// context/ConfirmContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'confirm',
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
    onCancel: () => {},
    loading: false,
    showCancel: true,
    icon: null,
  });

  const show = useCallback((config) => {
    setModalConfig({
      visible: true,
      type: config.type || 'confirm',
      title: config.title || 'Are you sure?',
      message: config.message || '',
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      showCancel: config.showCancel !== false,
      icon: config.icon || null,
      loading: false,
      onConfirm: async () => {
        if (config.onConfirm) {
          setModalConfig((prev) => ({ ...prev, loading: true }));
          try {
            await config.onConfirm();
          } finally {
            setModalConfig((prev) => ({ ...prev, visible: false, loading: false }));
          }
        } else {
          setModalConfig((prev) => ({ ...prev, visible: false }));
        }
      },
      onCancel: () => {
        if (config.onCancel) config.onCancel();
        setModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  }, []);

  const hide = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  // Shorthand methods
  const confirm = useCallback((title, message, onConfirm) => {
    show({ type: 'confirm', title, message, onConfirm, confirmText: 'Confirm' });
  }, [show]);

  const danger = useCallback((title, message, onConfirm) => {
    show({ type: 'danger', title, message, onConfirm, confirmText: 'Delete' });
  }, [show]);

  const warning = useCallback((title, message, onConfirm) => {
    show({ type: 'warning', title, message, onConfirm, confirmText: 'Continue' });
  }, [show]);

  const success = useCallback((title, message, onConfirm) => {
    show({ type: 'success', title, message, onConfirm, confirmText: 'Done', showCancel: false });
  }, [show]);

  const logout = useCallback((onConfirm) => {
    show({
      type: 'logout',
      title: 'Logout?',
      message: 'Are you sure you want to logout from your account?',
      confirmText: 'Logout',
      onConfirm,
    });
  }, [show]);

  // ✅ NEW: Premium upgrade prompt
  const premium = useCallback((featureName, onUpgrade) => {
    show({
      type: 'premium',
      title: '🔒 Premium Feature',
      message: `${featureName} is available with Premium. Upgrade to unlock this and many more features!`,
      confirmText: 'Upgrade ',
      cancelText: 'Maybe Later',
      icon: 'diamond',
      onConfirm: onUpgrade,
    });
  }, [show]);

  return (
    <ConfirmContext.Provider 
      value={{ 
        show, 
        hide, 
        confirm, 
        danger, 
        warning, 
        success, 
        logout,
        premium,  // ← ADD THIS
      }}
    >
      {children}
      <ConfirmModal {...modalConfig} />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};