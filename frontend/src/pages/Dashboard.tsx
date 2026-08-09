import { useEffect, useState } from "react";
import {
  Users, UserCheck, CalendarOff, UserPlus, Cake, Award, CheckCircle2,
  AlertCircle, DollarSign, Wallet, Activity, Bell, Megaphone, Sparkles,
  Calendar, TrendingUp, Plus, ChevronRight, FileText, Building2, CalendarDays,
  Receipt, CreditCard, Mail, Phone, MapPin, Briefcase, Clock, ShieldCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Stats {
  total_employees: number;
  active_employees: number;
  present_today: number;
  absent_today: number;
  on_leave: number;
  new_joiners_this_month: number;
  upcoming_birthdays: number;
  upcoming_anniversaries: number;
  attendance_percentage: number;
  pending_leaves: number;
  pending_expenses: number;
  monthly_payroll: number;
  total_revenue_this_month: number;
  today_activities: number;
  unread_notifications: number;
}

interface RecentData {
  recent_leaves: any[];
  recent_moments: any[];
  upcoming_events: any[];
  announcements: any[];
}

interface EmployeeDetail {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  blood_group?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  emergency_contact?: string;
  date_of_joining: string;
  designation?: string;
  branch: string;
  employment_type: string;
  status: string;
  basic_salary?: number;
}

interface LeaveBalance {
  id: string;
  leave_type: string;
  total: number;
  used: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentData | null>(null);
  const [empDetail, setEmpDetail] = useState<EmployeeDetail | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  const isEmployeeOnly = user?.role === "EMPLOYEE";

  useEffect(() => {
    api.get("/api/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/api/dashboard/recent-activity").then((r) => setRecent(r.data)).catch(() => {});

    if (user?.employee_id) {
      api.get(`/api/employees/${user.employee_id}`).then((r) => setEmpDetail(r.data)).catch(() => {});
      api.get(`/api/employees/${user.employee_id}/leave-balances`).then((r) => setBalances(r.data)).catch(() => {});
    }
  }, [user?.employee_id]);

  const fmt = (num: number) => `₹${(num / 100000).toFixed(1)}L`;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="card p-5 sm:p-6 bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-800 text-white border-0 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5">
                {isEmployeeOnly ? "Personal Employee Portal" : "HR & Admin Portal"}
              </span>
              <span className="text-xs text-brand-100">
                {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mt-1.5 leading-tight">
              Welcome, {empDetail ? `${empDetail.first_name} ${empDetail.last_name}` : user?.full_name || user?.email}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-brand-100 mt-1">
              {isEmployeeOnly
                ? `Registered Email: ${user?.email}`
                : "Manage organization staff, attendance, payroll, and branch operations."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button onClick={() => navigate("/attendance")} className="rounded-xl bg-white/20 px-3.5 py-2 text-xs sm:text-sm font-medium backdrop-blur-sm hover:bg-white/30 transition">
              My Attendance
            </button>
            {isEmployeeOnly ? (
              <button onClick={() => navigate("/leaves")} className="rounded-xl bg-white text-brand-700 px-3.5 py-2 text-xs sm:text-sm font-bold shadow-sm hover:bg-brand-50 transition">
                Apply Leave
              </button>
            ) : (
              <button onClick={() => navigate("/employees")} className="rounded-xl bg-white text-brand-700 px-3.5 py-2 text-xs sm:text-sm font-bold shadow-sm hover:bg-brand-50 transition">
                + Add Employee
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PERSONAL IMPORTED PROFILE CARD FOR LOGGED-IN EMPLOYEES */}
      {isEmployeeOnly && (
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 text-lg font-bold shrink-0">
                {empDetail ? `${empDetail.first_name[0]}${empDetail.last_name[0]}` : user?.email[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                    {empDetail ? `${empDetail.first_name} ${empDetail.last_name}` : user?.full_name || "Employee"}
                  </h2>
                  <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 gap-1 text-[11px] shrink-0">
                    <ShieldCheck size={13} /> Verified Employee
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {empDetail?.employee_number || "EMP-ID"} · {empDetail?.designation || "Staff Member"}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/employees/${user?.employee_id || ""}`)}
              className="btn-secondary text-xs gap-1.5 self-start sm:self-auto shrink-0"
            >
              View Full Profile <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <CreditCard size={18} className="text-brand-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Payment Email ID</p>
                <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate" title={user?.email}>
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <Building2 size={18} className="text-violet-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Assigned Branch</p>
                <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate">
                  {empDetail?.branch || "IDEALAB"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <Briefcase size={18} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Employment Type</p>
                <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate">
                  {empDetail?.employment_type || "Full-Time"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <CalendarDays size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date of Joining</p>
                <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate">
                  {empDetail?.date_of_joining ? new Date(empDetail.date_of_joining).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid - HR Admin View */}
      {stats && !isEmployeeOnly && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard title="Total Staff" val={stats.total_employees} icon={Users} color="text-brand-600" bg="bg-brand-50 dark:bg-brand-950/30" onClick={() => navigate("/employees")} />
          <StatCard title="Present Today" val={stats.present_today} icon={UserCheck} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/30" onClick={() => navigate("/attendance")} />
          <StatCard title="On Leave" val={stats.on_leave} icon={CalendarOff} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950/30" onClick={() => navigate("/leaves")} />
          <StatCard title="Attendance" val={`${stats.attendance_percentage}%`} icon={CheckCircle2} color="text-teal-600" bg="bg-teal-50 dark:bg-teal-950/30" onClick={() => navigate("/attendance")} />
          <StatCard title="Pending Leaves" val={stats.pending_leaves} icon={AlertCircle} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950/30" onClick={() => navigate("/leaves")} highlight={stats.pending_leaves > 0} />
          <StatCard title="Pending Expenses" val={stats.pending_expenses} icon={DollarSign} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-950/30" onClick={() => navigate("/expenses")} highlight={stats.pending_expenses > 0} />
          <StatCard title="Monthly Payroll" val={fmt(stats.monthly_payroll)} icon={Wallet} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/30" onClick={() => navigate("/payroll")} />
          <StatCard title="Monthly Revenue" val={fmt(stats.total_revenue_this_month)} icon={TrendingUp} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-950/30" onClick={() => navigate("/revenue")} />
          <StatCard title="New Joiners" val={stats.new_joiners_this_month} icon={UserPlus} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/30" onClick={() => navigate("/employees")} />
          <StatCard title="Birthdays" val={stats.upcoming_birthdays} icon={Cake} color="text-pink-600" bg="bg-pink-50 dark:bg-pink-950/30" onClick={() => navigate("/moments")} />
          <StatCard title="Notifications" val={stats.unread_notifications} icon={Bell} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-950/30" highlight={stats.unread_notifications > 0} />
        </div>
      )}

      {/* Restricted Employee Overview & Leave Tracker Cards */}
      {isEmployeeOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 space-y-2 cursor-pointer hover:border-brand-400 transition" onClick={() => navigate("/attendance")}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">My Attendance Rate</span>
              <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {stats ? `${stats.attendance_percentage}%` : "100%"}
            </p>
            <p className="text-xs text-slate-400">Click to view monthly Pagara grid</p>
          </div>

          <div className="card p-4 sm:p-5 space-y-2 cursor-pointer hover:border-brand-400 transition" onClick={() => navigate("/leaves")}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">My Leave Balances</span>
              <CalendarDays className="text-amber-500 shrink-0" size={18} />
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {balances.length > 0 ? (
                balances.slice(0, 3).map((b) => (
                  <div key={b.id}>
                    <p className="text-[10px] text-slate-400 capitalize">{b.leave_type.toLowerCase()}</p>
                    <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{b.total - b.used} days</p>
                  </div>
                ))
              ) : (
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">12 Days Available</p>
              )}
            </div>
          </div>

          <div className="card p-4 sm:p-5 space-y-2 cursor-pointer hover:border-brand-400 transition" onClick={() => navigate("/calendar")}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400">Company Calendar</span>
              <Calendar className="text-violet-500 shrink-0" size={18} />
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 pt-1">
              View upcoming holidays & company events
            </p>
            <p className="text-xs text-brand-600 font-semibold hover:underline">Open Calendar →</p>
          </div>
        </div>
      )}

      {/* Main Widgets Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Announcements & Moments */}
        <div className="space-y-6 lg:col-span-2">
          {/* Announcements Board */}
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Megaphone size={18} className="text-brand-500" /> Latest Announcements
              </h3>
              <button onClick={() => navigate("/announcements")} className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:underline">
                View all <ChevronRight size={13} />
              </button>
            </div>
            <div className="space-y-2">
              {recent?.announcements?.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-xs sm:text-sm text-slate-900 dark:text-white truncate">{a.title}</p>
                    <span className={`badge text-[10px] shrink-0 ${a.priority === "URGENT" ? "bg-red-100 text-red-700" : a.priority === "HIGH" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {a.priority}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(a.date).toLocaleDateString()}</p>
                </div>
              ))}
              {(!recent?.announcements || recent.announcements.length === 0) && (
                <p className="text-xs text-slate-400 py-4 text-center">No announcements</p>
              )}
            </div>
          </div>

          {/* Moments & Celebrations */}
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Sparkles size={18} className="text-brand-500" /> Moments & Celebrations
              </h3>
              <button onClick={() => navigate("/moments")} className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:underline">
                View feed <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent?.recent_moments?.map((m) => (
                <div key={m.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-600 dark:bg-pink-950/30 text-base">
                    ✨
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{m.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{m.category} · {m.date}</p>
                  </div>
                </div>
              ))}
              {(!recent?.recent_moments || recent.recent_moments.length === 0) && (
                <p className="text-xs text-slate-400 py-4 text-center sm:col-span-2">No recent moments</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Events & Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-4 sm:p-5 space-y-3">
            <h3 className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => navigate("/leaves")} className="flex flex-col items-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition text-center">
                <CalendarDays size={18} className="text-brand-500 mb-1" />
                <span className="text-xs font-medium">Apply Leave</span>
              </button>
              <button onClick={() => navigate("/attendance")} className="flex flex-col items-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition text-center">
                <UserCheck size={18} className="text-brand-500 mb-1" />
                <span className="text-xs font-medium">Attendance</span>
              </button>
              <button onClick={() => navigate("/calendar")} className="flex flex-col items-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition text-center">
                <Calendar size={18} className="text-brand-500 mb-1" />
                <span className="text-xs font-medium">Calendar</span>
              </button>
              <button onClick={() => navigate(`/employees/${user?.employee_id || ""}`)} className="flex flex-col items-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition text-center">
                <Users size={18} className="text-brand-500 mb-1" />
                <span className="text-xs font-medium">My Profile</span>
              </button>
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm flex items-center gap-2">
                <Calendar size={16} className="text-brand-500" /> Upcoming Events
              </h3>
              <button onClick={() => navigate(isEmployeeOnly ? "/calendar" : "/events")} className="text-xs text-brand-600 font-semibold hover:underline">
                All events
              </button>
            </div>
            <div className="space-y-2.5">
              {recent?.upcoming_events?.map((ev) => (
                <div key={ev.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                  <p className="font-medium text-xs text-slate-900 dark:text-white truncate">{ev.name}</p>
                  <p className="text-[10px] text-slate-400">📅 {new Date(ev.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} · {ev.location || "Office"}</p>
                </div>
              ))}
              {(!recent?.upcoming_events || recent.upcoming_events.length === 0) && (
                <p className="text-xs text-slate-400 py-2 text-center">No upcoming events</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, val, icon: Icon, color, bg, onClick, highlight }: {
  title: string; val: any; icon: React.ElementType; color: string; bg: string; onClick?: () => void; highlight?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 transition hover:shadow-md cursor-pointer ${
        highlight ? "ring-2 ring-amber-400 dark:ring-amber-500" : ""
      }`}
    >
      <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">{title}</p>
        <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">{val}</p>
      </div>
    </div>
  );
}
