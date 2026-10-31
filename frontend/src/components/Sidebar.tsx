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
  Menu,
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  mobileOpen = false,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { user } = useAuth();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const isEmployee = user?.role === "EMPLOYEE";
  const hrRoles = ["SUPER_ADMIN", "HR", "MANAGER", "FINANCE"];

  const navGroups: NavGroup[] = isEmployee
    ? [
        {
          label: "",
          items: [
            { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["EMPLOYEE"] },
            { to: "/employees/me", label: "My Profile", icon: User, roles: ["EMPLOYEE"] },
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
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const renderContent = (isMobileView = false) => {
    const isMini = collapsed && !isMobileView;

    return (
      <aside
        className={`flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-all duration-300 ease-in-out select-none no-scrollbar ${
          isMini ? "w-16" : "w-60"
        }`}
      >
        {/* Header / Logo + Three-line Menu Button inside Sidebar */}
        <div
          className={`flex items-center border-b border-slate-100 dark:border-slate-800 h-16 px-4 ${
            isMini ? "justify-center" : "justify-between"
          }`}
        >
          {isMini ? (
            /* When collapsed: show Three-line Menu button centered to easily expand */
            <button
              onClick={onToggleCollapse}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Expand sidebar"
            >
              <Menu size={20} />
            </button>
          ) : (
            /* When expanded: show Logo + Title + Three-line Menu button on the right */
            <>
              <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
                  <Building2 size={18} />
                </div>
                <div className="min-w-0 transition-opacity duration-200">
                  <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white truncate">
                    LOTUS-HR Portal
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                    {isEmployee ? "Employee Portal" : "HR & Admin Portal"}
                  </p>
                </div>
              </div>

              {!isMobileView && onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
                  title="Collapse sidebar"
                >
                  <Menu size={18} />
                </button>
              )}

              {isMobileView && onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Close menu"
                >
                  <X size={18} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Navigation items with restored comfortable typography and spacing */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-1 no-scrollbar">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter(
              (item) => !user || item.roles.includes(user.role)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label || `group_${groupIdx}`} className="mb-2">
                {/* Group label or divider */}
                {group.label && (
                  isMini ? (
                    <div className="my-2 border-t border-slate-100 dark:border-slate-800/80 mx-2" />
                  ) : (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
                    >
                      <span className="truncate">{group.label}</span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${
                          collapsedGroups[group.label] ? "-rotate-90" : ""
                        }`}
                      />
                    </button>
                  )
                )}

                {/* Items */}
                {(!collapsedGroups[group.label] || isMini) && (
                  <div className="space-y-1">
                    {visibleItems.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={() => onCloseMobile && onCloseMobile()}
                        title={isMini ? label : undefined}
                        className={({ isActive }) =>
                          `group relative flex items-center rounded-xl transition-all ${
                            isMini
                              ? "justify-center h-10 w-10 mx-auto"
                              : "gap-2.5 px-3 py-2 text-sm font-medium"
                          } ${
                            isActive
                              ? "bg-brand-500 text-white shadow-sm font-semibold"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          }`
                        }
                      >
                        <Icon size={18} className="shrink-0" />
                        {!isMini && <span className="truncate">{label}</span>}

                        {/* Floating Tooltip in Mini Mode */}
                        {isMini && (
                          <span className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block dark:bg-slate-800 whitespace-nowrap">
                            {label}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className={`border-t border-slate-100 dark:border-slate-800 text-slate-400 font-medium transition-all ${
            isMini
              ? "h-12 flex items-center justify-center text-[10px]"
              : "px-5 py-3 text-[11px]"
          }`}
        >
          {isMini ? "v2.1" : "v2.1.0 · LOTUS-HR Portal"}
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        {renderContent(false)}
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        >
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div
            className="relative z-10 h-full shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
