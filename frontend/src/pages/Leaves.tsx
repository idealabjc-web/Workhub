import { useEffect, useState } from "react";
import { Plus, Check, X, Trash2, Calendar, Eye, FileText } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

interface LeaveRow {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  comments?: string;
  applied_at?: string;
  employee_name?: string;
  employee_number?: string;
  branch?: string;
}

interface LeaveBalance { id: string; leave_type: string; total: number; used: number; }

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
  MANAGER_APPROVED: "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300",
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual Leave", SICK: "Sick Leave", PAID: "Paid Leave", UNPAID: "Unpaid Leave",
  MATERNITY: "Maternity Leave", PATERNITY: "Paternity Leave", OPTIONAL: "Optional Leave",
};

const EMPTY_FORM = { leave_type: "CASUAL", start_date: "", end_date: "", reason: "" };

function formatDateMDY(dateStr?: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return `${month}/${day}/${year}`;
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export default function Leaves() {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRow | null>(null);
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
    setSelectedLeave(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave request?")) return;
    await api.delete(`/api/leaves/${id}`).catch(() => {});
    setSelectedLeave(null);
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

      {/* Single Consolidated Leave Balance Summary Card */}
      {balances.length > 0 && (() => {
        const primary = balances[0];
        const remaining = Math.max(primary.total - primary.used, 0);
        return (
          <div className="card p-5 max-w-sm border-l-4 border-l-brand-500 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Annual Leave Quota</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-3xl font-extrabold ${balanceColor(primary.used, primary.total)}`}>{remaining}</span>
                <span className="text-sm font-semibold text-slate-400">of {primary.total} Left</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {primary.used} day(s) used this year
              </p>
            </div>
            <div className="w-24 text-right">
              <div className="text-xs font-bold text-brand-600 dark:text-brand-400 mb-1">
                {Math.round((remaining / primary.total) * 100)}% Available
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min((remaining / primary.total) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Apply Form */}
      {showForm && (
        <form onSubmit={handleApply} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">New Leave Request</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Leave Type</label>
              <select className="input text-sm" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                {Object.entries(LEAVE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
      <div className="table-wrapper">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase font-bold text-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3 text-center">Days</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3">Status</th>
              {canApprove && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelectedLeave(r)}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition"
              >
                <td className="px-4 py-3.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee_name || "Staff Member"}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{r.employee_number || ""} {r.branch ? `· ${r.branch}` : ""}</p>
                </td>
                <td className="px-4 py-3.5 font-medium">{LEAVE_TYPE_LABEL[r.leave_type] || r.leave_type}</td>
                <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{formatDateMDY(r.start_date)}</td>
                <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{formatDateMDY(r.end_date)}</td>
                <td className="px-4 py-3.5 text-center font-semibold">{daysBetween(r.start_date, r.end_date)}</td>
                <td className="px-4 py-3.5 max-w-48">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 group">
                    <span className="truncate max-w-[160px]">{r.reason || "—"}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedLeave(r); }}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-brand-600 transition text-[11px] font-medium flex items-center gap-1"
                      title="Click to view full reason and leave details"
                    >
                      <Eye size={12} /> View
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-400 text-xs">{formatDateMDY(r.applied_at)}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-semibold text-[11px] ${STATUS_COLOR[r.status] || ""}`}>
                    {r.status.replace("_", " ")}
                  </span>
                </td>
                {canApprove && (
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {r.status === "PENDING" && (
                        <>
                          <button onClick={() => updateStatus(r.id, "APPROVED")} className="flex items-center gap-1 rounded px-2.5 py-1 bg-emerald-100 text-emerald-700 font-semibold text-xs hover:bg-emerald-200 transition">
                            <Check size={12} /> Approve
                          </button>
                          <button onClick={() => updateStatus(r.id, "REJECTED")} className="flex items-center gap-1 rounded px-2.5 py-1 bg-red-100 text-red-700 font-semibold text-xs hover:bg-red-200 transition">
                            <X size={12} /> Reject
                          </button>
                        </>
                      )}
                      {r.status === "PENDING" && (
                        <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-500 transition" title="Delete request">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No leave requests found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* LEAVE DETAILS MODAL */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedLeave(null)}>
          <div className="card p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Leave Request Details</h3>
                  <p className="text-xs text-slate-400">Applied on {formatDateMDY(selectedLeave.applied_at)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLeave(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X size={18} />
              </button>
            </div>

            {/* Applicant Profile */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Applicant</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{selectedLeave.employee_name || "Staff Member"}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedLeave.employee_number || "—"} {selectedLeave.branch ? `· ${selectedLeave.branch}` : ""}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-lg font-bold text-xs ${STATUS_COLOR[selectedLeave.status] || ""}`}>
                {selectedLeave.status.replace("_", " ")}
              </span>
            </div>

            {/* Leave Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 font-medium mb-1">Leave Type</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{LEAVE_TYPE_LABEL[selectedLeave.leave_type] || selectedLeave.leave_type}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 font-medium mb-1">Total Duration</p>
                <p className="font-bold text-brand-600 dark:text-brand-400 text-sm">{daysBetween(selectedLeave.start_date, selectedLeave.end_date)} Day(s)</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 font-medium mb-1">From Date</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{formatDateMDY(selectedLeave.start_date)}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-slate-400 font-medium mb-1">To Date</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{formatDateMDY(selectedLeave.end_date)}</p>
              </div>
            </div>

            {/* FULL REASON SECTION */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Full Reason for Leave</p>
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-slate-800 dark:text-slate-200 text-xs leading-relaxed font-medium whitespace-pre-wrap">
                {selectedLeave.reason || "No detailed reason provided."}
              </div>
            </div>

            {/* Comments (if any) */}
            {selectedLeave.comments && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Reviewer Comments</p>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                  {selectedLeave.comments}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setSelectedLeave(null)} className="btn-secondary text-xs px-4 py-2">
                Close
              </button>

              {canApprove && selectedLeave.status === "PENDING" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(selectedLeave.id, "REJECTED")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-300 font-bold text-xs transition"
                  >
                    <X size={14} /> Reject Leave
                  </button>
                  <button
                    onClick={() => updateStatus(selectedLeave.id, "APPROVED")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-md transition"
                  >
                    <Check size={14} /> Approve Leave
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
