import { createContext, useContext, useState, useEffect } from 'react';
import { apiGet, apiPost } from '../utils/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount — read token from localStorage and validate it.
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    apiGet('/auth/me')
      .then((res) => {
        setToken(storedToken);
        setUser(res.data);
      })
      .catch(() => {
        // Token is invalid or expired — clean up and stay logged out.
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email, password) => {
    const res = await apiPost('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return res.data;
  };

  const register = async (email, password, fullName, phone) => {
    const res = await apiPost('/auth/register', {
      email,
      password,
      fullName,
      phone,
    });
    return res.data;
  };

  // Switch the signed-in user between jobseeker and recruiter. The backend
  // re-issues a JWT carrying the new role, so we persist it like login.
  const toggleRole = async (role) => {
    const res = await apiPost('/auth/role', { role });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  // Update just the display name on the signed-in user (e.g. after a profile
  // save) so the navbar greeting stays in sync without a full reload.
  const setUserFullName = (fullName) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = fullName && String(fullName).trim() ? String(fullName).trim() : prev.fullName;
      return next === prev.fullName ? prev : { ...prev, fullName: next };
    });
  };

  // Sync the avatar URL into the user state so the navbar avatar updates
  // immediately after an upload without requiring a page reload.
  const setUserAvatarUrl = (avatarUrl) => {
    setUser((prev) => {
      if (!prev) return prev;
      return prev.avatarUrl === avatarUrl ? prev : { ...prev, avatarUrl };
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, toggleRole, logout, setUserFullName, setUserAvatarUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
