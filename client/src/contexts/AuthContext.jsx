import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { authApi } from '../services/endpoints/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore user session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await authApi.getMe();
        if (res?.data?.user) {
          setUser(res.data.user);
        }
      } catch (err) {
        // Not logged in or expired session
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Google OAuth Login
  const loginWithGoogle = async () => {
    setError(null);
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      
      const res = await authApi.login(idToken);
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Dev mode mock login (for fast local development and testing)
  const loginWithMock = async (role = 'admin') => {
    setError(null);
    try {
      setLoading(true);
      const res = await authApi.login(`mock_${role}`, {
        email: `${role}@festops.local`,
        name: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`
      });
      setUser(res.data.user);
      return res.data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      await authApi.logout();
      try { await fbSignOut(auth); } catch (_) {}
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Refresh current user session
  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res?.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
    } catch (_) {}
  };

  // Update profile
  const updateProfile = async (data) => {
    const res = await authApi.updateProfile(data);
    if (res?.data?.user) {
      setUser(res.data.user);
      return res.data.user;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      loginWithGoogle,
      loginWithMock,
      logout,
      refreshUser,
      updateProfile,
      isAdmin: user?.role === 'admin',
      isSenior: user?.role === 'senior' || user?.role === 'admin',
      isJunior: user?.role === 'junior'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
