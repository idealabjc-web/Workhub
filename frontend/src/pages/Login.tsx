import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      setError("Invalid email address or password");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white md:flex">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <Building2 size={18} />
            </div>
            <span className="font-semibold">HR Portal</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold leading-snug">
              One platform for every branch.
            </h2>
            <p className="mt-2 text-sm text-brand-100">
              Idealab · UGC · Vizag — manage employees, attendance, leave, payroll and revenue in one place.
            </p>
          </div>
          <p className="text-xs text-brand-200">© {new Date().getFullYear()} HR Portal</p>
        </div>

        <div className="p-8 flex flex-col justify-center">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Mail size={15} className="text-brand-500" />
                Email ID
              </label>
              <input
                type="email"
                required
                className="input text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email ID"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                type="password"
                required
                className="input text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
