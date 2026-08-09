import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Mail, Lock } from "lucide-react";
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
      const loggedUser = await login(email, password);
      if (loggedUser && loggedUser.profile_complete === false) {
        navigate("/onboard");
      } else {
        navigate("/dashboard");
      }
    } catch {
      setError("Invalid email address or password");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-slate-50 to-indigo-50 p-4 sm:p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-600 via-indigo-600 to-brand-800 p-8 text-white md:flex relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Building2 size={20} />
            </div>
            <div>
              <span className="font-bold text-lg leading-tight block">Workhub HR</span>
              <span className="text-[10px] text-brand-200 uppercase tracking-widest">Enterprise Portal</span>
            </div>
          </div>
          <div className="relative z-10 my-8">
            <h2 className="text-2xl font-bold leading-snug">
              One platform for every branch.
            </h2>
            <p className="mt-2 text-sm text-brand-100 leading-relaxed">
              Idealab · UGC · Vizag — manage employees, attendance, leave, payroll and revenue in one place.
            </p>
          </div>
          <p className="text-xs text-brand-200 relative z-10">© {new Date().getFullYear()} Workhub HR Portal</p>
        </div>

        <div className="p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-400">Sign in to your personal or admin account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <Mail size={14} className="text-brand-500" />
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
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <Lock size={14} className="text-brand-500" />
                Password
              </label>
              <input
                type="password"
                required
                className="input text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3.5 py-2.5 rounded-xl font-medium">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm font-semibold shadow-md">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
