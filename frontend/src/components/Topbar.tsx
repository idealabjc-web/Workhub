import { Moon, Sun, LogOut, Search, Bell, X, Menu, Palette } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme, ColorTheme } from "../context/ThemeContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "../api/client";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface TopbarProps {
  onToggleMobile?: () => void;
}

const COLOR_OPTIONS: { id: ColorTheme; label: string; colorHex: string }[] = [
  { id: "orange", label: "Lotus Orange & White", colorHex: "#ea580c" },
  { id: "blue", label: "Classic Blue", colorHex: "#2563eb" },
  { id: "emerald", label: "Emerald Green", colorHex: "#059669" },
  { id: "purple", label: "Royal Purple", colorHex: "#7c3aed" },
  { id: "teal", label: "Ocean Teal", colorHex: "#0d9488" },
];

export default function Topbar({ onToggleMobile }: TopbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colorTheme, setColorTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [showNotif, setShowNotif] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/api/notifications").then((r) => {
      setNotifs(r.data);
      setUnread(r.data.filter((n: Notification) => !n.is_read).length);
    }).catch(() => {});
  }, [showNotif]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowPalette(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/employees?search=${encodeURIComponent(search.trim())}`);
    }
  };

  const markAllRead = async () => {
    await api.patch("/api/notifications/mark-all-read").catch(() => {});
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const typeColor: Record<string, string> = {
    INFO: "bg-blue-100 text-blue-600",
    SUCCESS: "bg-emerald-100 text-emerald-600",
    WARNING: "bg-amber-100 text-amber-600",
    ERROR: "bg-red-100 text-red-600",
  };

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/70 px-4 sm:px-6 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 z-10">
      {/* Mobile Hamburger + Search */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        {onToggleMobile && (
          <button
            onClick={onToggleMobile}
            className="md:hidden btn-secondary !px-2.5 !py-2 shrink-0"
            title="Open Menu"
          >
            <Menu size={18} />
          </button>
        )}

        <form onSubmit={handleSearch} className="relative w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-xs sm:text-sm"
            placeholder="Search employees, departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Color Palette Selector */}
        <div className="relative" ref={paletteRef}>
          <button
            onClick={() => setShowPalette((s) => !s)}
            className="btn-secondary !px-2.5 !py-2 flex items-center gap-1.5"
            title="Change Theme Color Palette"
          >
            <Palette size={16} className="text-brand-500" />
            <span className="hidden md:inline text-xs font-semibold text-slate-600 dark:text-slate-300">Theme</span>
          </button>

          {showPalette && (
            <div className="absolute right-0 top-full mt-2 w-52 card p-3 shadow-xl z-50 space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                Color Theme Palette
              </p>
              <div className="space-y-1">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setColorTheme(opt.id);
                      setShowPalette(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                      colorTheme === opt.id
                        ? "bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full shrink-0 border border-black/10 shadow-sm"
                      style={{ backgroundColor: opt.colorHex }}
                    />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dark/Light mode toggle */}
        <button onClick={toggleTheme} className="btn-secondary !px-2.5 !py-2" title="Toggle Light/Dark Mode">
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif((s) => !s)}
            className="btn-secondary !px-2.5 !py-2 relative"
            title="Notifications"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 card shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-semibold">Notifications</p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-brand-500 hover:underline">
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotif(false)}>
                    <X size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifs.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
                )}
                {notifs.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      !n.is_read ? "bg-brand-50 dark:bg-brand-950/20" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeColor[n.type] || "bg-slate-100 text-slate-600"}`}>
                        {n.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.is_read && (
                        <div className="h-1.5 w-1.5 mt-1.5 rounded-full bg-brand-500 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2 pl-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
            {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight">{user?.full_name || user?.email}</p>
            <p className="text-[10px] capitalize text-slate-400">{user?.role?.replace("_", " ").toLowerCase()}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="btn-secondary !px-2.5 !py-2"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
