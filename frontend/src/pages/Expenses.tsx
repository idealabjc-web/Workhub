import { useEffect, useState } from "react";
import {
  Plus, Check, X, Trash2, Download, DollarSign, Upload, Paperclip,
  FileText, ExternalLink, Eye, Building2
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface ExpenseRow {
  id: string;
  employee_id?: string;
  branch?: string;
  department_id?: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
  vendor_name?: string;
  receipt_url?: string;
  payment_method?: string;
  status: string;
  created_at?: string;
  employee_name?: string;
  employee_number?: string;
}

interface Summary {
  month: string;
  total: number;
  pending: number;
  approved: number;
  paid: number;
  by_category: { category: string; amount: number }[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
  APPROVED: "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
  PAID: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300",
};

const CATEGORIES = [
  "Travel", "Food", "Vendors", "Accommodation", "Office Supplies",
  "Training", "Events", "Marketing", "Other"
];

const PIE_COLORS = ["#3366ff", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#f97316", "#6b7280", "#ec4899"];

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

export default function Expenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<{ url: string; title: string } | null>(null);

  // Form State
  const [form, setForm] = useState({
    category: "Travel",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    vendor_name: "",
    payment_method: "Card",
    receipt_url: "",
  });

  // File Upload State
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string; type: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

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

  // Handle File Selection / Drop
  const handleFileProcess = (file: File) => {
    if (!file) return;
    setUploadingFile(true);
    const sizeKb = (file.size / 1024).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKb} KB`;

    setSelectedFile({
      name: file.name,
      size: sizeStr,
      type: file.type,
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setForm((prev) => ({ ...prev, receipt_url: dataUrl }));
      setUploadingFile(false);
    };
    reader.onerror = () => {
      alert("Failed to read bill receipt file");
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employee_id) return;
    await api.post("/api/expenses", {
      ...form,
      employee_id: user.employee_id,
      amount: Number(form.amount),
    }).catch(() => {});

    setShowForm(false);
    setForm({
      category: "Travel",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
      vendor_name: "",
      payment_method: "Card",
      receipt_url: "",
    });
    setSelectedFile(null);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/api/expenses/${id}/status`, { status }).catch(() => {});
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense request?")) return;
    await api.delete(`/api/expenses/${id}`).catch(() => {});
    load();
  };

  const exportExcel = () => {
    const data = rows.map((r) => ({
      Employee: r.employee_name || "Staff Member",
      Date: formatDateMDY(r.date),
      Category: r.category,
      Vendor: r.vendor_name || "—",
      Amount: r.amount,
      PaymentMethod: r.payment_method,
      Description: r.description || "—",
      ReceiptAttached: r.receipt_url ? "Yes" : "No",
      Status: r.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Expenses");
    XLSX.writeFile(wb, `expenses_${monthFilter}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-slate-400">Submit and manage expense reimbursements & vendor payments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary gap-2"><Download size={15} /> Export</button>
          <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}><Plus size={16} /> Add Expense</button>
        </div>
      </div>

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:col-span-1">
            <div className="card p-4"><p className="text-xs text-slate-400">Total Claimed</p><p className="text-xl font-bold">₹{summary.total.toLocaleString()}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-400">Pending</p><p className="text-xl font-bold text-amber-600">₹{summary.pending.toLocaleString()}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-400">Approved</p><p className="text-xl font-bold text-blue-600">₹{summary.approved.toLocaleString()}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-400">Paid Out</p><p className="text-xl font-bold text-emerald-600">₹{summary.paid.toLocaleString()}</p></div>
          </div>
          {summary.by_category.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2">Expenses by Category</p>
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

      {/* Filter Toolbar */}
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
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Add Expense Claim Form with Drag & Drop Bill Dropzone */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4 shadow-lg border border-brand-500/20">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="font-semibold text-sm">Submit New Expense Claim / Vendor Invoice</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Category *</label>
              <select className="input text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Vendor / Payee Name</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9 text-sm"
                  placeholder="e.g. Amazon, Uber, Indigo, Local Vendor"
                  value={form.vendor_name}
                  onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Amount (₹) *</label>
              <input required type="number" step="0.01" placeholder="Amount (₹)" className="input text-sm" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Expense Date *</label>
              <input required type="date" className="input text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Payment Method</label>
              <select className="input text-sm" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {["Cash", "Card", "Bank Transfer", "UPI"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs text-slate-400 mb-1 block">Description / Purpose</label>
              <input className="input text-sm" placeholder="Detailed purpose or note for reimbursement" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {/* DRAG & DROP BILL RECEIPT DROPZONE */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs text-slate-400 mb-1 block">Attach Bill / Receipt Document</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed p-4 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  dragOver
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/30"
                    : selectedFile
                    ? "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-brand-400"
                }`}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />

                {selectedFile ? (
                  <div className="flex items-center gap-3 w-full justify-between px-2">
                    <div className="flex items-center gap-2.5 text-left">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-400">{selectedFile.size} · Receipt Attached</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setForm((prev) => ({ ...prev, receipt_url: "" }));
                      }}
                      className="px-2.5 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition font-medium z-10"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-2.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                      <Upload size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Drag & Drop bill receipt here, or <span className="text-brand-500 underline">browse</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Supports PDF, PNG, JPG, JPEG (Bills, Tax Invoices, Receipts)</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary" disabled={uploadingFile}>
              {uploadingFile ? "Attaching Bill..." : "Submit Claim"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table className="w-full min-w-[750px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase font-bold text-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Vendor / Payee</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Bill Receipt</th>
              <th className="px-4 py-3">Status</th>
              {canApprove && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-3.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee_name || "Staff Member"}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{r.employee_number || ""} {r.branch ? `· ${r.branch}` : ""}</p>
                </td>

                <td className="px-4 py-3.5 font-medium">
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={13} className="text-brand-500" />
                    <span>{r.category}</span>
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{r.vendor_name || "—"}</p>
                  {r.description && <p className="text-[10px] text-slate-400 truncate max-w-40">{r.description}</p>}
                </td>

                <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">₹{r.amount.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-slate-500 font-semibold">{formatDateMDY(r.date)}</td>
                <td className="px-4 py-3.5 text-slate-500 text-xs font-medium">{r.payment_method}</td>

                {/* RECEIPT / BILL ATTACHMENT VIEW */}
                <td className="px-4 py-3.5">
                  {r.receipt_url ? (
                    <button
                      onClick={() => setSelectedReceipt({ url: r.receipt_url!, title: `${r.category} Bill - ${r.vendor_name || "Receipt"}` })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 text-xs font-semibold transition"
                      title="View attached bill receipt"
                    >
                      <Paperclip size={12} /> View Bill
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs">No Bill</span>
                  )}
                </td>

                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-semibold text-[11px] ${STATUS_COLOR[r.status] || ""}`}>
                    {r.status}
                  </span>
                </td>

                {canApprove && (
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      {r.status === "PENDING" && (
                        <>
                          <button onClick={() => updateStatus(r.id, "APPROVED")} className="flex items-center gap-1 rounded px-2.5 py-1 bg-emerald-100 text-emerald-700 font-semibold text-xs hover:bg-emerald-200 transition"><Check size={11} /> Approve</button>
                          <button onClick={() => updateStatus(r.id, "REJECTED")} className="flex items-center gap-1 rounded px-2.5 py-1 bg-red-100 text-red-700 font-semibold text-xs hover:bg-red-200 transition"><X size={11} /> Reject</button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <button onClick={() => updateStatus(r.id, "PAID")} className="flex items-center gap-1 rounded px-2.5 py-1 bg-blue-100 text-blue-700 font-semibold text-xs hover:bg-blue-200 transition">Mark Paid</button>
                      )}
                      {r.status === "PENDING" && (
                        <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-500 transition" title="Delete expense"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No expenses found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* BILL RECEIPT PREVIEW MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedReceipt(null)}>
          <div className="card p-5 max-w-xl w-full space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Paperclip size={18} className="text-brand-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{selectedReceipt.title}</h3>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-slate-100 dark:bg-slate-900 p-2 flex items-center justify-center">
              {selectedReceipt.url.startsWith("data:application/pdf") ? (
                <iframe src={selectedReceipt.url} className="w-full h-96 rounded-lg" title="Bill PDF" />
              ) : selectedReceipt.url.startsWith("data:image/") || selectedReceipt.url.startsWith("http") ? (
                <img src={selectedReceipt.url} alt="Attached Bill Receipt" className="max-h-[60vh] rounded-lg object-contain" />
              ) : (
                <a href={selectedReceipt.url} target="_blank" rel="noreferrer" className="btn-primary gap-2 my-8">
                  <ExternalLink size={15} /> Open External Document Link
                </a>
              )}
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
              <a
                href={selectedReceipt.url}
                download="bill_receipt"
                className="btn-secondary text-xs gap-1.5"
              >
                <Download size={14} /> Download Bill
              </a>
              <button onClick={() => setSelectedReceipt(null)} className="btn-primary text-xs">Close Viewer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
