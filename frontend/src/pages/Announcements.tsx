import { useEffect, useState } from "react";
import { Plus, Trash2, Megaphone, AlertCircle, Info, Flame } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Announcement {
  id: string;
  title: string;
  description: string;
  date: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  branch?: string;
  created_at?: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  NORMAL: { label: "Normal", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800", icon: Info },
  HIGH:   { label: "High Priority", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800", icon: AlertCircle },
  URGENT: { label: "Urgent Notice", color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800", icon: Flame },
};

const EMPTY_FORM = {
  title: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
  priority: "NORMAL",
  branch: "",
};

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { user } = useAuth();
  const canManage = user && ["SUPER_ADMIN", "HR"].includes(user.role);

  const load = () => {
    const params: any = {};
    if (priorityFilter) params.priority = priorityFilter;
    if (branchFilter) params.branch = branchFilter;
    api.get("/api/announcements", { params }).then((r) => setItems(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [priorityFilter, branchFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/api/announcements", {
      ...form,
      branch: form.branch || undefined,
    }).catch(() => {});
    setShowForm(false);
    setForm(EMPTY_FORM);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await api.delete(`/api/announcements/${id}`).catch(() => {});
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Megaphone size={22} className="text-brand-500" /> Announcements
          </h1>
          <p className="text-sm text-slate-400">Important company news, updates, and policy notices</p>
        </div>
        {canManage && (
          <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}>
            <Plus size={16} /> Post Announcement
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select className="input w-40 text-sm" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High Priority</option>
          <option value="URGENT">Urgent Notice</option>
        </select>
        <select className="input w-40 text-sm" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          <option value="IDEALAB">Idealab</option>
          <option value="UGC">UGC</option>
          <option value="VIZAG">Vizag</option>
        </select>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Post New Announcement</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Announcement Title *" className="input text-sm sm:col-span-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="input text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Notice</option>
            </select>
            <select className="input text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="">All Branches</option>
              <option value="IDEALAB">Idealab</option>
              <option value="UGC">UGC</option>
              <option value="VIZAG">Vizag</option>
            </select>
            <input type="date" className="input text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <textarea required rows={3} placeholder="Full Announcement Message *" className="input text-sm sm:col-span-2 lg:col-span-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Post Announcement</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Feed List */}
      <div className="space-y-4">
        {items.map((ann) => {
          const cfg = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.NORMAL;
          const Icon = cfg.icon;
          return (
            <div key={ann.id} className={`rounded-xl border p-5 shadow-sm transition ${cfg.bg}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-xs dark:bg-slate-900/80 ${cfg.color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-base ${cfg.color}`}>{ann.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>📅 {new Date(ann.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {ann.branch && <span className="badge bg-white/60 dark:bg-slate-800">{ann.branch}</span>}
                      <span className={`badge uppercase font-bold text-[10px] ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <button onClick={() => handleDelete(ann.id)} className="text-slate-400 hover:text-red-500 transition p-1">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="mt-3 pl-12 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {ann.description}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-center py-12 text-slate-400">No announcements posted yet</p>
        )}
      </div>
    </div>
  );
}
