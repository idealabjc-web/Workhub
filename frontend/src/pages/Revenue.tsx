import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Download, Upload, FileSpreadsheet, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface RevenueRow { id: string; team_id?: string; branch?: string; month: string; target: number; achieved: number; incentives: number; notes?: string; }
interface Team { id: string; name: string; branch: string; }
interface Summary { year: number; total_target: number; total_achieved: number; achievement_pct: number; monthly: { month: string; target: number; achieved: number; incentives: number }[]; }

const BRANCH_COLOR: Record<string, string> = { IDEALAB: "bg-brand-100 text-brand-700", UGC: "bg-violet-100 text-violet-700", VIZAG: "bg-emerald-100 text-emerald-700" };

export default function Revenue() {
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthFilter, setMonthFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ team_id: "", branch: "", month: new Date().toISOString().slice(0, 7), target: 0, achieved: 0, incentives: 0, notes: "" });
  const { user } = useAuth();
  const canManage = user && ["SUPER_ADMIN", "HR", "FINANCE", "MANAGER"].includes(user.role);

  const load = () => {
    const params: any = {};
    if (monthFilter) params.month = monthFilter;
    if (branchFilter) params.branch = branchFilter;
    api.get("/api/revenue", { params }).then((r) => setRows(r.data)).catch(() => {});
    api.get("/api/revenue/summary/monthly").then((r) => setSummary(r.data)).catch(() => {});
    api.get("/api/teams").then((r) => setTeams(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [monthFilter, branchFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/api/revenue", { ...form, team_id: form.team_id || undefined, branch: form.branch || undefined }).catch(() => {});
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/api/revenue/${id}`).catch(() => {});
    load();
  };

  const exportExcel = () => {
    const data = rows.map((r) => ({ Month: r.month, Branch: r.branch, Target: r.target, Achieved: r.achieved, Achievement: `${((r.achieved / r.target) * 100).toFixed(1)}%`, Incentives: r.incentives }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Revenue");
    XLSX.writeFile(wb, `revenue_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsName]) as any[];

        const revenues = data.map((row) => ({
          month: row["Month"] || row["month"] || new Date().toISOString().slice(0, 7),
          branch: row["Branch"] || row["branch"] || undefined,
          target: Number(row["Target"] || row["target"] || 0),
          achieved: Number(row["Achieved"] || row["achieved"] || 0),
          incentives: Number(row["Incentives"] || row["incentives"] || 0),
          notes: row["Notes"] || row["notes"] || "",
        })).filter(r => r.target > 0);

        const res = await api.post("/api/revenue/import", { revenues });
        setShowImportModal(false);
        load();
        alert(`Successfully imported ${res.data.imported} revenue targets!`);
      } catch (err: any) {
        alert("Import failed: " + (err.response?.data?.detail || err.message));
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const teamName = (id?: string) => teams.find((t) => t.id === id)?.name || "—";
  const fmt = (n: number) => `₹${(n / 100000).toFixed(1)}L`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Revenue</h1><p className="text-sm text-slate-400">Track team and branch performance</p></div>
        <div className="flex gap-2">
          {canManage && <button onClick={() => setShowImportModal(true)} className="btn-secondary gap-2"><Upload size={15} /> Import</button>}
          <button onClick={exportExcel} className="btn-secondary gap-2"><Download size={15} /> Export</button>
          {canManage && <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}><Plus size={16} /> Add Revenue</button>}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4"><p className="text-xs text-slate-400">YTD Target</p><p className="text-xl font-bold">{fmt(summary.total_target)}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">YTD Achieved</p><p className="text-xl font-bold text-emerald-600">{fmt(summary.total_achieved)}</p></div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">Achievement</p>
            <div className="flex items-center gap-1">
              <p className={`text-xl font-bold ${summary.achievement_pct >= 100 ? "text-emerald-600" : summary.achievement_pct >= 80 ? "text-amber-600" : "text-red-600"}`}>{summary.achievement_pct}%</p>
              {summary.achievement_pct >= 100 ? <TrendingUp size={18} className="text-emerald-600" /> : <TrendingDown size={18} className="text-red-500" />}
            </div>
          </div>
          <div className="card p-4"><p className="text-xs text-slate-400">Shortfall</p><p className="text-xl font-bold text-red-500">{fmt(Math.max(summary.total_target - summary.total_achieved, 0))}</p></div>
        </div>
      )}

      {/* Chart */}
      {summary && summary.monthly.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="target" name="Target" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="achieved" name="Achieved" fill="#3366ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input type="month" className="input w-40 text-sm" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} placeholder="Filter by month" />
        <select className="input w-36 text-sm" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          <option value="IDEALAB">Idealab</option>
          <option value="UGC">UGC</option>
          <option value="VIZAG">Vizag</option>
        </select>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Add Revenue Record</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Month</label>
              <input required type="month" className="input text-sm" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Branch</label>
              <select className="input text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                <option value="">All</option>
                <option value="IDEALAB">Idealab</option>
                <option value="UGC">UGC</option>
                <option value="VIZAG">Vizag</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Team</label>
              <select className="input text-sm" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                <option value="">No Team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Target (₹)</label>
              <input required type="number" className="input text-sm" value={form.target || ""} onChange={(e) => setForm({ ...form, target: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Achieved (₹)</label>
              <input required type="number" className="input text-sm" value={form.achieved || ""} onChange={(e) => setForm({ ...form, achieved: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Incentives (₹)</label>
              <input type="number" className="input text-sm" value={form.incentives || ""} onChange={(e) => setForm({ ...form, incentives: +e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Notes</label>
              <input className="input text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Add</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Achieved</th>
              <th className="px-4 py-3">Achievement</th>
              <th className="px-4 py-3">Incentives</th>
              {canManage && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.target > 0 ? (r.achieved / r.target) * 100 : 0;
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium">{r.month}</td>
                  <td className="px-4 py-3 text-slate-500">{teamName(r.team_id)}</td>
                  <td className="px-4 py-3">{r.branch && <span className={`badge ${BRANCH_COLOR[r.branch] || ""}`}>{r.branch}</span>}</td>
                  <td className="px-4 py-3">₹{r.target.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold">₹{r.achieved.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full dark:bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-bold ${pct >= 100 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600"}`}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-emerald-600">₹{r.incentives.toLocaleString()}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No revenue records found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* EXCEL IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowImportModal(false)}>
          <div className="card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-brand-500" /> Excel Revenue Import
              </h3>
              <button onClick={() => setShowImportModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload `.xlsx` file with columns: <b>Month</b> (<code>YYYY-MM</code>), <b>Branch</b>, <b>Target</b>, <b>Achieved</b>, <b>Incentives</b>.
            </p>
            <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} disabled={importing} className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            </div>
            {importing && (
              <div className="flex items-center justify-center gap-2 text-xs text-brand-600 font-medium py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Importing revenue data...
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowImportModal(false)} className="btn-secondary text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
