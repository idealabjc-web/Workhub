import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Building2, Loader2 } from "lucide-react";

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-500/30">
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl leading-tight">LOTUS-HR Portal</h1>
            <p className="text-xs text-brand-400 uppercase tracking-widest font-semibold">Enterprise Session</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-400 font-medium">
          <Loader2 className="animate-spin text-brand-500" size={18} />
          <span>Verifying authentication...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
