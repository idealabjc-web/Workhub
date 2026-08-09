import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, PartyPopper, Upload, FileSpreadsheet, X } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";

interface Holiday { id: string; name: string; date: string; type: string; branch?: string; description?: string; }

const TYPE_COLOR: Record<string, string> = {
  National: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Festival: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Company: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  Optional: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  Branch: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
};
const TYPE_ICON: Record<string, string> = {
  National: "🇮🇳", Festival: "🎉", Company: "🏢", Optional: "📌", Branch: "📍",
};

const EMPTY_FORM = { name: "", date: "", type: "National", branch: "", description: "" };

export default function Holidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { user } = useAuth();
  const canManage = user && ["SUPER_ADMIN", "HR"].includes(user.role);

  const load = () => {
    const params: any = { year: yearFilter };
    if (typeFilter) params.type = typeFilter;
    api.get("/api/holidays", { params }).then((r) => setHolidays(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [yearFilter, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, branch: form.branch || undefined };
    if (editId) {
      await api.patch(`/api/holidays/${editId}`, payload).catch(() => {});
    } else {
      await api.post("/api/holidays", payload).catch(() => {});
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    load();
  };

  const handleEdit = (h: Holiday) => {
    setForm({ name: h.name, date: h.date, type: h.type, branch: h.branch || "", description: h.description || "" });
    setEditId(h.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this holiday?")) return;
    await api.delete(`/api/holidays/${id}`).catch(() => {});
    load();
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

        const importedHolidays = data.map((row) => ({
          name: row["Name"] || row["name"] || "Holiday",
          date: row["Date"] || row["date"],
          type: row["Type"] || row["type"] || "National",
          branch: row["Branch"] || row["branch"] || undefined,
          description: row["Description"] || row["description"] || "",
        })).filter(h => h.date);

        const res = await api.post("/api/holidays/import", { holidays: importedHolidays });
        setShowImportModal(false);
        load();
        alert(`Successfully imported ${res.data.imported} holidays!`);
      } catch (err: any) {
        alert("Import failed: " + (err.response?.data?.detail || err.message));
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Group by month
  const byMonth: Record<number, Holiday[]> = {};
  holidays.forEach((h) => {
    const m = new Date(h.date).getMonth();
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(h);
  });

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Holiday Calendar</h1>
          <p className="text-sm text-slate-400">{holidays.length} holidays in {yearFilter}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setShowImportModal(true)} className="btn-secondary gap-2"><Upload size={15} /> Import</button>
            <button className="btn-primary gap-2" onClick={() => { setShowForm((s) => !s); setEditId(null); setForm(EMPTY_FORM); }}>
              <Plus size={16} /> Add Holiday
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
            <button key={y} onClick={() => setYearFilter(y)}
              className={`px-4 py-2 text-sm font-medium transition ${y === yearFilter ? "bg-brand-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"}`}>
              {y}
            </button>
          ))}
        </div>
        <select className="input w-36 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {["National","Festival","Company","Optional","Branch"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h3 className="font-semibold text-sm">{editId ? "Edit Holiday" : "Add Holiday"}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Holiday name" className="input text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input required type="date" className="input text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select className="input text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["National","Festival","Company","Optional","Branch"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="">All Branches</option>
              <option value="IDEALAB">Idealab</option>
              <option value="UGC">UGC</option>
              <option value="VIZAG">Vizag</option>
            </select>
            <input placeholder="Description (optional)" className="input text-sm sm:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editId ? "Update" : "Add Holiday"}</button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Calendar Grid */}
      {holidays.length === 0 ? (
        <p className="text-center py-12 text-slate-400">No holidays for {yearFilter}</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(byMonth).map(([month, hols]) => (
            <div key={month}>
              <h3 className="text-sm font-semibold text-slate-500 mb-2 px-1">{MONTHS[Number(month)]}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hols.map((h) => {
                  const d = new Date(h.date);
                  const isPast = d < new Date();
                  return (
                    <div key={h.id} className={`card flex items-start gap-3 p-4 ${isPast ? "opacity-60" : ""}`}>
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/30 text-center">
                        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{MONTHS[d.getMonth()].slice(0, 3)}</span>
                        <span className="text-lg font-bold text-brand-700 dark:text-brand-300 leading-tight">{d.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-tight">{TYPE_ICON[h.type] || "📅"} {h.name}</p>
                          {canManage && (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => handleEdit(h)} className="p-1 text-slate-400 hover:text-brand-500 transition"><Edit2 size={13} /></button>
                              <button onClick={() => handleDelete(h.id)} className="p-1 text-slate-400 hover:text-red-500 transition"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{d.toLocaleDateString("en-IN", { weekday: "long" })}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className={`badge ${TYPE_COLOR[h.type] || ""}`}>{h.type}</span>
                          {h.branch && <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800">{h.branch}</span>}
                        </div>
                        {h.description && <p className="text-xs text-slate-400 mt-1 truncate">{h.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EXCEL IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowImportModal(false)}>
          <div className="card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-brand-500" /> Excel Holiday Import
              </h3>
              <button onClick={() => setShowImportModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload `.xlsx` file with columns: <b>Name</b>, <b>Date</b> (<code>YYYY-MM-DD</code>), <b>Type</b> (<code>National</code>, <code>Festival</code>, <code>Company</code>), <b>Branch</b>.
            </p>
            <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} disabled={importing} className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            </div>
            {importing && (
              <div className="flex items-center justify-center gap-2 text-xs text-brand-600 font-medium py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Importing holiday data...
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
