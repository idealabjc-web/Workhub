import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../api/client";

export interface AuthUser {
  email: string;
  role: string;
  employee_id?: string;
  full_name?: string;
  profile_complete?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: (token: string) => Promise<AuthUser>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("hr_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("hr_token");
    if (token) {
      api.get("/api/employees/me").then((r) => {
        if (r.data) {
          setUser((prev) => {
            if (!prev) return prev;
            const updated: AuthUser = {
              ...prev,
              employee_id: r.data.id,
              full_name: `${r.data.first_name} ${r.data.last_name}`,
              profile_complete: true,
            };
            localStorage.setItem("hr_user", JSON.stringify(updated));
            return updated;
          });
        }
      }).catch(() => {});
    }
  }, []);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { access_token, role, employee_id, full_name, profile_complete } = res.data;
      localStorage.setItem("hr_token", access_token);
      const authUser: AuthUser = { email, role, employee_id, full_name, profile_complete };
      localStorage.setItem("hr_user", JSON.stringify(authUser));
      setUser(authUser);
      return authUser;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (token: string): Promise<AuthUser> => {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/google", { token });
      const { access_token, role, employee_id, full_name, profile_complete } = res.data;
      localStorage.setItem("hr_token", access_token);
      const authUser: AuthUser = { email: res.data.email, role, employee_id, full_name, profile_complete };
      localStorage.setItem("hr_user", JSON.stringify(authUser));
      setUser(authUser);
      return authUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("hr_token");
    localStorage.removeItem("hr_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
