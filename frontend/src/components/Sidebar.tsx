import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Receipt,
  TrendingUp,
  Sparkles,
  CalendarHeart,
  Megaphone,
  PartyPopper,
  FolderOpen,
  BarChart3,
  DollarSign,
  Building2,
  Settings as SettingsIcon,
  ChevronDown,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const isEmployee = user?.role === "EMPLOYEE";
  const hrRoles = ["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"];

  const navGroups: NavGroup[] = isEmployee
    ? [
        {
          label: "",
          items: [
            { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["EMPLOYEE"] },
            { to: `/employees/${user?.employee_id || ""}`, label: "My Profile", icon: User, roles: ["EMPLOYEE"] },
          ],
        },
        {
          label: "My Workplace",
          items: [
            { to: "/attendance", label: "My Attendance", icon: CalendarCheck, roles: ["EMPLOYEE"] },
            { to: "/leaves", label: "My Leaves", icon: CalendarDays, roles: ["EMPLOYEE"] },
          ],
        },
        {
          label: "Company",
          items: [
            { to: "/calendar", label: "Company Calendar", icon: CalendarHeart, roles: ["EMPLOYEE"] },
            { to: "/announcements", label: "Announcements", icon: Megaphone, roles: ["EMPLOYEE"] },
            { to: "/moments", label: "Moments", icon: Sparkles, roles: ["EMPLOYEE"] },
          ],
        },
      ]
    : [
        {
          label: "",
          items: [
            { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: hrRoles },
          ],
        },
        {
          label: "People",
          items: [
            { to: "/employees", label: "Employees", icon: Users, roles: ["SUPER_ADMIN", "HR", "MANAGER"] },
            { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: hrRoles },
            { to: "/leaves", label: "Leaves", icon: CalendarDays, roles: hrRoles },
          ],
        },
        {
          label: "Payroll",
          items: [
            { to: "/payroll", label: "Salary / Payroll", icon: Wallet, roles: ["SUPER_ADMIN", "HR", "FINANCE"] },
            { to: "/payslips", label: "Payslips", icon: Receipt, roles: ["SUPER_ADMIN", "HR", "FINANCE"] },
          ],
        },
        {
          label: "Performance & Finance",
          items: [
            { to: "/revenue", label: "Revenue", icon: TrendingUp, roles: ["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"] },
            { to: "/expenses", label: "Expenses", icon: DollarSign, roles: hrRoles },
          ],
        },
        {
          label: "Company",
          items: [
            { to: "/moments", label: "Moments", icon: Sparkles, roles: hrRoles },
            { to: "/events", label: "Events", icon: CalendarHeart, roles: hrRoles },
            { to: "/announcements", label: "Announcements", icon: Megaphone, roles: hrRoles },
            { to: "/holidays", label: "Holidays", icon: PartyPopper, roles: hrRoles },
          ],
        },
        {
          label: "Resources & System",
          items: [
            { to: "/documents", label: "Documents", icon: FolderOpen, roles: hrRoles },
            { to: "/reports", label: "Reports", icon: BarChart3, roles: ["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"] },
            { to: "/settings", label: "Settings & Audit", icon: SettingsIcon, roles: ["SUPER_ADMIN", "HR"] },
          ],
        },
      ];

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const sidebarContent = (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
            <Building2 size={18} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white">HR Portal</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
              {isEmployee ? "Employee Portal" : "HR & Admin Portal"}
            </p>
          </div>
        </div>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !user || item.roles.includes(user.role)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label || "main"} className="mb-1.5">
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
                >
                  {group.label}
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${collapsed[group.label] ? "-rotate-90" : ""}`}
                  />
                </button>
              )}
              {!collapsed[group.label] && (
                <div className="space-y-0.5">
                  {visibleItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => onCloseMobile && onCloseMobile()}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-brand-500 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        }`
                      }
                    >
                      <Icon size={17} className="shrink-0" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
        v2.1.0 · Workhub HR Portal
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200" onClick={onCloseMobile}>
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-200" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
