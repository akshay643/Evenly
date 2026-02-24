// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase.config';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Check if it's an email/password user
        const isEmailProvider = firebaseUser.providerData.some(
          (provider) => provider.providerId === 'password'
        );

        // If email/password user and NOT verified → don't allow access
        if (isEmailProvider && !firebaseUser.emailVerified) {
          console.log('Email not verified, blocking access');
          setUser(null);
        } else {
          // Google users or verified email users → allow access
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};