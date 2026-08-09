import { useEffect, useState } from "react";
import { Plus, Check, X, Trash2, Calendar } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface LeaveRow { id: string; employee_id: string; leave_type: string; start_date: string; end_date: string; status: string; reason?: string; comments?: string; applied_at?: string; }
interface LeaveBalance { id: string; leave_type: string; total: number; used: number; }

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", MANAGER_APPROVED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700", REJECTED: "bg-red-100 text-red-700",
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", PAID: "Paid", UNPAID: "Unpaid",
  MATERNITY: "Maternity", PATERNITY: "Paternity", OPTIONAL: "Optional",
};

const EMPTY_FORM = { leave_type: "CASUAL", start_date: "", end_date: "", reason: "" };

export default function Leaves() {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const canApprove = user && ["SUPER_ADMIN", "HR", "MANAGER"].includes(user.role);

  const load = () => {
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    api.get("/api/leaves", { params }).then((r) => setRows(r.data)).catch(() => {});
    api.get("/api/leaves/balances").then((r) => setBalances(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [statusFilter]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employee_id) return;
    setSubmitting(true);
    await api.post("/api/leaves", { ...form, employee_id: user.employee_id }).catch(() => {});
    setShowForm(false);
    setForm(EMPTY_FORM);
    setSubmitting(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/api/leaves/${id}/status`, { status }).catch(() => {});
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/api/leaves/${id}`).catch(() => {});
    load();
  };

  const daysBetween = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(Math.ceil(diff / 86400000) + 1, 1);
  };

  const balanceColor = (used: number, total: number) => {
    const pct = used / total;
    if (pct >= 0.9) return "text-red-600";
    if (pct >= 0.7) return "text-amber-600";
    return "text-emerald-600";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leave Management</h1>
          <p className="text-sm text-slate-400">Apply, track, and manage leave requests</p>
        </div>
        <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> Apply Leave
        </button>
      </div>

      {/* Leave Balances */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {balances.slice(0, 6).map((b) => (
            <div key={b.id} className="card p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">{LEAVE_TYPE_LABEL[b.leave_type] || b.leave_type}</p>
              <p className={`text-2xl font-bold ${balanceColor(b.used, b.total)}`}>{b.total - b.used}</p>
              <p className="text-[10px] text-slate-400">of {b.total} left</p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-1 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min((b.used / b.total) * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply Form */}
      {showForm && (
        <form onSubmit={handleApply} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">New Leave Request</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Leave Type</label>
              <select className="input text-sm" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                {Object.entries(LEAVE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l} Leave</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Start Date</label>
              <input required type="date" className="input text-sm" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">End Date</label>
              <input required type="date" className="input text-sm" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Duration</label>
              <div className="input text-sm bg-slate-50 dark:bg-slate-800 text-slate-500">
                {form.start_date && form.end_date ? `${daysBetween(form.start_date, form.end_date)} day(s)` : "—"}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="text-xs text-slate-400 mb-1 block">Reason</label>
              <input className="input text-sm" placeholder="Reason for leave" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Submitting..." : "Submit Request"}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        <select className="input w-44 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="MANAGER_APPROVED">Manager Approved</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3">Status</th>
              {canApprove && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-3 font-medium">{LEAVE_TYPE_LABEL[r.leave_type] || r.leave_type}</td>
                <td className="px-4 py-3">{new Date(r.start_date).toLocaleDateString()}</td>
                <td className="px-4 py-3">{new Date(r.end_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-center font-semibold">{daysBetween(r.start_date, r.end_date)}</td>
                <td className="px-4 py-3 max-w-40 truncate text-slate-500">{r.reason || "—"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{r.applied_at ? new Date(r.applied_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_COLOR[r.status] || ""}`}>{r.status.replace("_", " ")}</span>
                </td>
                {canApprove && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.status === "PENDING" && (
                        <>
                          <button onClick={() => updateStatus(r.id, "APPROVED")} className="flex items-center gap-1 rounded px-2 py-1 bg-emerald-100 text-emerald-700 text-xs hover:bg-emerald-200 transition">
                            <Check size={12} /> Approve
                          </button>
                          <button onClick={() => updateStatus(r.id, "REJECTED")} className="flex items-center gap-1 rounded px-2 py-1 bg-red-100 text-red-700 text-xs hover:bg-red-200 transition">
                            <X size={12} /> Reject
                          </button>
                        </>
                      )}
                      {r.status === "PENDING" && (
                        <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-500 transition">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No leave requests found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
