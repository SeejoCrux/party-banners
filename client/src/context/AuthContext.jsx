import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const SAMPLE_PERSONAS = [
  {
    name: 'Seejo Crux',
    email: 'seejo.crux@gmail.com',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=SeejoCrux',
    isAdmin: true,
    isSuperAdmin: true,
    role: 'Super Admin'
  },
  {
    name: 'Test Admin',
    email: 'test.admin@example.com',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=TestAdmin',
    isAdmin: true,
    isSuperAdmin: false,
    role: 'Admin'
  },
  {
    name: 'Morgan Cruz',
    email: 'morgan@example.com',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Morgan',
    isAdmin: false,
    isSuperAdmin: false,
    role: 'Fan',
    honor: 'Good'
  },
  {
    name: 'Jordan Chen',
    email: 'jordan@example.com',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jordan',
    isAdmin: false,
    isSuperAdmin: false,
    role: 'Fan',
    honor: 'Good'
  },
  {
    name: 'Sam Taylor',
    email: 'sam@example.com',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sam',
    isAdmin: false,
    isSuperAdmin: false,
    role: 'Fan',
    honor: 'Good'
  },
  {
    name: 'Alex Rivera',
    email: 'alex@example.com',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
    isAdmin: false,
    isSuperAdmin: false,
    role: 'Fan',
    honor: 'Good'
  }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('tapestry_auth_token'));
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authConfig, setAuthConfig] = useState({
    devLoginEnabled: true,
    googleClientIdConfigured: false,
    googleClientId: null,
    environment: 'development'
  });

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/auth/config');
        if (res.ok) {
          const data = await res.json();
          setAuthConfig(data);
        }
      } catch (e) {
        console.error('Failed to fetch auth config:', e);
      }
    }
    fetchConfig();
  }, []);

  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Token invalid or expired or user banned
          localStorage.removeItem('tapestry_auth_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
        localStorage.removeItem('tapestry_auth_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [token]);

  const loginWithToken = (newToken, userData) => {
    localStorage.setItem('tapestry_auth_token', newToken);
    setToken(newToken);
    setUser(userData);
    setIsAuthModalOpen(false);
  };

  const loginWithDev = async (name, email, avatarUrl, isAdmin = false) => {
    const res = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        avatar_url: avatarUrl,
        is_admin: isAdmin
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    loginWithToken(data.token, data.user);
    return data.user;
  };

  const loginWithGoogle = async (credential) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Google Sign-In failed');
    }
    loginWithToken(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('tapestry_auth_token');
    setToken(null);
    setUser(null);
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const refreshUserProfile = async () => {
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user;
      }
    } catch (e) {
      console.error('Failed to refresh user profile:', e);
    }
    return null;
  };

  const isAdmin = !!(user && (user.is_admin === 1 || user.is_admin === true || user.is_super_admin === 1 || user.is_super_admin === true));
  const isSuperAdmin = !!(user && (user.is_super_admin === 1 || user.is_super_admin === true));

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        isAdmin,
        isSuperAdmin,
        loading,
        authConfig,
        devLoginEnabled: authConfig.devLoginEnabled,
        googleClientIdConfigured: authConfig.googleClientIdConfigured,
        googleClientId: authConfig.googleClientId,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithToken,
        loginWithDev,
        loginWithGoogle,
        logout,
        refreshUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
