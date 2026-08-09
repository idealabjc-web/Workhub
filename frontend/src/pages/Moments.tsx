import { useEffect, useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Moment { id: string; title: string; description?: string; employee_id?: string; date: string; branch?: string; category: string; created_at?: string; }
interface Employee { id: string; first_name: string; last_name: string; branch: string; }

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  Birthday:    { emoji: "🎂", color: "text-pink-600",   bg: "bg-pink-100 dark:bg-pink-900/30" },
  Anniversary: { emoji: "🎊", color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30" },
  Achievement: { emoji: "🏆", color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30" },
  Celebration: { emoji: "🥳", color: "text-emerald-600",bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  Recognition: { emoji: "⭐", color: "text-brand-600",  bg: "bg-brand-100 dark:bg-brand-900/30" },
  "New Joiner":{ emoji: "👋", color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  Promotion:   { emoji: "🚀", color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG);
const EMPTY_FORM = { title: "", description: "", employee_id: "", date: new Date().toISOString().slice(0, 10), branch: "", category: "Achievement" };

export default function Moments() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { user } = useAuth();
  const canManage = user && ["SUPER_ADMIN", "HR", "MANAGER"].includes(user.role);

  const load = () => {
    const params: any = {};
    if (categoryFilter) params.category = categoryFilter;
    api.get("/api/moments", { params }).then((r) => setMoments(r.data)).catch(() => {});
    api.get("/api/employees").then((r) => setEmployees(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/api/moments", { ...form, employee_id: form.employee_id || undefined, branch: form.branch || undefined }).catch(() => {});
    setShowForm(false);
    setForm(EMPTY_FORM);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/api/moments/${id}`).catch(() => {});
    load();
  };

  const empName = (id?: string) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name}` : null;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = moments.filter((m) => m.date >= today);
  const past = moments.filter((m) => m.date < today);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles size={22} className="text-brand-500" /> Moments</h1>
          <p className="text-sm text-slate-400">Company celebrations and employee milestones</p>
        </div>
        {canManage && <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}><Plus size={16} /> Add Moment</button>}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCategoryFilter("")} className={`badge px-3 py-1 text-sm cursor-pointer ${!categoryFilter ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c === categoryFilter ? "" : c)} className={`badge px-3 py-1 text-sm cursor-pointer ${categoryFilter === c ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}>
            {CATEGORY_CONFIG[c].emoji} {c}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Create Moment</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Title *" className="input text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="input text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_CONFIG[c].emoji} {c}</option>)}
            </select>
            <input type="date" className="input text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select className="input text-sm" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">No specific employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
            <select className="input text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="">All Branches</option>
              <option value="IDEALAB">Idealab</option>
              <option value="UGC">UGC</option>
              <option value="VIZAG">Vizag</option>
            </select>
            <input className="input text-sm" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Post Moment</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">Upcoming & Today</h3>
          <div className="space-y-3">
            {upcoming.map((m) => <MomentCard key={m.id} m={m} empName={empName} formatDate={formatDate} canManage={!!canManage} onDelete={handleDelete} />)}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">Past Moments</h3>
          <div className="space-y-3">
            {past.map((m) => <MomentCard key={m.id} m={m} empName={empName} formatDate={formatDate} canManage={!!canManage} onDelete={handleDelete} dimmed />)}
          </div>
        </div>
      )}
      {moments.length === 0 && <p className="text-center py-12 text-slate-400">No moments yet. Create the first one!</p>}
    </div>
  );
}

function MomentCard({ m, empName, formatDate, canManage, onDelete, dimmed }: {
  m: any; empName: (id?: string) => string | null; formatDate: (d: string) => string;
  canManage: boolean; onDelete: (id: string) => void; dimmed?: boolean;
}) {
  const config = CATEGORY_CONFIG[m.category] || { emoji: "✨", color: "text-slate-600", bg: "bg-slate-100" };
  const name = empName(m.employee_id);
  return (
    <div className={`card p-4 flex items-start gap-4 transition ${dimmed ? "opacity-60" : ""}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${config.bg}`}>
        {config.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-semibold ${config.color}`}>{m.title}</p>
          {canManage && <button onClick={() => onDelete(m.id)} className="p-1 text-slate-400 hover:text-red-500 transition shrink-0"><Trash2 size={13} /></button>}
        </div>
        {m.description && <p className="text-sm text-slate-500 mt-0.5">{m.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400">
          {name && <span className="font-medium text-slate-600 dark:text-slate-300">👤 {name}</span>}
          {m.branch && <span>📍 {m.branch}</span>}
          <span>📅 {formatDate(m.date)}</span>
          <span className={`badge ${config.bg} ${config.color}`}>{m.category}</span>
        </div>
      </div>
    </div>
  );
}
