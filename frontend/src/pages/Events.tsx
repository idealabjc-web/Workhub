import { useEffect, useState } from "react";
import { Plus, Trash2, Calendar, MapPin, Clock, Edit2 } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface CompanyEvent {
  id: string;
  name: string;
  date: string;
  time?: string;
  location?: string;
  organizer?: string;
  description?: string;
  branch?: string;
}

const EMPTY_FORM = {
  name: "",
  date: new Date().toISOString().slice(0, 10),
  time: "10:00",
  location: "",
  organizer: "HR Team",
  description: "",
  branch: "",
};

export default function Events() {
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { user } = useAuth();
  const canManage = user && ["SUPER_ADMIN", "HR"].includes(user.role);

  const load = () => {
    const params: any = {};
    if (branchFilter) params.branch = branchFilter;
    api.get("/api/events", { params }).then((r) => setEvents(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [branchFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, branch: form.branch || undefined };
    if (editId) {
      await api.patch(`/api/events/${editId}`, payload).catch(() => {});
    } else {
      await api.post("/api/events", payload).catch(() => {});
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    load();
  };

  const handleEdit = (ev: CompanyEvent) => {
    setForm({
      name: ev.name,
      date: ev.date,
      time: ev.time || "",
      location: ev.location || "",
      organizer: ev.organizer || "",
      description: ev.description || "",
      branch: ev.branch || "",
    });
    setEditId(ev.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await api.delete(`/api/events/${id}`).catch(() => {});
    load();
  };

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.date >= today);
  const pastEvents = events.filter((e) => e.date < today);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Company Events</h1>
          <p className="text-sm text-slate-400">Upcoming and past company activities</p>
        </div>
        {canManage && (
          <button className="btn-primary gap-2" onClick={() => { setShowForm((s) => !s); setEditId(null); setForm(EMPTY_FORM); }}>
            <Plus size={16} /> Create Event
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <select className="input w-40 text-sm" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          <option value="IDEALAB">Idealab</option>
          <option value="UGC">UGC</option>
          <option value="VIZAG">Vizag</option>
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">{editId ? "Edit Event" : "Create New Event"}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Event Name *" className="input text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input required type="date" className="input text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input type="time" className="input text-sm" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <input placeholder="Location / Venue" className="input text-sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <input placeholder="Organizer (e.g. HR Team)" className="input text-sm" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} />
            <select className="input text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="">All Branches</option>
              <option value="IDEALAB">Idealab</option>
              <option value="UGC">UGC</option>
              <option value="VIZAG">Vizag</option>
            </select>
            <input className="input text-sm sm:col-span-2 lg:col-span-3" placeholder="Description / Agenda" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editId ? "Update Event" : "Save Event"}</button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Upcoming Section */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Upcoming Events ({upcomingEvents.length})</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev} canManage={!!canManage} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
          {upcomingEvents.length === 0 && (
            <p className="col-span-3 py-8 text-center text-sm text-slate-400">No upcoming events scheduled</p>
          )}
        </div>
      </div>

      {/* Past Section */}
      {pastEvents.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-500 mb-3">Past Events ({pastEvents.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} canManage={!!canManage} onEdit={handleEdit} onDelete={handleDelete} dimmed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ ev, canManage, onEdit, onDelete, dimmed }: {
  ev: CompanyEvent; canManage: boolean; onEdit: (ev: CompanyEvent) => void; onDelete: (id: string) => void; dimmed?: boolean;
}) {
  const d = new Date(ev.date);
  return (
    <div className={`card p-5 flex flex-col justify-between space-y-4 ${dimmed ? "opacity-60" : ""}`}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">{ev.name}</h3>
          {canManage && (
            <div className="flex gap-1 shrink-0">
              <button onClick={() => onEdit(ev)} className="p-1 text-slate-400 hover:text-brand-500 transition"><Edit2 size={14} /></button>
              <button onClick={() => onDelete(ev.id)} className="p-1 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
            </div>
          )}
        </div>
        {ev.description && <p className="text-xs text-slate-500 line-clamp-2">{ev.description}</p>}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-brand-500" />
          <span>{d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
        {ev.time && (
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-brand-500" />
            <span>{ev.time}</span>
          </div>
        )}
        {ev.location && (
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-brand-500" />
            <span>{ev.location}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        {ev.branch ? (
          <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{ev.branch}</span>
        ) : (
          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">All Branches</span>
        )}
        {ev.organizer && <span className="text-[11px] text-slate-400">By {ev.organizer}</span>}
      </div>
    </div>
  );
}
