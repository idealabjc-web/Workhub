import { useEffect, useState } from "react";
import { Plus, Send, Download, Upload, Eye, X, FileSpreadsheet } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface PayrollRow {
  id: string; employee_id: string; month: string; basic_salary: number; hra: number;
  bonus: number; incentives: number; pf: number; esi: number; professional_tax: number;
  income_tax: number; other_deductions: number; net_salary: number; status: string;
  generated_at?: string;
}
interface Employee { id: string; employee_number: string; first_name: string; last_name: string; email: string; branch: string; }

const STATUS_COLOR: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600", Processing: "bg-amber-100 text-amber-700",
  Processed: "bg-blue-100 text-blue-700", Paid: "bg-emerald-100 text-emerald-700",
};

const EMPTY_FORM = {
  employee_id: "", month: new Date().toISOString().slice(0, 7),
  basic_salary: 0, hra: 0, bonus: 0, incentives: 0, pf: 0, esi: 0,
  professional_tax: 200, income_tax: 0, other_deductions: 0,
};

export default function Payroll() {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [branchFilter, setBranchFilter] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [viewSlip, setViewSlip] = useState<PayrollRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const { user } = useAuth();
  const isFinance = user && ["SUPER_ADMIN", "HR", "FINANCE"].includes(user.role);

  const load = () => {
    const params: any = { month: monthFilter };
    if (branchFilter) params.branch = branchFilter;
    api.get("/api/payroll", { params }).then((r) => setRows(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    if (isFinance) api.get("/api/employees").then((r) => setEmployees(r.data)).catch(() => {});
  }, [monthFilter, branchFilter]);

  const totalPayroll = rows.reduce((s, r) => s + r.net_salary, 0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/payroll/generate", form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to generate payroll");
    }
    setSubmitting(false);
  };

  const handleSendPayslip = async (id: string) => {
    setSendingId(id);
    setSendMsg(null);
    const r = await api.post(`/api/payroll/${id}/send-payslip`).catch((e) => e.response);
    setSendMsg(r?.data?.message || "Sent!");
    setSendingId(null);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.patch(`/api/payroll/${id}/status`, { status }).catch(() => {});
    load();
  };

  const exportExcel = () => {
    const data = rows.map((r) => ({
      Month: r.month, "Employee ID": r.employee_id, Basic: r.basic_salary,
      HRA: r.hra, Bonus: r.bonus, Incentives: r.incentives,
      PF: r.pf, ESI: r.esi, "Prof Tax": r.professional_tax,
      TDS: r.income_tax, "Net Salary": r.net_salary, Status: r.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Payroll");
    XLSX.writeFile(wb, `payroll_${monthFilter}.xlsx`);
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

        const payrolls = data.map((row) => ({
          employee_id: row["Employee ID"] || row["employee_id"],
          month: row["Month"] || row["month"] || monthFilter,
          basic_salary: Number(row["Basic Salary"] || row["basic_salary"] || 0),
          hra: Number(row["HRA"] || row["hra"] || 0),
          bonus: Number(row["Bonus"] || row["bonus"] || 0),
          incentives: Number(row["Incentives"] || row["incentives"] || 0),
          pf: Number(row["PF"] || row["pf"] || 0),
          esi: Number(row["ESI"] || row["esi"] || 0),
          professional_tax: Number(row["Prof Tax"] || row["professional_tax"] || 200),
          income_tax: Number(row["TDS"] || row["income_tax"] || 0),
        })).filter(p => p.employee_id);

        const res = await api.post("/api/payroll/import", { payrolls });
        setShowImportModal(false);
        load();
        alert(`Successfully imported ${res.data.imported} payroll records!`);
      } catch (err: any) {
        alert("Import failed: " + (err.response?.data?.detail || err.message));
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const empName = (id: string) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name}` : id.slice(0, 8) + "...";
  };

  const autoFill = () => {
    const emp = employees.find((e) => e.id === form.employee_id);
    if (!emp) return;
    setForm({ ...form, pf: Math.round(form.basic_salary * 0.12), esi: form.basic_salary <= 21000 ? Math.round(form.basic_salary * 0.0175) : 0 });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="text-sm text-slate-400">Salary management and payslips</p>
        </div>
        <div className="flex gap-2">
          {isFinance && (
            <button onClick={() => setShowImportModal(true)} className="btn-secondary gap-2"><Upload size={15} /> Import</button>
          )}
          <button onClick={exportExcel} className="btn-secondary gap-2"><Download size={15} /> Export</button>
          {isFinance && (
            <button className="btn-primary gap-2" onClick={() => setShowForm((s) => !s)}>
              <Plus size={16} /> Generate Payroll
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {isFinance && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4"><p className="text-xs text-slate-400">Total Payroll</p><p className="text-xl font-bold">₹{totalPayroll.toLocaleString()}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">Employees Paid</p><p className="text-xl font-bold">{rows.filter(r => r.status === "Paid").length}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">Pending</p><p className="text-xl font-bold text-amber-600">{rows.filter(r => r.status !== "Paid").length}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">Processed</p><p className="text-xl font-bold text-blue-600">{rows.filter(r => r.status === "Processed").length}</p></div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input type="month" className="input w-40 text-sm" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        {isFinance && (
          <select className="input w-36 text-sm" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="">All Branches</option>
            <option value="IDEALAB">Idealab</option>
            <option value="UGC">UGC</option>
            <option value="VIZAG">Vizag</option>
          </select>
        )}
      </div>

      {/* Dev mode notice */}
      {sendMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 flex items-start justify-between gap-2">
          <span>⚠️ DEV MODE — {sendMsg}</span>
          <button onClick={() => setSendMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* Generate Form */}
      {showForm && (
        <form onSubmit={handleGenerate} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Generate Payroll</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Employee</label>
              <select required className="input text-sm" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">Select Employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Month</label>
              <input required type="month" className="input text-sm" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Basic Salary (₹)</label>
              <input required type="number" className="input text-sm" value={form.basic_salary || ""} onChange={(e) => setForm({ ...form, basic_salary: +e.target.value })} onBlur={autoFill} />
            </div>
            {[["HRA", "hra"], ["Bonus", "bonus"], ["Incentives", "incentives"],
              ["PF (12%)", "pf"], ["ESI", "esi"], ["Prof. Tax", "professional_tax"],
              ["TDS", "income_tax"], ["Other Deductions", "other_deductions"]].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                <input type="number" className="input text-sm" value={(form as any)[key] || ""} onChange={(e) => setForm({ ...form, [key]: +e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Generating..." : "Generate"}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table className="w-full min-w-[750px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Basic</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium">{isFinance ? empName(r.employee_id) : "My Salary"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.month}</td>
                  <td className="px-4 py-3">₹{r.basic_salary.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {isFinance ? (
                      <select className={`badge border-0 text-xs ${STATUS_COLOR[r.status] || ""}`} value={r.status} onChange={(e) => handleStatusChange(r.id, e.target.value)}>
                        {["Draft", "Processing", "Processed", "Paid"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className={`badge ${STATUS_COLOR[r.status] || ""}`}>{r.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewSlip(r)} className="p-1.5 text-slate-400 hover:text-brand-500 transition" title="View Payslip"><Eye size={14} /></button>
                      {isFinance && (
                        <button onClick={() => handleSendPayslip(r.id)} disabled={sendingId === r.id} className="p-1.5 text-slate-400 hover:text-brand-500 transition" title="Send Payslip">
                          {sendingId === r.id ? <div className="h-3.5 w-3.5 animate-spin rounded-full border border-brand-500 border-t-transparent" /> : <Send size={14} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No payroll records found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* EXCEL IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowImportModal(false)}>
          <div className="card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-brand-500" /> Excel Payroll Import
              </h3>
              <button onClick={() => setShowImportModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload `.xlsx` file with columns: <b>Employee ID</b>, <b>Month</b> (<code>YYYY-MM</code>), <b>Basic Salary</b>, <b>HRA</b>, <b>Bonus</b>, <b>PF</b>, <b>TDS</b>.
            </p>
            <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} disabled={importing} className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            </div>
            {importing && (
              <div className="flex items-center justify-center gap-2 text-xs text-brand-600 font-medium py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Importing payroll data...
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
