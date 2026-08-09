import { createContext, useContext, useState, ReactNode } from "react";
import api from "../api/client";

interface AuthUser {
  email: string;
  role: string;
  employee_id?: string;
  full_name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { access_token, role, employee_id, full_name } = res.data;
      localStorage.setItem("hr_token", access_token);
      const authUser = { email, role, employee_id, full_name };
      localStorage.setItem("hr_user", JSON.stringify(authUser));
      setUser(authUser);
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
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
