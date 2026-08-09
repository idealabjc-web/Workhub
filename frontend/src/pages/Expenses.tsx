import { useEffect, useState } from "react";
import { Plus, Check, X, Trash2, Download, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface ExpenseRow { id: string; employee_id?: string; branch?: string; department_id?: string; category: string; amount: number; date: string; description?: string; payment_method?: string; status: string; created_at?: string; }
interface Summary { month: string; total: number; pending: number; approved: number; paid: number; by_category: { category: string; amount: number }[]; }

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700", REJECTED: "bg-red-100 text-red-700",
};

const CATEGORIES = ["Travel", "Food", "Accommodation", "Office Supplies", "Training", "Events", "Marketing", "Other"];
const PIE_COLORS = ["#3366ff", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#f97316", "#6b7280"];

export default function Expenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "Travel", amount: "", date: new Date().toISOString().slice(0, 10), description: "", payment_method: "Card" });
  const { user } = useAuth();
  const canApprove = user && ["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"].includes(user.role);

  const load = () => {
    const params: any = {};
    if (monthFilter) params.month = monthFilter;
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    api.get("/api/expenses", { params }).then((r) => setRows(r.data)).catch(() => {});
    api.get("/api/expenses/summary/monthly", { params: { month: monthFilter } }).then((r) => setSummary(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [monthFilter, statusFilter, categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employee_id) return;
    await api.post("/api/expenses", { ...form, employee_id: user.employee_id, amount: Number(form.amount) }).catch(() => {});
    setShowForm(false);
    setForm({ category: "Travel", amount: "", date: new Date().toISOString().slice(0, 10), description: "", payment_method: "Card" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/api/expenses/${id}/status`, { status }).catch(() => {});
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/api/expenses/${id}`).catch(() => {});
    load();
  };

  const exportExcel = () => {
    const data = rows.map((r) => ({ Date: r.date, Category: r.category, Amount: r.amount, Description: r.description, Payment: r.payment_method, Status: r.status }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Expenses");
    XLSX.writeFile(wb, `expenses_${monthFilter}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Expenses</h1><p className="text-sm text-slate-400">Submit and manage expense reimbursements</p></div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary gap-2"><Download size={15} /> Export</button>
          <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}><Plus size={16} /> Add Expense</button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:col-span-1">
            <div className="card p-4"><p className="text-xs text-slate-400">Total</p><p className="text-xl font-bold">₹{summary.total.toLocaleString()}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-400">Pending</p><p className="text-xl font-bold text-amber-600">₹{summary.pending.toLocaleString()}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-400">Approved</p><p className="text-xl font-bold text-blue-600">₹{summary.approved.toLocaleString()}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-400">Paid</p><p className="text-xl font-bold text-emerald-600">₹{summary.paid.toLocaleString()}</p></div>
          </div>
          {summary.by_category.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2">By Category</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={summary.by_category} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={60} paddingAngle={2}>
                    {summary.by_category.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  <Legend iconSize={8} formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input type="month" className="input w-40 text-sm" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        <select className="input w-40 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select className="input w-40 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Submit Expense</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select className="input text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input required type="number" placeholder="Amount (₹)" className="input text-sm" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input required type="date" className="input text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select className="input text-sm" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              {["Cash", "Card", "Bank Transfer", "UPI"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className="input text-sm sm:col-span-2" placeholder="Description / Purpose" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Submit</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              {canApprove && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-slate-400" />{r.category}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold">₹{r.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{r.payment_method}</td>
                <td className="px-4 py-3 max-w-48 truncate text-slate-500">{r.description || "—"}</td>
                <td className="px-4 py-3"><span className={`badge ${STATUS_COLOR[r.status] || ""}`}>{r.status}</span></td>
                {canApprove && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.status === "PENDING" && (
                        <>
                          <button onClick={() => updateStatus(r.id, "APPROVED")} className="flex items-center gap-1 rounded px-2 py-1 bg-emerald-100 text-emerald-700 text-xs hover:bg-emerald-200 transition"><Check size={11} /> Approve</button>
                          <button onClick={() => updateStatus(r.id, "REJECTED")} className="flex items-center gap-1 rounded px-2 py-1 bg-red-100 text-red-700 text-xs hover:bg-red-200 transition"><X size={11} /> Reject</button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <button onClick={() => updateStatus(r.id, "PAID")} className="flex items-center gap-1 rounded px-2 py-1 bg-blue-100 text-blue-700 text-xs hover:bg-blue-200 transition">Mark Paid</button>
                      )}
                      {r.status === "PENDING" && (
                        <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-500 transition"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No expenses found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
